import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  IDistributionConfig,
  IFixedPriceConfig,
  IFullDistributionConfig,
  IZNSContracts,
} from "./types";
import { ethers } from "ethers";
import { getDomainHashFromEvent } from "./events";
import { distrConfigEmpty, fullDistrConfigEmpty, DEFAULT_TOKEN_URI, paymentConfigEmpty } from "./constants";
import { getTokenContract } from "./tokens";
import { ICurvePriceConfig } from "../../src/deploy/missions/types";
import { expect } from "chai";
import { hashDomainLabel } from "./hashing";

const { ZeroAddress } = ethers;


export const defaultRootRegistration = async ({
  user,
  zns,
  confirmations,
  domainName,
  domainContent = user.address,
  tokenURI = DEFAULT_TOKEN_URI,
  distrConfig = distrConfigEmpty,
} : {
  user : SignerWithAddress;
  zns : IZNSContracts;
  confirmations ?: number;
  domainName : string;
  domainContent ?: string;
  tokenURI ?: string;
  distrConfig ?: IDistributionConfig;
}) => {
  const supplyBefore = await zns.domainToken.totalSupply();

  const tx = await zns.rootRegistrar.connect(user).registerRootDomain(
    domainName,
    domainContent, // Arbitrary address value
    tokenURI,
    distrConfig,
    paymentConfigEmpty
  );
  await tx.wait(confirmations);

  const supplyAfter = await zns.domainToken.totalSupply();
  expect(supplyAfter).to.equal(supplyBefore + BigInt(1));
};

export const approveForParent = async ({
  zns,
  confirmations,
  parentHash,
  user,
  domainLabel,
} : {
  zns : IZNSContracts;
  confirmations ?: number;
  parentHash : string;
  user : SignerWithAddress;
  domainLabel : string;
}) => {
  const { pricerContract } = await zns.subRegistrar.distrConfigs(parentHash);
  let price = BigInt(0);
  let parentFee = BigInt(0);
  if (pricerContract === await zns.curvePricer.getAddress()) {
    [price, parentFee] = await zns.curvePricer.getPriceAndFee(parentHash, domainLabel, false);
  } else if (pricerContract === await zns.fixedPricer.getAddress()) {
    [price, parentFee] = await zns.fixedPricer.getPriceAndFee(parentHash, domainLabel, false);
  }

  const { token: tokenAddress } = await zns.treasury.paymentConfigs(parentHash);
  const tokenContract = getTokenContract(tokenAddress, user);

  const protocolFee = await zns.curvePricer.getFeeForPrice(ethers.ZeroHash, price + parentFee);
  const toApprove = price + parentFee + protocolFee;

  const tx = await tokenContract.connect(user).approve(await zns.treasury.getAddress(), toApprove);
  return tx.wait(confirmations);
};

/**
 * Create multiple functions:
 * 1. register a subdomain
 * 2. set up all the configs for Pricing and Payment contracts
 * 3. umbrella functions that combine smaller functions to achieve full flow with register + setup configs
 * */
export const defaultSubdomainRegistration = async ({
  user,
  zns,
  confirmations,
  parentHash,
  subdomainLabel,
  domainContent = user.address,
  tokenURI = DEFAULT_TOKEN_URI,
  distrConfig,
} : {
  user : SignerWithAddress;
  zns : IZNSContracts;
  confirmations ?: number;
  parentHash : string;
  subdomainLabel : string;
  domainContent ?: string;
  tokenURI ?: string;
  distrConfig : IDistributionConfig;
}) => {
  const supplyBefore = await zns.domainToken.totalSupply();

  const tx = await zns.subRegistrar.connect(user).registerSubdomain(
    parentHash,
    subdomainLabel,
    domainContent, // Arbitrary address value
    tokenURI,
    distrConfig,
    paymentConfigEmpty
  );
  await tx.wait(confirmations);

  const supplyAfter = await zns.domainToken.totalSupply();
  expect(supplyAfter).to.equal(supplyBefore + BigInt(1));
};

export const registrationWithSetup = async ({
  zns,
  confirmations,
  user,
  parentHash,
  domainLabel,
  domainContent = user.address,
  tokenURI = DEFAULT_TOKEN_URI,
  fullConfig = fullDistrConfigEmpty,
  setConfigs = true,
} : {
  zns : IZNSContracts;
  confirmations ?: number; // how many confirmations to wait for
  user : SignerWithAddress;
  parentHash ?: string;
  domainLabel : string;
  domainContent ?: string;
  tokenURI ?: string;
  fullConfig ?: IFullDistributionConfig;
  setConfigs ?: boolean;
}) => {
  const hasConfig = !!fullConfig;
  const distrConfig = hasConfig
    ? fullConfig.distrConfig
    : distrConfigEmpty;

  // register domain
  if (!parentHash || parentHash === ethers.ZeroHash) {
    await defaultRootRegistration({
      user,
      zns,
      confirmations,
      domainName: domainLabel,
      domainContent,
      tokenURI,
      distrConfig,
    });
  } else {
    await approveForParent({
      zns,
      confirmations,
      parentHash,
      user,
      domainLabel,
    });

    await defaultSubdomainRegistration({
      user,
      confirmations,
      zns,
      parentHash,
      subdomainLabel: domainLabel,
      domainContent,
      tokenURI,
      distrConfig,
    });
  }

  // get hash
  let domainHash;
  try {
    domainHash = await getDomainHashFromEvent({
      zns,
      user,
    });
  } catch (e) {
    domainHash = !parentHash || parentHash === ethers.ZeroHash
      ? hashDomainLabel(domainLabel)
      : await zns.subRegistrar.hashWithParent(parentHash, domainLabel);
  }

  if (!hasConfig) return domainHash;

  // set up prices
  if (fullConfig.distrConfig.pricerContract === await zns.fixedPricer.getAddress() && setConfigs) {
    const tx = await zns.fixedPricer.connect(user).setPriceConfig(
      domainHash,
      {
        ...fullConfig.priceConfig as IFixedPriceConfig,
        isSet: true,
      },
    );
    if (confirmations) await tx.wait(confirmations);
  } else if (fullConfig.distrConfig.pricerContract === await zns.curvePricer.getAddress() && setConfigs) {
    const tx = await zns.curvePricer.connect(user).setPriceConfig(
      domainHash,
      {
        ...fullConfig.priceConfig as ICurvePriceConfig,
        isSet: true,
      },
    );
    if (confirmations) await tx.wait(confirmations);
  }

  if (fullConfig.paymentConfig.token !== ZeroAddress && setConfigs) {
    // set up payment config
    const tx = await zns.treasury.connect(user).setPaymentConfig(
      domainHash,
      fullConfig.paymentConfig,
    );
    if (confirmations) await tx.wait(confirmations);
  }

  return domainHash;
};
