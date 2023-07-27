import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSContracts } from "./helpers/types";
import {
  deployZNS,
  hashDomainLabel,
  hashSubdomainName, INVALID_TOKENID_ERC_ERR,
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
import { BigNumber, Contract } from "ethers";


describe.only("ZNSSubdomainRegistrar", () => {
  let deployer : SignerWithAddress;
  let parentOwner : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let subOwner : SignerWithAddress;
  let subSubOwner : SignerWithAddress;

  let zns : ZNSContracts;
  let zeroVault : SignerWithAddress;
  let operator : SignerWithAddress;

  // TODO sub: type this out
  let defaultDistConfig : {
    pricingContract : string;
    paymentContract : string;
    accessType : number;
  };

  let subdomainPrice : BigNumber;
  let subdomainHash : string;
  let subTokenId : string;
  let subSubTokenId : string;

  const rootDomainName = normalizeName("wilder");
  const rootDomainHash = hashDomainLabel(rootDomainName);
  const subdomainLabel = normalizeName("beast");
  const subSubdomainLabel = normalizeName("wape");
  const subdomainName = `${rootDomainName}.${subdomainLabel}`;
  const subHash = hashSubdomainName(subdomainName);
  const subdomainHashKecc = ethers.utils.keccak256(
    rootDomainHash,
    ethers.utils.toUtf8Bytes(subdomainName)
  );

  before(async () => {
    [
      deployer,
      zeroVault,
      parentOwner,
      operator,
      governor,
      admin,
      subOwner,
      subSubOwner,
    ] = await hre.ethers.getSigners();
    // zeroVault address is used to hold the fee charged to the user when registering
    zns = await deployZNS({
      deployer,
      governorAddresses: [deployer.address, governor.address],
      adminAddresses: [admin.address],
      priceConfig: priceConfigDefault,
      zeroVaultAddress: zeroVault.address,
    });

    // Give funds to user
    await zns.zeroToken.connect(parentOwner).approve(zns.treasury.address, ethers.constants.MaxUint256);
    await zns.zeroToken.mint(parentOwner.address, priceConfigDefault.maxPrice);
    await zns.zeroToken.mint(subOwner.address, ethers.utils.parseEther("10000"));
    await zns.zeroToken.mint(subSubOwner.address, ethers.utils.parseEther("10000"));

    defaultDistConfig = {
      pricingContract: zns.fixedPricing.address,
      paymentContract: zns.directPayment.address,
      accessType: 1,
    };
  });

  it("reg first subdomain", async () => {
    const tx = await zns.registrar.connect(parentOwner).registerDomain(
      rootDomainName,
      ethers.constants.AddressZero,
      defaultDistConfig
    );
    const receipt = await tx.wait(0);

    const parentHashFromSC = await getDomainHashFromEvent(receipt);

    subdomainPrice = ethers.utils.parseEther("27");

    // TODO sub: create helpers for setting this up! and for enum `accessType`
    //  do we want to set these up upon registration or make a user call these separately?
    //  optimize for the best UX!
    //  maybe add API to SubReg to set these up in one tx?
    await zns.fixedPricing.connect(parentOwner).setPrice(rootDomainHash, subdomainPrice);

    await zns.directPayment.connect(parentOwner).setPaymentConfig(
      rootDomainHash,
      {
        paymentToken: zns.zeroToken.address,
        beneficiary: parentOwner.address,
      }
    );

    const subOwnerBalBefore = await zns.zeroToken.balanceOf(subOwner.address);
    const parentOwnerBalBefore = await zns.zeroToken.balanceOf(parentOwner.address);

    await zns.zeroToken.connect(subOwner).approve(zns.directPayment.address, subdomainPrice);

    await zns.subdomainRegistrar.connect(subOwner).registerSubdomain(
      rootDomainHash,
      subdomainLabel,
      subOwner.address,
      defaultDistConfig
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
    subdomainHash = event[0].args.domainHash;

    // TODO sub: figure this out!
    // expect(parentHashFromSC).to.eq(rootDomainHash);
    // expect(subHashFromSC).to.eq(subdomainHash);
    // expect(subdomainHash).to.eq(subdomainHashKecc);

    const subOwnerBalAfter = await zns.zeroToken.balanceOf(subOwner.address);
    const parentOwnerBalAfter = await zns.zeroToken.balanceOf(parentOwner.address);

    expect(subOwnerBalBefore.sub(subOwnerBalAfter)).to.eq(subdomainPrice);
    expect(parentOwnerBalAfter.sub(parentOwnerBalBefore)).to.eq(subdomainPrice);

    const dataFromReg = await zns.registry.getDomainRecord(subdomainHash);
    expect(dataFromReg.owner).to.eq(subOwner.address);
    expect(dataFromReg.resolver).to.eq(zns.addressResolver.address);

    subTokenId = BigNumber.from(subdomainHash).toString();
    const subTokenOwner = await zns.domainToken.ownerOf(subTokenId);
    expect(subTokenOwner).to.eq(subOwner.address);

    // resolution check
    const domainAddress = await zns.addressResolver.getAddress(subdomainHash);
    expect(domainAddress).to.eq(subOwner.address);

    // set dist data for the newly registered subdomain
    await zns.fixedPricing.connect(subOwner).setPrice(subdomainHash, subdomainPrice);

    await zns.directPayment.connect(subOwner).setPaymentConfig(
      subdomainHash,
      {
        paymentToken: zns.zeroToken.address,
        beneficiary: subOwner.address,
      }
    );
  });

  it("reg sub of sub", async () => {
    const subOwnerBalBefore = await zns.zeroToken.balanceOf(subOwner.address);
    const subSubOwnerBalBefore = await zns.zeroToken.balanceOf(subSubOwner.address);

    await zns.zeroToken.connect(subSubOwner).approve(zns.directPayment.address, subdomainPrice);

    await zns.subdomainRegistrar.connect(subSubOwner).registerSubdomain(
      subdomainHash,
      subSubdomainLabel,
      subSubOwner.address,
      defaultDistConfig
    );

    // TODO sub: add this to the event helper
    const filter = zns.registrar.filters.DomainRegistered(
      null,
      null,
      null,
      null,
      subSubOwner.address
    );
    const event = await zns.registrar.queryFilter(filter);
    const subSubdomainHash = event[0].args.domainHash;

    // TODO sub: figure this out!
    // expect(parentHashFromSC).to.eq(rootDomainHash);
    // expect(subHashFromSC).to.eq(subdomainHash);
    // expect(subdomainHash).to.eq(subdomainHashKecc);

    const subOwnerBalAfter = await zns.zeroToken.balanceOf(subOwner.address);
    const subSubOwnerBalAfter = await zns.zeroToken.balanceOf(subSubOwner.address);

    expect(subOwnerBalAfter.sub(subOwnerBalBefore)).to.eq(subdomainPrice);
    expect(subSubOwnerBalBefore.sub(subSubOwnerBalAfter)).to.eq(subdomainPrice);

    const dataFromReg = await zns.registry.getDomainRecord(subSubdomainHash);
    expect(dataFromReg.owner).to.eq(subSubOwner.address);
    expect(dataFromReg.resolver).to.eq(zns.addressResolver.address);

    subSubTokenId = BigNumber.from(subSubdomainHash).toString();
    const subTokenOwner = await zns.domainToken.ownerOf(subSubTokenId);
    expect(subTokenOwner).to.eq(subSubOwner.address);

    // resolution check
    const domainAddress = await zns.addressResolver.getAddress(subSubdomainHash);
    expect(domainAddress).to.eq(subSubOwner.address);
  });

  it("can revoke a subdomain", async () => {
    await zns.subdomainRegistrar.connect(subOwner).revokeSubdomain(subdomainHash);

    const dataFromReg = await zns.registry.getDomainRecord(subdomainHash);
    expect(dataFromReg.owner).to.eq(ethers.constants.AddressZero);
    expect(dataFromReg.resolver).to.eq(ethers.constants.AddressZero);

    await expect(
      zns.domainToken.ownerOf(subTokenId)
    ).to.be.revertedWith(
      INVALID_TOKENID_ERC_ERR
    );
  });
});
