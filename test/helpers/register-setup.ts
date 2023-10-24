import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  ICurvePriceConfig,
  IDistributionConfig,
  IFixedPriceConfig,
  IFullDistributionConfig,
  IZNSContracts,
} from "./types";
import { BigNumber, ContractReceipt, ethers } from "ethers";
import { getDomainHashFromEvent } from "./events";
import { distrConfigEmpty, fullDistrConfigEmpty, defaultTokenURI } from "./constants";
import { getTokenContract } from "./tokens";

const { AddressZero } = ethers.constants;


export const defaultRootRegistration = async ({
  user,
  zns,
  domainName,
  domainContent = user.address,
  tokenURI = defaultTokenURI,
  distrConfig = distrConfigEmpty,
} : {
  user : SignerWithAddress;
  zns : IZNSContracts;
  domainName : string;
  domainContent ?: string;
  tokenURI ?: string;
  distrConfig ?: IDistributionConfig;
}) : Promise<ContractReceipt> => {
  const tx = await zns.rootRegistrar.connect(user).registerRootDomain(
    domainName,
    domainContent, // Arbitrary address value
    tokenURI,
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
  zns : IZNSContracts;
  parentHash : string;
  user : SignerWithAddress;
  domainLabel : string;
}) => {
  const { pricerContract } = await zns.subRegistrar.distrConfigs(parentHash);
  let price = BigNumber.from(0);
  let parentFee = BigNumber.from(0);
  if (pricerContract === zns.curvePricer.address) {
    [price, parentFee] = await zns.curvePricer.getPriceAndFee(parentHash, domainLabel);
  } else if (pricerContract === zns.fixedPricer.address) {
    [price, parentFee] = await zns.fixedPricer.getPriceAndFee(parentHash, domainLabel);
  }

  const { token: tokenAddress } = await zns.treasury.paymentConfigs(parentHash);
  const tokenContract = getTokenContract(tokenAddress, user);

  const protocolFee = await zns.curvePricer.getFeeForPrice(ethers.constants.HashZero, price.add(parentFee));
  const toApprove = price.add(parentFee).add(protocolFee);

  return tokenContract.connect(user).approve(zns.treasury.address, toApprove);
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
  tokenURI = defaultTokenURI,
  distrConfig,
} : {
  user : SignerWithAddress;
  zns : IZNSContracts;
  parentHash : string;
  subdomainLabel : string;
  domainContent ?: string;
  tokenURI ?: string;
  distrConfig : IDistributionConfig;
}) => {
  const tx = await zns.subRegistrar.connect(user).registerSubdomain(
    parentHash,
    subdomainLabel,
    domainContent, // Arbitrary address value
    tokenURI,
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
  tokenURI = defaultTokenURI,
  fullConfig = fullDistrConfigEmpty,
  setConfigs = true,
} : {
  zns : IZNSContracts;
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
  if (!parentHash || parentHash === ethers.constants.HashZero) {
    await defaultRootRegistration({
      user,
      zns,
      domainName: domainLabel,
      domainContent,
      tokenURI,
      distrConfig,
    });
  } else {
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
      tokenURI,
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
  if (fullConfig.distrConfig.pricerContract === zns.fixedPricer.address && setConfigs) {
    await zns.fixedPricer.connect(user).setPriceConfig(
      domainHash,
      fullConfig.priceConfig as IFixedPriceConfig,
    );
  } else if (fullConfig.distrConfig.pricerContract === zns.curvePricer.address && setConfigs) {
    await zns.curvePricer.connect(user).setPriceConfig(
      domainHash,
      fullConfig.priceConfig as ICurvePriceConfig,
    );
  }

  if (fullConfig.paymentConfig.beneficiary !== AddressZero && setConfigs) {
    // set up payment config
    await zns.treasury.connect(user).setPaymentConfig(
      domainHash,
      fullConfig.paymentConfig,
    );
  }

  return domainHash;
};
