import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSContracts } from "./helpers/types";
import {
  deployZNS,
  hashDomainLabel,
  hashSubdomainName,
  normalizeName,
  priceConfigDefault,
  REGISTRAR_ROLE,
} from "./helpers";
import * as hre from "hardhat";
import * as ethers from "ethers";
import {
  ZNSDirectPayment,
  ZNSDirectPayment__factory,
  ZNSFixedPricing,
  ZNSFixedPricing__factory, ZNSSubdomainRegistrar, ZNSSubdomainRegistrar__factory,
} from "../typechain";
import { expect } from "chai";
import { getDomainHashFromEvent } from "./helpers/events";


describe.only("ZNSSubdomainRegistrar", () => {
  let deployer : SignerWithAddress;
  let parentOwner : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let subOwner : SignerWithAddress;

  let zns : ZNSContracts;
  let pricing : ZNSFixedPricing;
  let payment : ZNSDirectPayment;
  let subRegistrar : ZNSSubdomainRegistrar;
  let zeroVault : SignerWithAddress;
  let operator : SignerWithAddress;

  const rootDomainName = normalizeName("wilder");
  const rootDomainHash = hashDomainLabel(rootDomainName);
  const subdomainLabel = normalizeName("beast");
  const subdomainName = `${rootDomainName}.${subdomainLabel}`;
  const subdomainHash = hashSubdomainName(subdomainName);
  const subdomainHashKecc = ethers.utils.keccak256(
    rootDomainHash,
    ethers.utils.toUtf8Bytes(subdomainName)
  );

  beforeEach(async () => {
    [deployer, zeroVault, parentOwner, operator, governor, admin, subOwner] = await hre.ethers.getSigners();
    // zeroVault address is used to hold the fee charged to the user when registering
    zns = await deployZNS({
      deployer,
      governorAddresses: [deployer.address, governor.address],
      adminAddresses: [admin.address],
      priceConfig: priceConfigDefault,
      zeroVaultAddress: zeroVault.address,
    });

    // TODO sub: add to deployZNS()
    const pricingFactory = new ZNSFixedPricing__factory(deployer);
    pricing = await pricingFactory.deploy();
    await pricing.deployed();
    const paymentFactory = new ZNSDirectPayment__factory(deployer);
    payment = await paymentFactory.deploy();
    await payment.deployed();

    const subRegistrarFactory = new ZNSSubdomainRegistrar__factory(deployer);
    subRegistrar = await subRegistrarFactory.deploy(
      zns.registry.address,
      zns.registrar.address,
    );
    await subRegistrar.deployed();

    // give SubRegistrar REGISTRAR_ROLE
    await zns.accessController.connect(admin).grantRole(REGISTRAR_ROLE, subRegistrar.address);

    // Give funds to user
    await zns.zeroToken.connect(parentOwner).approve(zns.treasury.address, ethers.constants.MaxUint256);
    await zns.zeroToken.mint(parentOwner.address, priceConfigDefault.maxPrice);
    await zns.zeroToken.mint(subOwner.address, ethers.utils.parseEther("10000"));
  });

  it("smoke", async () => {
    const tx = await zns.registrar.connect(parentOwner).registerDomain(
      rootDomainName,
      ethers.constants.AddressZero,
    );
    const receipt = await tx.wait(0);

    const parentHashFromSC = await getDomainHashFromEvent(receipt);

    const subdomainPrice = ethers.utils.parseEther("27");

    // TODO sub: create helpers for setting this up! and for enum `accessType`
    //  do we want to set these up upon registration or make a user call these separately?
    //  optimize for the best UX!
    //  maybe add API to SubReg to set these up in one tx?
    await pricing.connect(parentOwner).setPrice(rootDomainHash, subdomainPrice);

    await payment.connect(parentOwner).setPaymentConfig(
      rootDomainHash,
      {
        paymentToken: zns.zeroToken.address,
        beneficiary: parentOwner.address,
      }
    );

    await subRegistrar.connect(parentOwner).setParentRules(
      rootDomainHash,
      {
        pricingContract: pricing.address,
        paymentContract: payment.address,
        accessType: 1,
      }
    );

    const subOwnerBalBefore = await zns.zeroToken.balanceOf(subOwner.address);
    const parentOwnerBalBefore = await zns.zeroToken.balanceOf(parentOwner.address);

    await zns.zeroToken.connect(subOwner).approve(payment.address, subdomainPrice);

    await subRegistrar.connect(subOwner).registerSubdomain(
      rootDomainHash,
      subdomainLabel,
      subOwner.address
    );

    // TODO sub: add this to the event helper
    const filter = zns.registrar.filters.DomainRegistered(
      null,
      null,
      null,
      null,
      subOwner.address
    );
    const event = await zns.registrar.queryFilter(filter);
    const subHashFromSC = event[0].args.domainHash;

    // TODO sub: figure this out!
    // expect(parentHashFromSC).to.eq(rootDomainHash);
    // expect(subHashFromSC).to.eq(subdomainHash);
    // expect(subdomainHash).to.eq(subdomainHashKecc);

    const subOwnerBalAfter = await zns.zeroToken.balanceOf(subOwner.address);
    const parentOwnerBalAfter = await zns.zeroToken.balanceOf(parentOwner.address);

    expect(subOwnerBalBefore.sub(subOwnerBalAfter)).to.eq(subdomainPrice);
    expect(parentOwnerBalAfter.sub(parentOwnerBalBefore)).to.eq(subdomainPrice);

    const dataFromReg = await zns.registry.getDomainRecord(subHashFromSC);
    expect(dataFromReg.owner).to.eq(subOwner.address);
    expect(dataFromReg.resolver).to.eq(zns.addressResolver.address);

    const subTokenOwner = await zns.domainToken.ownerOf(subHashFromSC);
    expect(subTokenOwner).to.eq(subOwner.address);

    // resolution check
    const domainAddress = await zns.addressResolver.getAddress(subHashFromSC);
    expect(domainAddress).to.eq(subOwner.address);
  });
});
