import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IASPriceConfig, IDistributionConfig, IFullDistributionConfig, ZNSContracts } from "./types";
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
  const { pricingContract, paymentContract } = await zns.subdomainRegistrar.distrConfigs(parentHash);
  let price = BigNumber.from(0);
  let fee = BigNumber.from(0);
  if (pricingContract === zns.asPricing.address) {
    [price, fee] = await zns.asPricing.getPriceAndFee(parentHash, domainLabel);
  } else if (pricingContract === zns.fixedPricing.address) {
    price = await zns.fixedPricing.getPrice(parentHash, domainLabel);
  }

  const toApprove = price.add(fee);
  // TODO sub: add support for any kind of token
  await zns.zeroToken.connect(user).approve(paymentContract, toApprove);
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
    await zns.fixedPricing.connect(user).setPrice(
      domainHash,
      fullConfig.priceConfig as BigNumber,
    );
  } else if (fullConfig.distrConfig.pricingContract === zns.asPricing.address) {
    await zns.asPricing.connect(user).setPriceConfig(
      domainHash,
      fullConfig.priceConfig as IASPriceConfig,
    );
  }

  // set up payment
  if (fullConfig.distrConfig.paymentContract === zns.directPayment.address) {
    await zns.directPayment.connect(user).setPaymentConfig(
      domainHash,
      fullConfig.paymentConfig,
    );
  } else if (fullConfig.distrConfig.paymentContract === zns.stakePayment.address) {
    await zns.stakePayment.connect(user).setPaymentConfig(
      domainHash,
      fullConfig.paymentConfig,
    );
  }

  return domainHash;
};
