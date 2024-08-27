import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { DomainData, RegisteredDomain, Domain } from "./types";
import { IZNSContracts } from "../../deploy/campaign/types";
import { distrConfigEmpty, paymentConfigEmpty } from "../../../test/helpers";
import { IZNSContractsLocal } from "../../../test/helpers/types";
import { ContractTransactionReceipt } from "ethers";
import { DOMAIN_REGISTERED_TOPIC_SEPOLIA } from "./constants";


export const registerDomainsLocal = async (
  migrationAdmin : SignerWithAddress,
  domains : Array<Domain>,
  zns : IZNSContractsLocal,
) => {
  // Give minter balance and approval for registrations
  await zns.meowToken.connect(migrationAdmin).mint(migrationAdmin.address, hre.ethers.parseEther("99999999999999999999"));
  await zns.meowToken.connect(migrationAdmin).approve(await zns.treasury.getAddress(), hre.ethers.MaxUint256);

  const registeredDomains = await registerDomains({
    regAdmin: migrationAdmin,
    zns,
    domains,
  });

  return registeredDomains;
};

export const registerDomains = async ({
  regAdmin,
  zns,
  domains,
} : {
  regAdmin : SignerWithAddress;
  zns : IZNSContracts;
  domains : Array<Domain>
}) => {
  // When domains fail they are added to this array to retry
  // after all other domains have been attempted
  // TODO impl retry

  const retryDomains = Array<Domain>();

  const { domainHashes, txReceipt, retryData } = await registerBase({
    regAdmin,
    zns,
    domains
  });

    if (retryData) {
      console.log("failed? why?")
      throw new Error("Failed to register domains");
      // TODO impl, this could fail because of external reasons
      // we need to track to know exactly where we failed and where to start again
      // also we need to know why because maybe it will happen again
    }

  if (retryData) {
    // TODO impl retry logic
    // Have to record how many TXs we've done and have a standard number of domains to register per tx
    // this way we can calculate where to begin again
    // if we 10 sets of 50 domains each and the 11th failed, we know we can skip 500 domains 
  }

  return { domainHashes, txReceipt }
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

  const parentHashes = domains.map((domain) => { return domain.parentHash });
  const labels = domains.map((domain) => { return domain.label });
  const domainAddresses = domains.map((domain) => {return domain.address });
  const tokenURIs = domains.map((domain) => { return domain.tokenURI });

  try {
    // Because we pre-filter using the query into sets of just root domains and just subdomains
    // (ordered by depth) we know with certainty that if one parent hash is zero, they all are
    if (parentHashes[0] === hre.ethers.ZeroHash) {
      // We aren't setting configs intentionally.
      console.log("Registering root domains");
      tx = await zns.rootRegistrar.connect(regAdmin).registerRootDomainBulk(
        labels,
        domainAddresses,
        tokenURIs,
        distrConfigEmpty, // TODO what should this be? stake vs, direct should be upheld maybe?
        paymentConfigEmpty,
      );
    } else {
      console.log("Registering subdomains");
      tx = await zns.subRegistrar.connect(regAdmin).registerSubdomainBulk(
        parentHashes,
        labels,
        domainAddresses,
        tokenURIs,
        distrConfigEmpty,
        paymentConfigEmpty,
      );
    }
  } catch (e) {
    console.log("Error registering domains: ", e);
    // Return the domainData if something failed so we can log it
    // for debugging purposes
    return {
      domainHash: undefined,
      txReceipt: undefined,
      domainData: domains
    }
  }

  // Providing a number on hardhat will cause it to hang
  const blocks = hre.network.name === "hardhat" ? 0 : 10;
  const txReceipt = await tx!.wait(blocks);

  // Collected the registered domains
  let domainHashes = Array<string>();

  const drEvents = txReceipt!.logs.filter((log) => {
    if (log.topics[0] === DOMAIN_REGISTERED_TOPIC_SEPOLIA) {
      return log.topics[1]; // domainHash is always index 1 in this log
    }
  })
  console.log(`DREVENTS: ${drEvents.length}`);

  drEvents.forEach((log) => {
    domainHashes.push(log.topics[1]);
  });

  console.log(`DOMAINHASHES: ${domainHashes.length}`);

  return { domainHashes, txReceipt, retryData: undefined };
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
