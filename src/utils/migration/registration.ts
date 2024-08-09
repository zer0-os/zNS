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

import { deployZNS } from "../../../test/helpers";
// import { ContractTransactionReceipt } from "ethers";
import { register } from "module";
import { TypedContractEvent } from "../../../typechain/common";
// import { ZNSRootRegistrar } from "../../../typechain";

const logger = getLogger();

export const registerDomainsLocal = async (
  migrationAdmin : SignerWithAddress,
  governor : SignerWithAddress,
  admin : SignerWithAddress,
  validDomains : Array<Domain>,
  zns : IZNSContractsLocal,
) => {
  // Reset hardhat to clear state and stop forking
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [],
  });

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

    const { domainHash, txReceipt } = await registerBase({
      regAdmin,
      zns,
      domainData,
    });

    registeredDomains.push({ domainHash, txReceipt });
  }

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
    paymentConfig,
  } = domainData;

  let tx;
  let domainType;
  try {
    if (parentHash === hre.ethers.ZeroHash) {
      domainType = "Root Domain";

      const filter = zns.rootRegistrar.filters.DomainRegistered();

      
      // will fail if forking mainnet, not on meowchain
      tx = await zns.rootRegistrar.connect(regAdmin).registerRootDomain(
        label,
        domainAddress,
        tokenUri,
        distrConfig,
        paymentConfig,
      );

      const txReceipt = await tx.wait();


      const events = await zns.rootRegistrar.queryFilter(filter, tx.blockNumber! - 1, tx.blockNumber! + 1);
      console.log(`EVENTS LENGTH ${events.length}`);
    } else {
      domainType = "Subdomain";
      tx = await zns.subRegistrar.connect(regAdmin).registerSubdomain(
        parentHash,
        label,
        domainAddress,
        tokenUri,
        distrConfig,
        paymentConfig,
      );
    }
  } catch (e) {
    console.log(e)
    process.exit(1);
  }

  const txReceipt = await tx.wait();

  // txReceipt!.events?.forEach((event) => { console.log(event) });
  // const x = await hre.ethers.provider.getTransaction(txReceipt!.hash);

  const filter = zns.rootRegistrar.filters.DomainRegistered(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    regAdmin.address,
    undefined,
  );

  const events = await zns.rootRegistrar.queryFilter(filter);
  console.log(events.length)
  // const { args: { domainHash } } = events[events.length - 1];

  // const g = await zns.rootRegistrar.addListener("DomainRegistered", (domainHash, label, registrant, tokenUri, parent, admin, pricer, distrConfig, paymentConfig) => {
  //   console.log(domainHash);
  // });

  
  // const subevents = await zns.subRegistrar.queryFilter(filter);

  // const domainHash = await getEventDomainHash({
  //   label,
  //   tokenUri,
  //   rootRegistrar: zns.rootRegistrar,
  //   registrantAddress: regAdmin.address,
  // });

  const ownerFromReg = await zns.registry.getDomainOwner(domainHash);
  assert.equal(
    ownerFromReg,
    regAdmin.address, // TODO doubling up on domain validation??
    `Domain validation failed!
    Owner from ZNSRegistry: ${ownerFromReg}; Registering Admin: ${regAdmin.address}`
  );

  const tokenOwner = await zns.domainToken.ownerOf(BigInt(domainHash));
  assert.equal(
    tokenOwner,
    regAdmin.address,
    `Domain token validation failed!
    Token owner from ZNSDomainToken: ${tokenOwner}; Registering Admin: ${regAdmin.address}`
  );

  logger.info(`Registration of ${domainType} successful! Transaction receipt: ${JSON.stringify(txReceipt)}`);

  return { domainHash, txReceipt };
};
