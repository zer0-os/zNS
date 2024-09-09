import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { RegisteredDomains, Domain } from "./types";
import { IZNSContracts } from "../../deploy/campaign/types";
import { paymentConfigEmpty } from "../../../test/helpers";
import { IZNSContractsLocal } from "../../../test/helpers/types";
import { DOMAIN_REGISTERED_TOPIC_SEPOLIA } from "./constants";


export const registerDomainsBulk = async (
  regAdmin : SignerWithAddress,
  domains : Array<Domain>, // imagine this is ALL domains
  zns : IZNSContracts,
  sliceSize : number,
  start ?: number,
) => {
  const registeredDomains = Array<RegisteredDomains>();

  // 'start' is used for retry logic and represents the number of domains
  // we have already minted
  let isStart = start ? start : 0;

  // The number of iterations to do based on the size of the incoming domain array
  const numIters = Math.floor((domains.length - isStart) / sliceSize);

  // Because the terminator represents the *total* number of domains to register,
  // we add `isStart` back in
  const terminator = isStart + (sliceSize * numIters);

  for (let i = isStart; i < terminator; i += sliceSize) {
    const { domainHashes, txHash, retryData } = await registerBase({
      regAdmin,
      zns,
      domains: domains.slice(i, i + sliceSize)
    })

    if (retryData) {
      throw new Error("??? handle")
    }
    registeredDomains.push({ domainHashes, txHash });

    isStart += domainHashes.length;

    console.log("Registered domains: ", isStart);
  };

  // Do last set of domains as well
  const { domainHashes, txHash, retryData } = await registerBase({
    regAdmin,
    zns,
    domains: domains.slice(terminator) // terminator -> end of array
  })

  if (retryData) {
    throw new Error("???")
  }

  console.log("Registered domains: ", isStart + domainHashes.length);

  registeredDomains.push({ domainHashes, txHash });

  return registeredDomains;
};

export const registerBase = async ({
  zns,
  regAdmin,
  domains
} : {
  zns : IZNSContractsLocal | IZNSContracts;
  regAdmin : SignerWithAddress;
  domains : Array<Domain>;
}) => {
  let tx;

  // console.log("DEBUG");

  const owners = domains.map((domain) => { return domain.owner.id });
  const parentHashes = domains.map((domain) => { return domain.parentHash });
  const labels = domains.map((domain) => { return domain.label });
  const domainAddresses = domains.map((domain) => {return domain.address });
  const tokenURIs = domains.map((domain) => { return domain.tokenURI });

  try {
    // Because we pre-filter using the query into sets of just root domains and just subdomains
    // (ordered by depth) we know with certainty that if one parent hash is zero, they all are
    if (parentHashes[0] === hre.ethers.ZeroHash) {

      // It is by intention that we aren't recreating user configs
      // We are just focusing on recreating the domain tree
      tx = await zns.rootRegistrar.connect(regAdmin).registerRootDomainBulk(
        owners,
        labels,
        domainAddresses,
        tokenURIs,
        {
          pricerContract: hre.ethers.ZeroAddress,
          paymentType: 0n, // Direct, but dont use
          accessType: 1n, // Open
        },
        paymentConfigEmpty,
      );
    } else {
      const bulkMigrationArgs = {
        domainToken: await zns.domainToken.getAddress(),
        owners: owners,
        parentHashes: parentHashes,
        labels: labels,
        domainAddresses: domainAddresses,
        tokenURIs: tokenURIs,
      };
      const distConfig = {
        pricerContract: hre.ethers.ZeroAddress,
        paymentType: 0n, // Direct, but dont use
        accessType: 1n, // Open
      };

      tx = await zns.subRegistrar.connect(regAdmin).registerSubdomainBulk(
        bulkMigrationArgs,
        distConfig,
        paymentConfigEmpty,
      );
    }
  } catch (e) {
    console.log("Error registering domains: ", e);
    // Return the domainData if something failed so we can log it
    // for debugging purposes
    return {
      domainHash: undefined,
      txHash: undefined,
      retryData: domains
    }
  }

  // Providing a number on hardhat will cause it to hang
  const blocks = hre.network.name === "hardhat" ? 0 : 5;
  const txReceipt = await tx!.wait(blocks);

  if (!txReceipt) {
    // Could this ever happen? Need this so downstream return states are never undefined
    throw new Error("Transaction succeeded without receipt");
  }

  // Collected the registered domains
  let domainHashes = Array<string>();

  const drEvents = txReceipt.logs.filter((log) => {
    if (log.topics[0] === DOMAIN_REGISTERED_TOPIC_SEPOLIA) {
      return log.topics[1]; // domainHash is always index 1 in this log
    }
  })
  // console.log(`DREVENTS: ${drEvents.length}`);

  drEvents.forEach((log) => {
    domainHashes.push(log.topics[1]);
  });

  // console.log(`DOMAINHASHES: ${domainHashes.length}`);

  // console.log(txReceipt.hash);

  return { domainHashes, txHash: txReceipt.hash, retryData: undefined };
};


export const postMigrationValidation = async (
  zns : IZNSContractsLocal | IZNSContracts,
  registeredDomains : Array<RegisteredDomain>,
) => {
  // TODO impl
  // if local, reset network again to start forking
  // but when we reset network we lose the local data?
      // unless we write to file again and read for validation?
  // then can compare mainnet values
  // expect(domainHash).to.not.equal(hre.ethers.ZeroHash);
  // expect(await zns.registry.exists(domainHash)).to.be.true;
  // expect(await zns.registry.getDomainOwner(domainHash)).to.equal(regAdmin.address);
  // expect(await zns.domainToken.ownerOf(BigInt(domainHash))).to.equal(regAdmin.address);
}
