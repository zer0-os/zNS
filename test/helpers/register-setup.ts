import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  IDistributionConfig,
  IFixedPriceConfig,
  IFullDistributionConfig,
  IZNSContracts,
} from "./types";
import { ContractTransactionReceipt, ethers } from "ethers";
import { getDomainHashFromEvent } from "./events";
import { distrConfigEmpty, fullDistrConfigEmpty, DEFAULT_TOKEN_URI } from "./constants";
import { getTokenContract } from "./tokens";
import { ICurvePriceConfig } from "../../src/deploy/missions/types";

const { ZeroAddress } = ethers;


export const defaultRootRegistration = async ({
  user,
  zns,
  domainName,
  domainContent = user.address,
  tokenURI = DEFAULT_TOKEN_URI,
  distrConfig = distrConfigEmpty,
} : {
  user : SignerWithAddress;
  zns : IZNSContracts;
  domainName : string;
  domainContent ?: string;
  tokenURI ?: string;
  distrConfig ?: IDistributionConfig;
}) : Promise<ContractTransactionReceipt | null> => {
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
  let price = BigInt(0);
  let parentFee = BigInt(0);
  if (pricerContract === zns.curvePricer.address) {
    [price, parentFee] = await zns.curvePricer.getPriceAndFee(parentHash, domainLabel, false);
  } else if (pricerContract === zns.fixedPricer.address) {
    [price, parentFee] = await zns.fixedPricer.getPriceAndFee(parentHash, domainLabel, false);
  }

  const { token: tokenAddress } = await zns.treasury.paymentConfigs(parentHash);
  const tokenContract = getTokenContract(tokenAddress, user);

  const protocolFee = await zns.curvePricer.getFeeForPrice(ethers.ZeroHash, price + parentFee);
  const toApprove = price + parentFee + protocolFee;

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
  tokenURI = DEFAULT_TOKEN_URI,
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
  tokenURI = DEFAULT_TOKEN_URI,
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
  if (!parentHash || parentHash === ethers.ZeroHash) {
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
      {
        ...fullConfig.priceConfig as IFixedPriceConfig,
        isSet: true,
      },
    );
  } else if (fullConfig.distrConfig.pricerContract === zns.curvePricer.address && setConfigs) {
    await zns.curvePricer.connect(user).setPriceConfig(
      domainHash,
      {
        ...fullConfig.priceConfig as ICurvePriceConfig,
        isSet: true,
      },
    );
  }

  if (fullConfig.paymentConfig.token !== ZeroAddress && setConfigs) {
    // set up payment config
    await zns.treasury.connect(user).setPaymentConfig(
      domainHash,
      fullConfig.paymentConfig,
    );
  }

  return domainHash;
};
