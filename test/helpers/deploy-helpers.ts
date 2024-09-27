
// For use in inegration test of deployment campaign
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSCampaignConfig, IZNSContracts } from "../../src/deploy/campaign/types";
import { ethers } from "ethers";
import { IDistributionConfig, IZNSContractsLocal } from "./types";
import { expect } from "chai";
import { hashDomainLabel, paymentConfigEmpty } from ".";
import { ICurvePriceConfig } from "../../src/deploy/missions/types";
import { TLogger } from "@zero-tech/zdc";

export const approveBulk = async (
  signers : Array<SignerWithAddress>,
  zns : IZNSContractsLocal | IZNSContracts,
) => {
  for (const signer of signers) {
    // if (hre.network.name === "hardhat") {
    const hasApproval = await zns.zToken.allowance(signer.address, await zns.treasury.getAddress());

    // To avoid resending the approval repeatedly we first check the allowance
    if (hasApproval === BigInt(0)) {
      const tx = await zns.zToken.connect(signer).approve(
        await zns.treasury.getAddress(),
        ethers.MaxUint256,
      );

      await tx.wait();
    }
  }
};

export const transferBulk = async (
  users : Array<SignerWithAddress>,
  admin : SignerWithAddress,
  amount : bigint,
  zns : IZNSContractsLocal | IZNSContracts,
) => {
  for (const user of users) {
    await zns.zToken.connect(admin).transfer(user.address, amount);
  }
};

export const getPriceBulk = async (
  domains : Array<string>,
  zns : IZNSContractsLocal | IZNSContracts,
  parentHashes ?: Array<string>,
) => {
  let index = 0;
  const prices = [];

  for (const domain of domains) {
    let parent;
    if (parentHashes) {
      parent = parentHashes[index];
    } else {
      parent = ethers.ZeroHash;
    }

    // temp, can do one call `getPRiceAndFee` but debugging where failure occurs
    const price = await zns.curvePricer.getPrice(parent, domain, true);
    const stakeFee = await zns.curvePricer.getFeeForPrice(parent, price);

    // TODO fix this to be one if statement
    if (parentHashes) {
      const protocolFee = await zns.curvePricer.getFeeForPrice(ethers.ZeroHash, price + stakeFee);

      prices.push(price + stakeFee + protocolFee);
    } else {
      const protocolFee = await zns.curvePricer.getFeeForPrice(ethers.ZeroHash, price);

      prices.push(price + protocolFee);
    }


    index++;
  }

  return prices;
};

export const registerRootDomainBulk = async (
  signers : Array<SignerWithAddress>,
  domains : Array<string>,
  config : IZNSCampaignConfig<SignerWithAddress>,
  tokenUri : string,
  distConfig : IDistributionConfig,
  priceConfig : ICurvePriceConfig,
  zns : IZNSContractsLocal | IZNSContracts,
  logger : TLogger,
) : Promise<void> => {
  let index = 0;

  for(const domain of domains) {
    const balanceBefore = await zns.zToken.balanceOf(signers[index].address);
    const tx = await zns.rootRegistrar.connect(signers[index]).registerRootDomain(
      domain,
      config.zeroVaultAddress,
      `${tokenUri}${index}`,
      distConfig,
      {
        token: await zns.zToken.getAddress(),
        beneficiary: config.zeroVaultAddress,
      }
    );
    logger.info("Deploy transaction submitted, waiting...");
    if (hre.network.name !== "hardhat") {
      await tx.wait(3);
      logger.info(`Registered '${domain}' for ${signers[index].address} at tx: ${tx.hash}`);
    }

    const balanceAfter = await zns.zToken.balanceOf(signers[index].address);
    const [price, protocolFee] = await zns.curvePricer.getPriceAndFee(ethers.ZeroHash, domain, true);
    expect(balanceAfter).to.be.eq(balanceBefore - price - protocolFee);

    const domainHash = hashDomainLabel(domain);
    expect(await zns.registry.exists(domainHash)).to.be.true;

    // TODO figure out if we want to do this on prod?
    // To mint subdomains from this domain we must first set the price config and the payment config
    await zns.curvePricer.connect(signers[index]).setPriceConfig(domainHash, priceConfig);

    index++;
  }
};

export const registerSubdomainBulk = async (
  signers : Array<SignerWithAddress>,
  parents : Array<string>,
  subdomains : Array<string>,
  subdomainHashes : Array<string>,
  domainAddress : string,
  tokenUri : string,
  distConfig : IDistributionConfig,
  zns : IZNSContractsLocal | IZNSContracts,
  logger : TLogger,
) => {
  let index = 0;

  for (const subdomain of subdomains) {
    const balanceBefore = await zns.zToken.balanceOf(signers[index].address);
    const tx = await zns.subRegistrar.connect(signers[index]).registerSubdomain(
      parents[index],
      subdomain,
      domainAddress,
      `${tokenUri}${index}`,
      distConfig,
      paymentConfigEmpty
    );

    logger.info("Deploy transaction submitted, waiting...");

    if (hre.network.name !== "hardhat") {
      await tx.wait(3);
      logger.info(`registered '${subdomain}' for ${signers[index].address} at tx: ${tx.hash}`);
    }

    const balanceAfter = await zns.zToken.balanceOf(signers[index].address);

    const owner = await zns.registry.getDomainOwner(parents[index]);
    if (signers[index].address === owner) {
      expect(balanceAfter).to.be.eq(balanceBefore);
    } else {
      const [price, stakeFee] = await zns.curvePricer.getPriceAndFee(parents[index], subdomain, true);
      const protocolFee = await zns.curvePricer.getFeeForPrice(ethers.ZeroHash, price + stakeFee);

      expect(balanceAfter).to.be.eq(balanceBefore - price - stakeFee - protocolFee);
    }


    expect(await zns.registry.exists(subdomainHashes[index])).to.be.true;

    index++;
  }
};