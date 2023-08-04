import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IDistributionConfig, ZNSContracts } from "./helpers/types";
import {
  deployZNS, getPrice, getPriceObject,
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
import { getDomainHashFromEvent, getDomainHashFromReceipt } from "./helpers/events";
import { BigNumber, Contract } from "ethers";
import { registrationWithSetup } from "./helpers/register-setup";


describe("ZNSSubdomainRegistrar", () => {
  let deployer : SignerWithAddress;
  let parentOwner : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let subOwner : SignerWithAddress;
  let subSubOwner : SignerWithAddress;

  let zns : ZNSContracts;
  let zeroVault : SignerWithAddress;
  let operator : SignerWithAddress;

  let defaultDistConfig : IDistributionConfig;

  let subdomainPrice : BigNumber;
  let subdomainHash : string;
  let subSubdomainHash : string;
  let subTokenId : string;
  let subSubTokenId : string;
  let subdomainFee : BigNumber;

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
    await zns.zeroToken.mint(subOwner.address, ethers.utils.parseEther("10000000000000"));
    await zns.zeroToken.mint(subSubOwner.address, ethers.utils.parseEther("10000000000000"));

    defaultDistConfig = {
      pricingContract: zns.fixedPricing.address,
      paymentContract: zns.directPayment.address,
      accessType: 1,
    };

    const distrConfig = {
      ...defaultDistConfig,
      pricingContract: zns.asPricing.address,
      paymentContract: zns.stakePayment.address,
    };

    const fullRootConfig = {
      distrConfig,
      priceConfig: priceConfigDefault,
      paymentConfig: {
        paymentToken: zns.zeroToken.address,
        beneficiary: parentOwner.address,
      },
    };

    await registrationWithSetup({
      zns,
      user: parentOwner,
      domainLabel: rootDomainName,
      fullConfig: fullRootConfig,
      isRootDomain: true,
    });
  });

  it("should register first lvl subdomain (fixedPricing + directPayment)", async () => {
    const subOwnerBalBefore = await zns.zeroToken.balanceOf(subOwner.address);
    const parentOwnerBalBefore = await zns.zeroToken.balanceOf(parentOwner.address);

    const subPriceObj = await getPriceObject(
      subdomainLabel
    );
    ({
      expectedPrice: subdomainPrice,
      fee: subdomainFee,
    } = subPriceObj);

    await zns.zeroToken.connect(subOwner).approve(
      zns.stakePayment.address,
      subdomainPrice.add(subdomainFee)
    );

    const fullSubConfig = {
      distrConfig: defaultDistConfig,
      priceConfig: subdomainPrice,
      paymentConfig: {
        paymentToken: zns.zeroToken.address,
        beneficiary: subOwner.address,
      },
    };

    subdomainHash = await registrationWithSetup({
      zns,
      user: subOwner,
      parentHash: rootDomainHash,
      domainLabel: subdomainLabel,
      fullConfig: fullSubConfig,
      isRootDomain: false,
    });

    // TODO sub: figure this out!
    // expect(parentHashFromSC).to.eq(rootDomainHash);
    // expect(subHashFromSC).to.eq(subdomainHash);
    // expect(subdomainHash).to.eq(subdomainHashKecc);

    const subOwnerBalAfter = await zns.zeroToken.balanceOf(subOwner.address);
    const parentOwnerBalAfter = await zns.zeroToken.balanceOf(parentOwner.address);

    expect(
      subOwnerBalBefore.sub(subOwnerBalAfter)
    ).to.eq(
      subdomainPrice.add(subdomainFee)
    );
    expect(
      parentOwnerBalAfter.sub(parentOwnerBalBefore)
    ).to.eq(
      subdomainFee
    );

    const dataFromReg = await zns.registry.getDomainRecord(subdomainHash);
    expect(dataFromReg.owner).to.eq(subOwner.address);
    expect(dataFromReg.resolver).to.eq(zns.addressResolver.address);

    subTokenId = BigNumber.from(subdomainHash).toString();
    const subTokenOwner = await zns.domainToken.ownerOf(subTokenId);
    expect(subTokenOwner).to.eq(subOwner.address);

    // resolution check
    const domainAddress = await zns.addressResolver.getAddress(subdomainHash);
    expect(domainAddress).to.eq(subOwner.address);
  });

  it("should register second lvl subdomain", async () => {
    const subOwnerBalBefore = await zns.zeroToken.balanceOf(subOwner.address);
    const subSubOwnerBalBefore = await zns.zeroToken.balanceOf(subSubOwner.address);

    await zns.zeroToken.connect(subSubOwner).approve(
      zns.directPayment.address,
      subdomainPrice
    );

    await zns.subdomainRegistrar.connect(subSubOwner).registerSubdomain(
      subdomainHash,
      subSubdomainLabel,
      subSubOwner.address,
      defaultDistConfig
    );

    subSubdomainHash = await getDomainHashFromEvent({
      zns,
      user: subSubOwner,
    });

    // TODO sub: figure this out!
    // expect(parentHashFromSC).to.eq(rootDomainHash);
    // expect(subHashFromSC).to.eq(subdomainHash);
    // expect(subdomainHash).to.eq(subdomainHashKecc);

    const subOwnerBalAfter = await zns.zeroToken.balanceOf(subOwner.address);
    const subSubOwnerBalAfter = await zns.zeroToken.balanceOf(subSubOwner.address);

    expect(
      subOwnerBalAfter.sub(subOwnerBalBefore)
    ).to.eq(
      subdomainPrice
    );
    expect(
      subSubOwnerBalBefore.sub(subSubOwnerBalAfter)
    ).to.eq(
      subdomainPrice
    );

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
    await zns.subdomainRegistrar.connect(subSubOwner).revokeSubdomain(subdomainHash, subSubdomainHash);

    const dataFromReg = await zns.registry.getDomainRecord(subSubdomainHash);
    expect(dataFromReg.owner).to.eq(ethers.constants.AddressZero);
    expect(dataFromReg.resolver).to.eq(ethers.constants.AddressZero);

    await expect(
      zns.domainToken.ownerOf(subSubTokenId)
    ).to.be.revertedWith(
      INVALID_TOKENID_ERC_ERR
    );

    // TODO sub: add checks that owner can't call domain functions on Registry anymore
  });

  it("revoke with refund", async () => {
    const subOwnerBalBefore = await zns.zeroToken.balanceOf(subOwner.address);
    const parentOwnerBalBefore = await zns.zeroToken.balanceOf(parentOwner.address);

    await zns.subdomainRegistrar.connect(subOwner).revokeSubdomain(rootDomainHash, subdomainHash);

    const subOwnerBalAfter = await zns.zeroToken.balanceOf(subOwner.address);
    const parentOwnerBalAfter = await zns.zeroToken.balanceOf(parentOwner.address);

    expect(
      subOwnerBalAfter.sub(subOwnerBalBefore)
    ).to.eq(
      subdomainPrice
    );
    expect(
      parentOwnerBalBefore.sub(parentOwnerBalAfter)
    ).to.eq(
      BigNumber.from(0)
    );

    const dataFromReg = await zns.registry.getDomainRecord(subdomainHash);
    expect(dataFromReg.owner).to.eq(ethers.constants.AddressZero);
    expect(dataFromReg.resolver).to.eq(ethers.constants.AddressZero);

    await expect(
      zns.domainToken.ownerOf(subTokenId)
    ).to.be.revertedWith(
      INVALID_TOKENID_ERC_ERR
    );
  });

  it("can set registry on ZNSDirectPayment", async () => {
    await zns.directPayment.connect(admin).setRegistry(subOwner.address);
    let registryFromSC = await zns.directPayment.registry();
    expect(registryFromSC).to.eq(subOwner.address);

    // set back
    await zns.directPayment.connect(admin).setRegistry(zns.registry.address);
    registryFromSC = await zns.directPayment.registry();
    expect(registryFromSC).to.eq(zns.registry.address);
  });
  // TODO sub: test what happens if subOwner revokes before subSubOwner
});
