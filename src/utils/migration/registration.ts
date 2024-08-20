import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { DomainData, RegisteredDomain, Domain } from "./types";
import { IZNSContracts } from "../../deploy/campaign/types";
import { distrConfigEmpty, paymentConfigEmpty } from "../../../test/helpers";
import { IZNSContractsLocal } from "../../../test/helpers/types";


export const registerDomainsLocal = async (
  migrationAdmin : SignerWithAddress,
  validDomains : Array<Domain>,
  zns : IZNSContractsLocal,
) => {
  // Give minter balance and approval for registrations
  await zns.meowToken.connect(migrationAdmin).mint(migrationAdmin.address, hre.ethers.parseEther("99999999999999999999"));
  await zns.meowToken.connect(migrationAdmin).approve(await zns.treasury.getAddress(), hre.ethers.MaxUint256);
  
  return await registerDomains({
    regAdmin: migrationAdmin,
    zns,
    domains: validDomains,
  });

  // await postMigrationValidation(zns, registeredDomains);
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
  const registeredDomains = Array<RegisteredDomain>();
  
  // When domains fail they are added to this array to retry
  // after all other domains have been attempted
  const retryDomains = Array<Domain>();

    const parentHashes = domains.map((domain) => { return domain.parentHash });
    const labels = domains.map((domain) => { return domain.label });
    const domainAddresses = domains.map((domain) => {return domain.address });
    const tokenURIs = domains.map((domain) => { return domain.tokenURI });

    const { domainHashes, txReceipt, retryData } = await registerBase({
      regAdmin,
      zns,
      parentHashes,
      labels,
      domainAddresses,
      tokenURIs,
    });

    // if (retryDomainData) {
    //   console.log("failed? why?")
    //   retryDomains.push(domain);
    // } else {
    //   registeredDomains.push({ domainHash, txReceipt });
    // }

    // count++;

    // if (count % 100 === 0) {
    //   console.log(`Registered ${registeredDomains.length} domains`);
    // };
  // }

  // if (retryDomains.length > 0) {
  //   console.log(`Retrying ${retryDomains.length} domains`);
  // }

  // const end = Date.now();

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
  parentHashes,
  labels,
  domainAddresses,
  tokenURIs,
} : {
  zns : IZNSContractsLocal | IZNSContracts;
  regAdmin : SignerWithAddress;
  parentHashes : Array<string>;
  labels : Array<string>;
  domainAddresses : Array<string>;
  tokenURIs : Array<string>;
}) => {
  let tx;
  try {
    // if (parentHash === hre.ethers.ZeroHash) {
      // We aren't setting configs intentionally.
      tx = await zns.rootRegistrar.connect(regAdmin).registerRootDomainBulk(
        labels,
        domainAddresses,
        tokenURIs,
        distrConfigEmpty, // TODO want to still keep their access type to indicate whether or not it's been paid for
        paymentConfigEmpty,
      );
    // } 
    // Filter worlds vs. subdomains
    // else {
    //   tx = await zns.subRegistrar.connect(regAdmin).registerSubdomain(
    //     parentHash,
    //     label,
    //     domainAddress,
    //     tokenUri,
    //     distrConfigEmpty,
    //     paymentConfigEmpty,
    //   );
    // }
  } catch (e) {
    // Return the domainData if something failed so we can log it
    // for debugging purposes
    return {
      domainHash: undefined,
      txReceipt: undefined,
      domainData: undefined // TODO temp debug
    }
  }

  // Providing a number on hardhat will cause it to hang
  const blocks = hre.network.name === "hardhat" ? 0 : 2;
  const txReceipt = await tx.wait(blocks);

  // console.log(txReceipt)
  // console.log(txReceipt!.logs.length)
  
  // TODO can we make this nicer? Reading from `topics` is not ideal
  const lastLog = txReceipt!.logs[txReceipt!.logs.length - 1];
  const firstLog = txReceipt!.logs[0];

  const domainHashes = Array<string>();

  for (let i = 0; i < txReceipt!.logs.length; i++) {
    // console.log(`log: ${i}`) 
    // 9 logs per single tx, 3rd log is first to have domainhash
    // 2, 11, 20, 29, 38, 47, 56, 65, 74
    if (i % 9 === 2) {
      // console.log("Domain hashes")
      domainHashes.push(txReceipt!.logs[i].topics[2])
    }

    // const keys = Object.keys(txReceipt!.logs[i]);
    // const values = Object.values(txReceipt!.logs[i]);

    // for (let j = 0; j < keys.length; j++) {
    //   console.log(`k: ${keys[j]}, v: ${values[j]}`)
    // }
  }

  const domainHash = lastLog.topics[1];

  // console.log(`domainHash: ${domainHash}`)

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
