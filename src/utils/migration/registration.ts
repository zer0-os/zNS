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
  
  console.log(`Registering ${validDomains.length} domains`);
  const start = Date.now();
  const registeredDomains = await registerDomains({
    regAdmin: migrationAdmin,
    zns,
    domains: validDomains,
  });
  const end = Date.now();
  console.log(`Time taken: ${end - start}ms`);

  await postMigrationValidation(zns, registeredDomains);

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
  const registeredDomains = Array<RegisteredDomain>();
  
  // When domains fail they are added to this array to retry
  // after all other domains have been attempted
  const retryDomains = Array<Domain>();

  let count = 0;
  const start = Date.now();
  for (const domain of domains) {

    const domainData = {
      parentHash: domain.parentHash,
      label: domain.label,
      domainAddress: domain.address,
      tokenUri: domain.tokenURI,
      distrConfig: {
        accessType: BigInt(1), // For recreating the domain tree, all domains are set as `open` initially
        paymentType: BigInt(domain.paymentType ?? 0),
        pricerContract: hre.ethers.ZeroAddress
      },
      paymentConfig: {
        // We don't set payment config for recreated domains
        token: hre.ethers.ZeroAddress,
        beneficiary: hre.ethers.ZeroAddress,
      },
    }

    const { domainHash, txReceipt, domainData: retryDomainData } = await registerBase({
      regAdmin,
      zns,
      domainData,
    });

    if (retryDomainData) {
      console.log("failed? why?")
      retryDomains.push(domain);
    } else {
      registeredDomains.push({ domainHash, txReceipt });
    }

    count++;

    if (count % 100 === 0) {
      console.log(`Registered ${registeredDomains.length} domains`);
    };
  }

  if (retryDomains.length > 0) {
    console.log(`Retrying ${retryDomains.length} domains`);
  }

  const end = Date.now();

  console.log(`Registered ${registeredDomains.length} domains in ${end - start}ms`);
  return registeredDomains;
};

export const registerBase = async ({
  zns,
  regAdmin,
  domainData,
} : {
  zns : IZNSContractsLocal | IZNSContracts;
  regAdmin : SignerWithAddress;
  domainData : DomainData;
}) => {
  const {
    parentHash,
    label,
    domainAddress,
    tokenUri,
  } = domainData;

  let tx;
  try {
    if (parentHash === hre.ethers.ZeroHash) {
      await zns.rootRegistrar.addListener("DomainRegistered", (domainHash, registrant, label, parent, domainType, tokenUri, distrConfig, paymentConfig) => {
        return domainHash;
      });

      // We aren't setting configs intentionally.
      tx = await zns.rootRegistrar.connect(regAdmin).registerRootDomain(
        label,
        domainAddress,
        tokenUri,
        distrConfigEmpty,
        paymentConfigEmpty,
      );
    } else {
      tx = await zns.subRegistrar.connect(regAdmin).registerSubdomain(
        parentHash,
        label,
        domainAddress,
        tokenUri,
        distrConfigEmpty,
        paymentConfigEmpty,
      );
    }
  } catch (e) {
    // Return the domainData if something failed so we can log it
    // for debugging purposes
    return {
      domainHash: undefined,
      txReceipt: undefined,
      domainData: domainData 
    }
  }

  // Providing a number on hardhat will cause it to hang
  const blocks = hre.network.name === "hardhat" ? 0 : 2;
  const txReceipt = await tx.wait(blocks);

  // TODO can we make this nicer? Reading from `topics` is not ideal
  const lastLog = txReceipt!.logs[txReceipt!.logs.length - 1];
  const domainHash = lastLog.topics[1];

  // console.log(`domainHash: ${domainHash}`)

  return { domainHash, txReceipt, domainData: undefined };
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
