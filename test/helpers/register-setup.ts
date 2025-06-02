import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  IDistributionConfig,
  IRegisterWithSetupArgs,
  IPaymentConfig,
  IZNSContractsLocal,
  DefaultRootRegistrationArgs,
} from "./types";
import { ContractTransactionReceipt, ethers } from "ethers";
import { getDomainHashFromEvent } from "./events";
import { distrConfigEmpty, fullConfigEmpty, DEFAULT_TOKEN_URI, paymentConfigEmpty } from "./constants";
import { getTokenContract } from "./tokens";
import { expect } from "chai";
import { IZNSContracts } from "../../src/deploy/campaign/types";

const { ZeroAddress } = ethers;


export const defaultRootRegistration = async ({
  user,
  zns,
  domainName,
  tokenOwner = ZeroAddress,
  domainContent = user.address,
  tokenURI = DEFAULT_TOKEN_URI,
  distrConfig = distrConfigEmpty,
  paymentConfig = paymentConfigEmpty,
} : DefaultRootRegistrationArgs) : Promise<ContractTransactionReceipt | null> => {
  const supplyBefore = await zns.domainToken.totalSupply();

  const tx = await zns.rootRegistrar.connect(user).registerRootDomain({
    name: domainName,
    domainAddress: domainContent, // Arbitrary address value
    tokenURI,
    tokenOwner,
    distrConfig,
    paymentConfig,
  });

  const supplyAfter = await zns.domainToken.totalSupply();
  expect(supplyAfter).to.equal(supplyBefore + BigInt(1));

  return tx.wait();
};

export const approveForParent = async ({
  zns,
  parentHash,
  user,
  domainLabel,
} : {
  zns : IZNSContractsLocal | IZNSContracts;
  parentHash : string;
  user : SignerWithAddress;
  domainLabel : string;
}) => {
  const { pricerContract, priceConfig } = await zns.subRegistrar.distrConfigs(parentHash);

  let price = BigInt(0);
  let parentFee = BigInt(0);

  if (pricerContract === await zns.curvePricer.getAddress()) {
    [price, parentFee] = await zns.curvePricer.getPriceAndFee(priceConfig, domainLabel, false);
  } else if (pricerContract === await zns.fixedPricer.getAddress()) {
    [price, parentFee] = await zns.fixedPricer.getPriceAndFee(priceConfig, domainLabel, false);
  }

  const { token: tokenAddress } = await zns.treasury.paymentConfigs(parentHash);
  const tokenContract = getTokenContract(tokenAddress, user);


  const rootPriceConfig = await zns.rootRegistrar.rootPriceConfig();
  const protocolFee = await zns.curvePricer.getFeeForPrice(rootPriceConfig, price + parentFee);
  const toApprove = price + parentFee + protocolFee;

  return tokenContract.connect(user).approve(await zns.treasury.getAddress(), toApprove);
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
  tokenOwner = ZeroAddress,
  domainContent = user.address,
  tokenURI = DEFAULT_TOKEN_URI,
  distrConfig = distrConfigEmpty,
  paymentConfig = paymentConfigEmpty,
} : {
  user : SignerWithAddress;
  zns : IZNSContractsLocal | IZNSContracts;
  parentHash : string;
  subdomainLabel : string;
  tokenOwner ?: string;
  domainContent ?: string;
  tokenURI ?: string;
  distrConfig ?: IDistributionConfig;
  paymentConfig ?: IPaymentConfig;
}) => {
  const supplyBefore = await zns.domainToken.totalSupply();

  const tx = await zns.subRegistrar.connect(user).registerSubdomain({
    parentHash,
    label: subdomainLabel,
    domainAddress: domainContent, // Arbitrary address value
    tokenOwner,
    tokenURI,
    distrConfig,
    paymentConfig,
  });

  const supplyAfter = await zns.domainToken.totalSupply();
  expect(supplyAfter).to.equal(supplyBefore + BigInt(1));

  return tx.wait();
};

export const registrationWithSetup = async ({
  zns,
  user,
  parentHash,
  domainLabel,
  tokenOwner,
  domainContent = user.address,
  tokenURI = DEFAULT_TOKEN_URI,
  fullConfig = fullConfigEmpty,
  setConfigs = true,
} : IRegisterWithSetupArgs) => {
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
      tokenOwner,
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
      tokenOwner,
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
    tokenOwner,
  });

  if (!hasConfig) return domainHash;

  // set up prices
  if (fullConfig.distrConfig.pricerContract === zns.fixedPricer.target && setConfigs) {
    await zns.subRegistrar.connect(user).setPricerDataForDomain(
      domainHash,
      fullConfig.distrConfig.priceConfig,
      zns.fixedPricer.target
    );
  } else if (fullConfig.distrConfig.pricerContract === await zns.curvePricer.getAddress() && setConfigs) {
    await zns.subRegistrar.connect(user).setPricerDataForDomain(
      domainHash,
      fullConfig.distrConfig.priceConfig,
      zns.curvePricer.target
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
