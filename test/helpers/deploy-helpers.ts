
// For use in inegration test of deployment campaign

import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TZNSContractState } from "../../src/deploy/campaign/types";
import { ethers } from "ethers";
import { IDistributionConfig } from "./types";
import { expect } from "chai";
import { hashDomainLabel } from ".";
import { getDomainHashFromEvent } from "./events";
import { ICurvePriceConfig } from "../../src/deploy/missions/types";

export const approveBulk = async (
  signers : Array<SignerWithAddress>,
  zns : TZNSContractState,
) => {
  for (const signer of signers) {
    const tx = await zns.meowToken.connect(signer).approve(
      await zns.treasury.getAddress(),
      ethers.MaxUint256,
    );

    await tx.wait(); // hang on hardhat?
  }
};

export const mintBulk = async (
  signers : Array<SignerWithAddress>,
  amount : bigint,
  zns : TZNSContractState,
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
  zns : TZNSContractState,
  parentHashes : Array<string> = [],
  includeProtocolFee  = false,
) => {
  let index = 0;
  const prices = [];

  for (const domain of domains) {
    const parent = parentHashes[index] ? parentHashes[index] : ethers.ZeroHash;

    const { price, stakeFee } = await zns.curvePricer.getPriceAndFee(
      parent,
      domain,
      true,
    );

    const priceWithFee = price + stakeFee;

    if (includeProtocolFee) {
      const protocolFee = await zns.curvePricer.getFeeForPrice(ethers.ZeroHash, priceWithFee);

      prices.push(priceWithFee + protocolFee);
    } else {
      prices.push(priceWithFee);
    }


    index++;
  }

  return prices;
};

export const registerRootDomainBulk = async (
  signers : Array<SignerWithAddress>,
  domains : Array<string>,
  domainAddress : string,
  tokenUri : string,
  distConfig : IDistributionConfig,
  priceConfig : ICurvePriceConfig,
  zns : TZNSContractState,
) : Promise<void> => {
  let index = 0;

  for(const domain of domains) {
    await zns.rootRegistrar.connect(signers[index]).registerRootDomain(
      domain,
      domainAddress,
      `${tokenUri}${index}`,
      distConfig
    );

    const domainHash = hashDomainLabel(domain);
    expect(await zns.registry.exists(domainHash)).to.be.true;

    // To mint subdomains from this domain we must first set the price config and the payment config
    await zns.curvePricer.connect(signers[index]).setPriceConfig(domainHash, priceConfig);
    await zns.treasury.connect(signers[index]).setPaymentConfig(domainHash, {
      token: await zns.meowToken.getAddress(),
      beneficiary: signers[index].address,
    });

    index++;
  }
};

export const registerSubdomainBulk = async (
  signers : Array<SignerWithAddress>,
  parents : Array<string>,
  subdomains : Array<string>,
  domainAddress : string,
  tokenUri : string,
  distConfig : IDistributionConfig,
  zns : TZNSContractState,
) => {
  let index = 0;

  for (const subdomain of subdomains) {
    await zns.subRegistrar.connect(signers[index]).registerSubdomain(
      parents[index],
      subdomain,
      domainAddress,
      `${tokenUri}${index}`,
      distConfig
    );

    const subdomainHash = await getDomainHashFromEvent({ zns, user: signers[index] });
    expect(await zns.registry.exists(subdomainHash)).to.be.true;

    index++;
  }
};