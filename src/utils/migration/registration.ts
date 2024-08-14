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
  
  console.log(`Registering ${validDomains.length} domains`);
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

  const curvePricerAddress = await zns.curvePricer.getAddress();
  const fixedPricerAddress = await zns.fixedPricer.getAddress();

  let count = 0;
  const start = Date.now();
  for (const domain of domains) {

    // Init as zero, then compare
    let pricerContractAddress = hre.ethers.ZeroAddress;

    // If user hasn't set a pricer contract, neither do we.
    // If they have, we select between the two available options
    if (domain.pricerContract !== hre.ethers.ZeroAddress) {
      pricerContractAddress = domain.pricerContract === curvePricerAddress ? curvePricerAddress : fixedPricerAddress;
    }

    const domainData = {
      parentHash: domain.parentHash,
      label: domain.label,
      domainAddress: domain.address,
      tokenUri: domain.tokenURI,
      distrConfig: {
        accessType: BigInt(1), // For recreating the domain tree, all domains are set as `open` initially
        paymentType: BigInt(domain.paymentType ?? 0),
        pricerContract: pricerContractAddress
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
    // TODO In subgraph queries we completely remove a domain from the data store when it is revoked.
    // To ZNS, this means we can't remint the domain when recreating the tree, and so we can;t
    // mint any of the still existing subdomains either. To fix this, we need to change the behaviour in 
    // the subgraph to not remove the domain when it is revoked and instead set `isRevoked = true`
    // Currently there is a BLOCKING deploy error in the subgraph where it fails but tricks itself
    // into passing and will deploy but be unable to sync.
    // This is a known issue and at time of writing they are actively addressing it.
    // Until then, focus on post-deploy validation of domains that were successfully registered
    // 08/14/2024
  }

  const end = Date.now();

  console.log(`Registered ${registeredDomains.length} domains in ${end - start}s`);
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
  // TODO how do we validate against the actual mainnet data here?
  // Right now, ZNS is a local instance

  expect(domainHash).to.not.equal(hre.ethers.ZeroHash);
  expect(await zns.registry.exists(domainHash)).to.be.true;
  expect(await zns.registry.getDomainOwner(domainHash)).to.equal(regAdmin.address);
  expect(await zns.domainToken.ownerOf(BigInt(domainHash))).to.equal(regAdmin.address);

  return { domainHash, txReceipt, domainData: undefined };
};
