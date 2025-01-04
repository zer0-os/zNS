import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  IDistributionConfig,
  IFixedPriceConfig,
  IFullDistributionConfig, IZNSContractsLocal,
} from "./types";
import { ContractTransactionReceipt, ethers } from "ethers";
import { getDomainHashFromEvent } from "./events";
import { distrConfigEmpty, fullDistrConfigEmpty, DEFAULT_TOKEN_URI, paymentConfigEmpty } from "./constants";
import { getTokenContract } from "./tokens";
import { ICurvePriceConfig } from "../../src/deploy/missions/types";
import { expect } from "chai";
import { IZNSContracts } from "../../src/deploy/campaign/types";
import { ZNSRootRegistrarTrunk, ZNSZChainPortal } from "../../typechain";
import { getConfirmationsNumber } from "./tx";

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
  zns : IZNSContractsLocal | IZNSContracts;
  domainName : string;
  domainContent ?: string;
  tokenURI ?: string;
  distrConfig ?: IDistributionConfig;
}) : Promise<ContractTransactionReceipt | null> => {
  const supplyBefore = await zns.domainToken.totalSupply();

  const tx = await (zns.rootRegistrar as ZNSRootRegistrarTrunk).connect(user).registerRootDomain(
    domainName,
    domainContent, // Arbitrary address value
    tokenURI,
    distrConfig,
    paymentConfigEmpty
  );

  const receipt = await tx.wait(getConfirmationsNumber());

  const supplyAfter = await zns.domainToken.totalSupply();
  expect(supplyAfter).to.equal(supplyBefore + BigInt(1));

  return receipt;
};

export const approveForDomain = async ({
  zns,
  parentHash,
  user,
  tokenHolder,
  domainLabel,
  isBridging = false,
} : {
  zns : IZNSContractsLocal | IZNSContracts;
  parentHash : string;
  user : SignerWithAddress;
  tokenHolder ?: SignerWithAddress;
  domainLabel : string;
  isBridging ?: boolean;
}) => {
  const { token: tokenAddress } = await zns.treasury.paymentConfigs(parentHash);

  if (tokenAddress === ZeroAddress) {
    console.log("No token set for parent domain. Proceeding without approval.");
    return;
  }

  const { pricerContract } = await zns.subRegistrar.distrConfigs(parentHash);
  let price = BigInt(0);
  let parentFee = BigInt(0);
  if (pricerContract === await zns.curvePricer.getAddress() || parentHash === ethers.ZeroHash) {
    [price, parentFee] = await zns.curvePricer.getPriceAndFee(parentHash, domainLabel, false);
  } else if (pricerContract === await zns.fixedPricer.getAddress()) {
    [price, parentFee] = await zns.fixedPricer.getPriceAndFee(parentHash, domainLabel, false);
  }

  const tokenContract = getTokenContract(tokenAddress, user);

  const protocolFee = await zns.curvePricer.getFeeForPrice(ethers.ZeroHash, price + parentFee);
  const toApprove = price + parentFee + protocolFee;

  const confNum = getConfirmationsNumber();

  const userBal = await tokenContract.balanceOf(user.address);
  if (userBal < toApprove) {
    const tx = await tokenContract.connect(tokenHolder).transfer(user.address, toApprove);
    await tx.wait(confNum);
  }

  const spender = isBridging
    ? await (zns.zChainPortal as ZNSZChainPortal).getAddress()
    : await zns.treasury.getAddress();
  const tx = await tokenContract.connect(user).approve(spender, toApprove);
  await tx.wait(confNum);
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
  zns : IZNSContractsLocal | IZNSContracts;
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

  await tx.wait(getConfirmationsNumber());

  const supplyAfter = await zns.domainToken.totalSupply();
  expect(supplyAfter).to.equal(supplyBefore + BigInt(1));
};

export const defaultBridgingRegistration = async ({
  zns,
  user,
  parentHash = ethers.ZeroHash,
  domainLabel,
  tokenURI = DEFAULT_TOKEN_URI,
} : {
  zns : IZNSContractsLocal | IZNSContracts;
  user : SignerWithAddress;
  parentHash ?: string;
  domainLabel : string;
  tokenURI ?: string;
}) => {
  const tx = await zns.zChainPortal.connect(user).registerAndBridgeDomain(
    parentHash,
    domainLabel,
    tokenURI
  );

  await tx.wait(getConfirmationsNumber());
};

export const registrationWithSetup = async ({
  zns,
  user,
  tokenHolder,
  parentHash,
  domainLabel,
  domainContent = user.address,
  tokenURI = DEFAULT_TOKEN_URI,
  fullConfig = fullDistrConfigEmpty,
  setConfigs = true,
  bridgeDomain = false,
} : {
  zns : IZNSContractsLocal | IZNSContracts;
  user : SignerWithAddress;
  tokenHolder ?: SignerWithAddress;
  parentHash ?: string;
  domainLabel : string;
  domainContent ?: string;
  tokenURI ?: string;
  fullConfig ?: IFullDistributionConfig;
  setConfigs ?: boolean;
  bridgeDomain ?: boolean;
}) => {
  const hasConfig = !!fullConfig;
  const distrConfig = hasConfig
    ? fullConfig.distrConfig
    : distrConfigEmpty;

  parentHash = parentHash || ethers.ZeroHash;

  await approveForDomain({
    zns,
    parentHash,
    user,
    tokenHolder,
    domainLabel,
    isBridging: bridgeDomain,
  });

  if (bridgeDomain) {
    await defaultBridgingRegistration({
      zns,
      user,
      parentHash,
      domainLabel,
      tokenURI,
    });
  } else {
    // register domain
    if (parentHash === ethers.ZeroHash) {
      await defaultRootRegistration({
        user,
        zns,
        domainName: domainLabel,
        domainContent,
        tokenURI,
        distrConfig,
      });
    } else {
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
  }

  // get hash
  const domainHash = await getDomainHashFromEvent({
    zns,
    registrantAddress: user.address,
  });

  if (!hasConfig) return domainHash;

  const confNum = getConfirmationsNumber();

  // set up prices
  if (fullConfig.distrConfig.pricerContract === await zns.fixedPricer.getAddress() && setConfigs) {
    const tx = await zns.fixedPricer.connect(user).setPriceConfig(
      domainHash,
      {
        ...fullConfig.priceConfig as IFixedPriceConfig,
        isSet: true,
      },
    );
    await tx.wait(confNum);
  } else if (fullConfig.distrConfig.pricerContract === await zns.curvePricer.getAddress() && setConfigs) {
    const tx = await zns.curvePricer.connect(user).setPriceConfig(
      domainHash,
      {
        ...fullConfig.priceConfig as ICurvePriceConfig,
        isSet: true,
      },
    );
    await tx.wait(confNum);
  }

  if (fullConfig.paymentConfig.token !== ZeroAddress && setConfigs) {
    // set up payment config
    const tx = await zns.treasury.connect(user).setPaymentConfig(
      domainHash,
      fullConfig.paymentConfig,
    );
    await tx.wait(confNum);
  }

  return domainHash;
};
