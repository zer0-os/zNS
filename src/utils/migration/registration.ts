import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { RegisteredDomains, Domain } from "./types";
import { validateDomain } from "./validate";
import { ZeroAddress } from "ethers";
import { IZNSContracts } from "../../../test/helpers/types";

// We will need to adjust this file in the future no matter what after merging happens
// ignore this file for now
/* eslint-disable */
/* @typescript-eslint-disable */

export const registerDomainsBulk = async (
  regAdmin : SignerWithAddress,
  domains : Array<Domain>, // imagine this is ALL domains
  zns :   IZNSContracts,
  sliceSize : number,
  start : number,
) => {
  const registeredDomains = Array<RegisteredDomains>();

  // 'start' is used for retry logic and represents the number of domains
  // we have already minted

  // The number of iterations to do based on the size of the incoming domain array
  const numIters = Math.floor((domains.length - start) / sliceSize);

  // Because the terminator represents the *total* number of domains to register,
  // we add `isStart` back in
  const terminator = start + (sliceSize * numIters);

  for (let i = start; i < terminator; i += sliceSize) {
    const domainsForTx = domains.slice(i, i + sliceSize);

    // If the domain hash is already in the registry we have already registered this
    // batch of domains, so we skip it
    if (!await zns.registry.exists(domainsForTx[0].id)) {
      const { domainHashes, txHash, retryData } = await registerBase({
        regAdmin,
        zns,
        domains: domains.slice(i, i + sliceSize),
      });

      if (retryData) {
        throw new Error("Error in registering domains");
      }

      registeredDomains.push({ domainHashes, txHash });

      console.log("Registered domains: ", i + sliceSize);
    } else {
      console.log(`Skipping already registered domains: ${i} to ${i + sliceSize}}`);
    }
  }

  // In the likely case that the list of domains is not divisble by slice size, we
  // want to make sure we do the last set of domains as well
  const { domainHashes, txHash, retryData } = await registerBase({
    regAdmin,
    zns,
    domains: domains.slice(terminator), // terminator -> end of array
  });

  if (retryData) {
    throw new Error("Error in registering domains");
  }

  console.log("Registered additional domains: ", start + domainHashes.length);

  registeredDomains.push({ domainHashes, txHash });

  return registeredDomains;
};

export const registerBase = async ({
  zns,
  regAdmin,
  domains,
} : {
  zns : IZNSContracts;
  regAdmin : SignerWithAddress;
  domains : Array<Domain>;
}) => {

  const tokenOwners = domains.map(domain => {
    if (domain.domainToken.owner.id === hre.ethers.ZeroAddress) {
      // The ERC721 token has been burned, must mint with the record owner instead
      // to recreate the tree fully
      return domain.owner.id;
    } else {
      return domain.domainToken.owner.id;
    }
  });

  const distConfigs = domains.map(domain => {
    const config = {
      pricerContract: "",
      paymentType: 0n,
      accessType: 1n, // Always use `open` access type for migration
    };

    // Get pricer contract
    if (!domain.pricerContract) {
      config.pricerContract = ZeroAddress;
    } else {
      config.pricerContract = domain.pricerContract;
    }

    // Get payment type
    if (!domain.paymentType || domain.paymentType === "0") {
      config.paymentType = 0n;
    } else {
      config.paymentType = 1n;
    }

    return config;
  });

  // Awaiting this promise within the `map` function below causes type problems
  // when passing args to the function downstream. This is a workaround.
  const tokenAddress = await zns.meowToken.getAddress();

  const paymentConfigs = domains.map(domain => ({
    beneficiary: !domain.treasury.beneficiaryAddress
      ? ZeroAddress
      : domain.treasury.beneficiaryAddress,
    token: tokenAddress,
  }));

  const recordOwners = domains.map(domain => domain.owner.id);
  const parentHashes = domains.map(domain => domain.parentHash);
  const labels = domains.map(domain => domain.label);
  const domainAddresses = domains.map(domain => domain.address);
  const tokenURIs = domains.map(domain => domain.tokenURI);

  let tx;

  try {
    // Because we pre-filter using the query into sets of just root domains and just subdomains
    // (ordered by depth) we know with certainty that if one parent hash is zero, they all are
    if (parentHashes[0] === hre.ethers.ZeroHash) {

      const bulkMigrationArgs = {
        tokenOwners,
        recordOwners,
        names: labels,
        domainAddresses,
        tokenURIs,
        distributionConfigs: distConfigs,
        paymentConfigs,
      };

      // It is by intention that we aren't recreating user configs
      // We are just focusing on recreating the domain tree
      tx = await zns.rootRegistrar.connect(regAdmin).registerRootDomainBulk(
        bulkMigrationArgs,
        // {
        //   gasLimit: 5000000 // TODO for debugging
        // }
      );
    } else {
      const bulkMigrationArgs = {
        domainToken: await zns.domainToken.getAddress(),
        tokenOwners,
        recordOwners,
        parentHashes,
        labels,
        domainAddresses,
        tokenURIs,
        distributionConfigs: distConfigs,
        paymentConfigs,
      };

      tx = await zns.subRegistrar.connect(regAdmin).registerSubdomainBulk(
        bulkMigrationArgs
      );
    }
  } catch (e) {
    console.log("Error registering domains: ", e);
    // Return the domainData if something failed so we can log it
    // for debugging purposes
    return {
      domainHash: undefined,
      txHash: undefined,
      retryData: domains,
    };
  }

  // Providing a number on hardhat will cause it to hang
  const blocks = hre.network.name === "hardhat" ? 0 : 5;
  const txReceipt = await tx.wait(blocks);

  if (!txReceipt) {
    // Could this ever happen? Need this so downstream return states are never undefined
    throw new Error("Transaction succeeded without receipt");
  }

  // Collected the registered domains
  const domainHashes = Array<string>();

  const drEvents = txReceipt.logs.filter(log => {
    if (log.topics[0] === DOMAIN_REGISTERED_TOPIC_SEPOLIA) {
      return log.topics[1]; // domainHash is always index 1 in this log
    }
  });
  // console.log(`DREVENTS: ${drEvents.length}`);

  drEvents.forEach(log => {
    domainHashes.push(log.topics[1]);
  });

  // console.log(`DOMAINHASHES: ${domainHashes.length}`);

  // console.log(txReceipt.hash);

  return { domainHashes, txHash: txReceipt.hash, retryData: undefined };
};

export const postMigrationValidation = async (
  zns : IZNSContractsLocal | IZNSContracts,
  domains : Array<Domain>,
) => {

  // TODO figure out error with users who have not called to reclaim there domain
  // after a transfer
  for (const domain of domains) {
    const error = await validateDomain(domain, zns, true);

    if (error) {
      console.log("Error validating domain: ", error);
    }
  }
};
