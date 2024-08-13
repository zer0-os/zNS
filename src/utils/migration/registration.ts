import { getLogger } from "@zero-tech/zdc";
import * as hre from "hardhat";
import { znsNames } from "../../deploy/missions/contracts/names";
import { ZNSDomainToken, ZNSRegistry, ZNSRootRegistrar, ZNSSubRegistrar } from "../../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IDistributionConfig, IPaymentConfig, IZNSContractsLocal } from "../../../test/helpers/types";
import assert from "assert";
import { getEventDomainHash } from "./getters";
import { DomainData, RegisteredDomain } from "./types";
import { getZNS } from "./zns-contract-data";
import { IZNSContracts } from "../../deploy/campaign/types";
import { Domain } from "./types"; // TODO filter to `DomainData`?

import { deployZNS, paymentConfigEmpty } from "../../../test/helpers";
// import { ContractTransactionReceipt } from "ethers";
import { register } from "module";
import { TypedContractEvent } from "../../../typechain/common";
import { expect } from "chai";
// import { ZNSRootRegistrar } from "../../../typechain";

const logger = getLogger();

export const registerDomainsLocal = async (
  migrationAdmin : SignerWithAddress,
  governor : SignerWithAddress,
  admin : SignerWithAddress,
  validDomains : Array<Domain>,
  zns : IZNSContractsLocal,
) => {
  // Give minter balance and approval for registrations
  await zns.meowToken.connect(migrationAdmin).mint(migrationAdmin.address, hre.ethers.parseEther("99999999999999999999"));
  await zns.meowToken.connect(migrationAdmin).approve(await zns.treasury.getAddress(), hre.ethers.MaxUint256);
  
  console.log("Registering domains");
  const start = Date.now();
  const registeredDomains = await registerDomains({
    regAdmin: migrationAdmin,
    zns,
    domains: validDomains,
  });
  const end = Date.now();
  console.log(`Time taken: ${end - start}ms`);

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
  const retryDomains = Array<DomainData>();

  let count = 0;
  const start = Date.now();
  for (const domain of domains) {
    const domainData = {
      parentHash: domain.parentHash,
      label: domain.label,
      domainAddress: domain.address,
      tokenUri: domain.tokenURI,
      distrConfig: {
        accessType: BigInt(domain.accessType ?? 0),
        paymentType: BigInt(domain.paymentType ?? 0),
        pricerContract: domain.pricerContract ?? hre.ethers.ZeroAddress,
      },
      paymentConfig: {
        token: domain.paymentToken.id ?? hre.ethers.ZeroAddress, // because not deployed contract vals, just strings?
        beneficiary: domain.treasury.beneficiaryAddress ?? hre.ethers.ZeroAddress,
      },
    }

    const { domainHash, txReceipt, domainData: retryDomainData } = await registerBase({
      regAdmin,
      zns,
      domainData,
    });

    if (retryDomainData) {
      retryDomains.push(retryDomainData);
    } else {
      registeredDomains.push({ domainHash, txReceipt });
    }

    count++;
    
    // gives misleading results, lots in a row fail and 900 appears multiple times
    if (count % 100 === 0) {
      console.log(`Registered ${registeredDomains.length} domains`);
    };
  }

  if (retryDomains.length > 0) { 
    console.log("we retry these")
    const { domainHash, txReceipt, domainData: retryDomainData } = await registerBase({
      regAdmin,
      zns,
      domainData: retryDomains[0],
    });

    if (retryDomainData) {
      console.log("Failed to register domain after retry, something else is wrong")
    }
    // TODO get domain and txReceipt, add to registeredDomains
  }

  const end = Date.now();

  console.log(`Registered ${registeredDomains.length} domains in ${end} - ${start}`);
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
    distrConfig,
    paymentConfig, // dont use payment config for recreation, will break if parent isnt registered yet
  } = domainData;

  let tx;
  let domainType;
  // const filter = zns.rootRegistrar.filters.DomainRegistered();
  try {
    if (parentHash === hre.ethers.ZeroHash) {
      domainType = "Root Domain";
      // will fail if forking mainnet, not on meowchain
      tx = await zns.rootRegistrar.connect(regAdmin).registerRootDomain(
        label,
        domainAddress,
        tokenUri,
        distrConfig,
        paymentConfigEmpty, // TODO set configs as empty to avoid parent issues?
      );
    } else {
      domainType = "Subdomain";
      tx = await zns.subRegistrar.connect(regAdmin).registerSubdomain(
        parentHash,
        label,
        domainAddress,
        tokenUri,
        distrConfig,
        paymentConfigEmpty,
      );
    }
  } catch (e) {
    // maybe return and add retry logic for failed domains?
    // console.log(e)
    return {
      domainHash: undefined,
      txReceipt: undefined,
      domainData: domainData 
    }
  }

  const txReceipt = await tx.wait();
  const domainHash = await getEventDomainHash({
    registrantAddress: regAdmin.address,
    zns,
  });

  // console.log(`Domain hash: ${domainHash}`);

  // Post deploy validation of domain
  // TODO include data from subgraph pre-validation to
  // TODO do this here per domain? or in a script afterward?

  expect(domainHash).to.not.equal(hre.ethers.ZeroHash);
  expect(await zns.registry.exists(domainHash)).to.be.true;
  expect(await zns.registry.getDomainOwner(domainHash)).to.equal(regAdmin.address);
  expect(await zns.domainToken.ownerOf(BigInt(domainHash))).to.equal(regAdmin.address);

  return { domainHash, txReceipt, domainData: undefined };
};
