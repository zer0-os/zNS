import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IASPriceConfig, IDistributionConfig, IFixedPriceConfig, IFullDistributionConfig, ZNSContracts } from "./types";
import { BigNumber, ContractReceipt } from "ethers";
import { getDomainHashFromEvent } from "./events";
import assert from "assert";
import { distrConfigEmpty } from "./constants";

export const defaultRootRegistration = async ({
  user,
  zns,
  domainName,
  domainContent = user.address,
  distrConfig = distrConfigEmpty,
} : {
  user : SignerWithAddress;
  zns : ZNSContracts;
  domainName : string;
  domainContent ?: string;
  distrConfig ?: IDistributionConfig;
}) : Promise<ContractReceipt> => {
  const tx = await zns.registrar.connect(user).registerDomain(
    domainName,
    domainContent, // Arbitrary address value
    distrConfig
  );

  return tx.wait();
};

export const approveForParent = async ({
  zns,
  parentHash,
  user,
  domainLabel,
} : {
  zns : ZNSContracts;
  parentHash : string;
  user : SignerWithAddress;
  domainLabel : string;
}) => {
  const { pricingContract } = await zns.subdomainRegistrar.distrConfigs(parentHash);
  let price = BigNumber.from(0);
  let parentFee = BigNumber.from(0);
  if (pricingContract === zns.priceOracle.address) {
    [price, parentFee] = await zns.priceOracle.getPriceAndFee(parentHash, domainLabel);
  } else if (pricingContract === zns.fixedPricing.address) {
    [price, parentFee] = await zns.fixedPricing.getPriceAndFee(parentHash, domainLabel);
  }

  const protocolFee = await zns.priceOracle.getProtocolFee(price.add(parentFee));
  const toApprove = price.add(parentFee).add(protocolFee);
  // TODO sub: add support for any kind of token
  await zns.zeroToken.connect(user).approve(zns.treasury.address, toApprove);
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
  parentHash,
  subdomainLabel,
  domainContent = user.address,
  distrConfig,
} : {
  user : SignerWithAddress;
  zns : ZNSContracts;
  parentHash : string;
  subdomainLabel : string;
  domainContent ?: string;
  distrConfig : IDistributionConfig;
}) => {
  const tx = await zns.subdomainRegistrar.connect(user).registerSubdomain(
    parentHash,
    subdomainLabel,
    domainContent, // Arbitrary address value
    distrConfig
  );

  return tx.wait();
};

export const registrationWithSetup = async ({
  zns,
  user,
  parentHash,
  domainLabel,
  domainContent = user.address,
  fullConfig,
  isRootDomain = true,
} : {
  zns : ZNSContracts;
  user : SignerWithAddress;
  parentHash ?: string;
  domainLabel : string;
  domainContent ?: string;
  fullConfig ?: IFullDistributionConfig;
  isRootDomain ?: boolean;
}) => {
  const hasConfig = !!fullConfig;
  const distrConfig = hasConfig
    ? fullConfig.distrConfig
    : distrConfigEmpty;

  // register domain
  if (isRootDomain) {
    await defaultRootRegistration({
      user,
      zns,
      domainName: domainLabel,
      domainContent,
      distrConfig,
    });
  } else {
    assert.ok(parentHash, "Parent hash must be provided for subdomain registration");

    await approveForParent({
      zns,
      parentHash,
      user,
      domainLabel,
    });

    await defaultSubdomainRegistration({
      user,
      zns,
      parentHash,
      subdomainLabel: domainLabel,
      domainContent,
      distrConfig,
    });
  }

  // get hash
  const domainHash = await getDomainHashFromEvent({
    zns,
    user,
  });

  if (!hasConfig) return domainHash;

  // TODO sub: do we want to set these up upon registration or make a user call these separately?
  //  optimize for the best UX!
  //  maybe add API to SubReg to set these up in one tx?
  // set up prices
  if (fullConfig.distrConfig.pricingContract === zns.fixedPricing.address) {
    await zns.fixedPricing.connect(user).setPriceConfig(
      domainHash,
      fullConfig.priceConfig as IFixedPriceConfig,
    );
  } else if (fullConfig.distrConfig.pricingContract === zns.priceOracle.address) {
    await zns.priceOracle.connect(user).setPriceConfig(
      domainHash,
      fullConfig.priceConfig as IASPriceConfig,
    );
  }

  // set up payment config
  await zns.treasury.connect(user).setPaymentConfig(
    domainHash,
    fullConfig.paymentConfig,
  );

  return domainHash;
};
