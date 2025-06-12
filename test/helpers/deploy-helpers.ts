
// For use in inegration test of deployment campaign
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSCampaignConfig, IZNSContracts } from "../../src/deploy/campaign/types";
import { ethers } from "ethers";
import { IDistributionConfig, IZNSContractsLocal } from "./types";
import { expect } from "chai";
import { DEFAULT_CURVE_PRICE_CONFIG_BYTES, hashDomainLabel, paymentConfigEmpty } from ".";
import { TLogger } from "@zero-tech/zdc";


export const approveBulk = async (
  signers : Array<SignerWithAddress>,
  zns : IZNSContractsLocal | IZNSContracts,
) => {
  for (const signer of signers) {
    // if (hre.network.name === "hardhat") {
    const hasApproval = await zns.meowToken.allowance(signer.address, await zns.treasury.getAddress());

    // To avoid resending the approval repeatedly we first check the allowance
    if (hasApproval === BigInt(0)) {
      const tx = await zns.meowToken.connect(signer).approve(
        await zns.treasury.getAddress(),
        ethers.MaxUint256,
      );

      await tx.wait();
    }
  }
};

export const mintBulk = async (
  signers : Array<SignerWithAddress>,
  amount : bigint,
  zns : IZNSContractsLocal | IZNSContracts,
) => {
  for (const signer of signers) {
    await zns.meowToken.connect(signer).mint(
      signer.address,
      amount
    );
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

    let config : string;

    if (parent === ethers.ZeroHash) {
      // roots
      config = await zns.rootRegistrar.rootPriceConfig();
      const price = await zns.curvePricer.getPrice(config, domain, true);

      const protocolFee = await zns.curvePricer.getFeeForPrice(config, price);
      prices.push(price + protocolFee);

    } else {
      // subs
      config = await (await zns.subRegistrar.distrConfigs(parent)).priceConfig;
      const price = await zns.curvePricer.getPrice(config, domain, true);

      const stakeFee = await zns.curvePricer.getFeeForPrice(config, price);
      const protocolFee = await zns.curvePricer.getFeeForPrice(config, price + stakeFee);
      prices.push(price + stakeFee + protocolFee);
    }

    index++;
  }

  return prices;
};

export const registerRootDomainBulk = async (
  signers : Array<SignerWithAddress>,
  domains : Array<string>,
  config : IZNSCampaignConfig,
  tokenUri : string,
  distrConfig : IDistributionConfig,
  zns : IZNSContractsLocal | IZNSContracts,
  logger : TLogger,
) : Promise<void> => {
  let index = 0;

  for(const domain of domains) {
    const balanceBefore = await zns.meowToken.balanceOf(signers[index].address);
    const tx = await zns.rootRegistrar.connect(signers[index]).registerRootDomain({
      name: domain,
      domainAddress: config.zeroVaultAddress,
      tokenURI: `${tokenUri}${index}`,
      tokenOwner: signers[index],
      distrConfig,
      paymentConfig: {
        token: await zns.meowToken.getAddress(),
        beneficiary: config.zeroVaultAddress,
      },
    });

    logger.info("Deploy transaction submitted, waiting...");
    if (hre.network.name !== "hardhat") {
      await tx.wait(3);
      logger.info(`Registered '${domain}' for ${signers[index].address} at tx: ${tx.hash}`);
    }

    const balanceAfter = await zns.meowToken.balanceOf(signers[index].address);
    const [price, protocolFee] = await zns.curvePricer.getPriceAndFee(distrConfig.priceConfig, domain, true);
    expect(balanceAfter).to.be.eq(balanceBefore - price - protocolFee);

    const domainHash = hashDomainLabel(domain);
    expect(await zns.registry.exists(domainHash)).to.be.true;

    await zns.subRegistrar.connect(signers[index]).setPricerDataForDomain(
      domainHash,
      DEFAULT_CURVE_PRICE_CONFIG_BYTES,
      zns.curvePricer.target
    );

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
    const balanceBefore = await zns.meowToken.balanceOf(signers[index].address);
    const tx = await zns.subRegistrar.connect(signers[index]).registerSubdomain({
      parentHash: parents[index],
      label: subdomain,
      domainAddress,
      tokenOwner: hre.ethers.ZeroAddress,
      tokenURI: `${tokenUri}${index}`,
      distrConfig: distConfig,
      paymentConfig: paymentConfigEmpty,
    });

    logger.info("Deploy transaction submitted, waiting...");

    if (hre.network.name !== "hardhat") {
      await tx.wait(3);
      logger.info(`registered '${subdomain}' for ${signers[index].address} at tx: ${tx.hash}`);
    }

    const balanceAfter = await zns.meowToken.balanceOf(signers[index].address);

    const owner = await zns.registry.getDomainOwner(parents[index]);
    if (signers[index].address === owner) {
      expect(balanceAfter).to.be.eq(balanceBefore);
    } else {
      const parentConfig = (await zns.subRegistrar.distrConfigs(parents[index])).priceConfig;

      const [price, stakeFee] = await zns.curvePricer.getPriceAndFee(parentConfig, subdomain, true);
      const protocolFee = await zns.curvePricer.getFeeForPrice(DEFAULT_CURVE_PRICE_CONFIG_BYTES, price + stakeFee);

      expect(balanceAfter).to.be.eq(balanceBefore - price - stakeFee - protocolFee);
    }

    expect(await zns.registry.exists(subdomainHashes[index])).to.be.true;

    index++;
  }
};
