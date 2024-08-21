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
  
  const domains = await registerDomains({
    regAdmin: migrationAdmin,
    zns,
    domains: validDomains,
  });

  return domains;

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
  // TODO impl
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
    // We separate domains by root and subdomains upstream, so here
    // we know with confidence that if one parent hash is the zero address
    // all of them are
    console.log("ph length: ", parentHashes.length)
    console.log("lbls length: ", labels.length)
    console.log("dmnaddrseslength: ", domainAddresses.length)
    // parentHashes.forEach((parentHash) => { console.log(parentHash) });

    console.log("parentHashes[0]: ", parentHashes[0])
    console.log("labels[0]: ", labels[0])
    console.log("domainAddresses[0]: ", domainAddresses[0])
    console.log("tokenURIs[0]: ", tokenURIs[0])

    // if (parentHashes[0] === hre.ethers.ZeroHash) {
      console.log("inrootdomain")
      // We aren't setting configs intentionally.
      tx = await zns.rootRegistrar.connect(regAdmin).registerRootDomain(
        labels[0],
        domainAddresses[0],
        tokenURIs[0],
        distrConfigEmpty, // TODO what should this be? stake vs, direct should be upheld maybe?
        paymentConfigEmpty,
      );
    // } else { 
    //   console.log("insubdomain")

    //   // tx = await zns.subRegistrar.connect(regAdmin).registerSubdomainBulk(
    //   //   parentHashes,
    //   //   labels,
    //   //   domainAddresses,
    //   //   tokenURIs,
    //   //   distrConfigEmpty,
    //   //   paymentConfigEmpty,
    //   // );
    // }
  } catch (e) {
    console.log("Error registering domain: ", e);
    // Return the domainData if something failed so we can log it
    // for debugging purposes
    return {
      domainHash: undefined,
      txReceipt: undefined,
      domainData: undefined // TODO temp debug
    }
  }

  // Providing a number on hardhat will cause it to hang
  const blocks = hre.network.name === "hardhat" ? 0 : 7;
  const txReceipt = await tx.wait(blocks);
  console.log("txhash: ", txReceipt!.hash)
  console.log("logslength: ",txReceipt!.logs.length)
  console.log("logs: ",txReceipt!.logs)


  // For now just hardhat or sepolia, a third "real" address will be introduced when we deploy
  // const eventAddress = hre.network.name === "hardhat" ? regAdmin.address : process.env.TESTNET_PRIVATE_KEY_A;

  // const filter = zns.rootRegistrar.filters.DomainRegistered( 
  //   undefined,
  //   undefined,
  //   undefined,
  //   undefined,
  //   undefined,
  //   eventAddress,
  //   undefined,
  // );

  // const events = await zns.rootRegistrar.queryFilter(filter);
  

  // console.log("eventslength: ", events.length)
  // console.log("events[0]: ", events[0].args)


  // console.log(txReceipt)
  // console.log(txReceipt!.logs.length)
  
  // TODO can we make this nicer? Reading from `topics` is not ideal
  const lastLog = txReceipt!.logs[txReceipt!.logs.length - 1];
  const firstLog = txReceipt!.logs[0];

  const domainHashes = Array<string>();
  // for (let i = 0; i < txReceipt!.logs.length; i++) {
    // console.log(txReceipt!.logs[i]);
    // 9 logs per domain, 3rd log is first to have domainhash
    // So indexes 2, 11, 20, 29, 38, 47, 56, 65, 74
    // console.log("i: ", i)
    // if (i % 9 === 2) {
      // console.log("Domain hashes")
      // domainHashes.push(txReceipt!.logs[i].topics[2])
    // }

    // const keys = Object.keys(txReceipt!.logs[i]);
    // const values = Object.values(txReceipt!.logs[i]);

    // for (let j = 0; j < keys.length; j++) {
    //   console.log(`k: ${keys[j]}, v: ${values[j]}`)
    // }
  // }

  // const domainHash = lastLog.topics[1];

  // console.log(`domainHashes: ${domainHashes.length}`)

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
