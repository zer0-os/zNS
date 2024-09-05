import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { DomainData, RegisteredDomains, Domain } from "./types";
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

  // const registeredDomains = await registerDomains({
  //   regAdmin: migrationAdmin,
  //   zns,
  //   domains,
  // });

  // return registeredDomains;
};

export const registerDomainsBulk = async (
  regAdmin : SignerWithAddress,
  domains : Array<Domain>, // imagine this is ALL domains
  zns : IZNSContracts,
  sliceSize : number,
  start ?: number, // If we have already minted some domains
) => {
  const registeredDomains = Array<RegisteredDomains>();

  // If not 0 will be the number of domains already minted
  const isStart = start ? start : 0;
  const numIters = Math.floor((domains.length - isStart) / sliceSize);

  // Because the terminator represents the *total* number of domains to register,
  // we add `isStart` back in
  const terminator = isStart + (sliceSize * numIters);


  for (let i = isStart; i < terminator; i += sliceSize) {
    // const d = domains.slice(i, i + sliceSize)
    // console.log(`i: ${i}`)
    // console.log(`isStart: ${isStart}`)
    // console.log(`terminator: ${terminator}`)
    // console.log(`sliceSize: ${sliceSize}`)
    // d.forEach((domain) => { console.log(domain.label) });
    const { domainHashes, txHash, retryData } = await registerBase({
      regAdmin,
      zns,
      domains: domains.slice(i, i + sliceSize)
    })

    if (retryData) {
      throw new Error("??? handle")
    }

    registeredDomains.push({ domainHashes, txHash });
  };

  // Do last set of domains as well
  const { domainHashes, txHash, retryData } = await registerBase({
    regAdmin,
    zns,
    domains: domains.slice(terminator) // until end of array
  })

  if (retryData) {
    throw new Error("???")
  }

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

  // 100000 000000000 000000000
  try {
    // Because we pre-filter using the query into sets of just root domains and just subdomains
    // (ordered by depth) we know with certainty that if one parent hash is zero, they all are
    if (parentHashes[0] === hre.ethers.ZeroHash) {

      // console.log(await zns.rootRegistrar.getAddress());
      // We aren't setting configs intentionally.
      // console.log(`Registering ${domains.length} root domains...`);
      tx = await zns.rootRegistrar.connect(regAdmin).registerRootDomainBulk(
        owners,
        labels,
        domainAddresses,
        tokenURIs,
        {
          pricerContract: hre.ethers.ZeroAddress,
          paymentType: 0n, // Direct, but dont use
          accessType: 1n, // Open
        }, // TODO what should this be? stake vs, direct should be upheld maybe?
        paymentConfigEmpty,
        // {
        //   // TODO Debug, force the TX
        //   gasLimit: 1000000
        // }
      );
      // if a domain paid for a direct subdomain, they don't get any funds
      // if a domain staked, they get funds back
      // does any of this matter? If we are burning and replacing all meow tokens?
    } else {
      // console.log(`Registering ${domains.length} subdomains`);
      tx = await zns.subRegistrar.connect(regAdmin).registerSubdomainBulk(
        parentHashes,
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
    }
  } catch (e) {
    console.log("Error registering domains: ", e);
    // Return the domainData if something failed so we can log it
    // for debugging purposes
    // TODO when retry data is setup this will be different.
    // throw error for now to avoid returning possibly undefined values
    throw new Error("Error registering domains");
    // return {
    //   domainHash: undefined,
    //   txHash: undefined,
    //   retryData: domains
    // }
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
