import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { DomainData, RegisteredDomain, Domain } from "./types";
import { IZNSContracts } from "../../deploy/campaign/types";
import { distrConfigEmpty, paymentConfigEmpty } from "../../../test/helpers";
import { IZNSContractsLocal } from "../../../test/helpers/types";
import { ContractTransactionReceipt } from "ethers";


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
      tx = await zns.rootRegistrar.connect(regAdmin).registerRootDomainBulk(
        labels,
        domainAddresses,
        tokenURIs,
        distrConfigEmpty, // TODO what should this be? stake vs, direct should be upheld maybe?
        paymentConfigEmpty,
      );
    } else {
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
    console.log("Error registering domain: ", e);
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
  const domainHashes = Array<string>();

  // A root registration creates 9 logs and a subdomain registration creates 6,
  // and we can get the domainhash from the last log in both to only read relevant events
  // This accounts for the difference in size to be able to read the
  // domain hash from the `DomainRegistered` event correctly in bulk txs
  let i = 0;
  let inc = 0;
  if (parentHashes[0] === hre.ethers.ZeroHash) {
    i = 8; // 0 based, the index to query of a log
    inc = 9; // 1 based, the number of logs per registration
  } else {
    i = 5;
    inc = 6;
  }

  for (i; i <= txReceipt!.logs.length; i += inc) {
    const domainHash = txReceipt!.logs[i].topics[2];
    domainHashes.push(domainHash);
  }

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
