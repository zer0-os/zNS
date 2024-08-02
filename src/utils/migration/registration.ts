import { getLogger } from "@zero-tech/zdc";
import * as hre from "hardhat";
import { znsNames } from "../../deploy/missions/contracts/names";
import { ZNSDomainToken, ZNSRegistry, ZNSRootRegistrar, ZNSSubRegistrar } from "../../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IDistributionConfig, IPaymentConfig, IZNSContractsLocal } from "../../../test/helpers/types";
import assert from "assert";
import { getEventDomainHash } from "./getters";
import { DomainData } from "./types";
import { getZNS } from "./zns-contract-data";
import { IZNSContracts } from "../../deploy/campaign/types";
import { Domain } from "./types"; // TODO filter to `DomainData`?

import { deployZNS } from "../../../test/helpers";

const logger = getLogger();

export const registerDomainsLocal = async (
  migrationAdmin : SignerWithAddress,
  governor : SignerWithAddress,
  admin : SignerWithAddress,
  validDomains : Array<Domain>
) => {
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [],
  });

  const params = {
    deployer: migrationAdmin,
    governorAddresses: [migrationAdmin.address, governor.address],
    adminAddresses: [migrationAdmin.address, admin.address],
  };

  let zns : IZNSContractsLocal = await deployZNS(params); 

  // Give minter balance and approval for registrations
  await zns.meowToken.connect(migrationAdmin).mint(migrationAdmin.address, hre.ethers.parseEther("99999999999999999999"));
  await zns.meowToken.connect(migrationAdmin).approve(await zns.treasury.getAddress(), hre.ethers.MaxUint256);
  
  console.log("Registering domains");
  const start = Date.now();
  await registerDomains({
    zns,
    regAdmin: migrationAdmin,
    domains: validDomains,
  });
  const end = Date.now();
  console.log(`Time taken: ${end - start}ms`);
};

export const registerDomains = async ({
  regAdmin,
  zns,
  domains,
} : {
  regAdmin : SignerWithAddress;
  zns : IZNSContractsLocal; // TODO cant do `TypeA || TypeB` here??
  domains : Array<Domain>
}) => {
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
    const { domainHash, txReceipt} = await registerBase({
      regAdmin,
      zns,
      // action: "read", // TODO need still? not for local
      domainData: domainData,
    });
  }
};

export const registerBase = async ({
  zns,
  regAdmin,
  domainData,
} : {
  zns : IZNSContractsLocal;
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
    // will fail if forking mainnet, not on meowchain
      tx = await zns.rootRegistrar.connect(regAdmin).registerRootDomain(
        label,
        domainAddress,
        tokenUri,
        distrConfig,
        paymentConfig,
      );
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
    console.log(`parentnotexist: ${label}`);
    console.log(e)
    process.exit(1);
  }

  const txReceipt = await tx.wait();

  const domainHash = await getEventDomainHash({
    label,
    tokenUri,
    rootRegistrar: zns.rootRegistrar,
    registrantAddress: regAdmin.address,
  });

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

export const sendDomainToken = async ({
  domainHash,
  fromSigner,
  toAddress,
} : {
  domainHash : string;
  fromSigner : SignerWithAddress;
  toAddress : string;
}) => {
  const tokenId = BigInt(domainHash);

  const domainToken = await getContract(znsNames.domainToken.contract) as ZNSDomainToken;
  const tx = await domainToken.connect(fromSigner).transferFrom(fromSigner.address, toAddress, tokenId);
  const txReceipt = await tx.wait(2);

  logger.info(`Domain token sent successfully! Transaction receipt: ${JSON.stringify(txReceipt)}`);

  return { tokenId, txReceipt };
};

export const changeDomainOwner = async ({
  domainHash,
  regAdmin,
  newOwnerAddress,
} : {
  domainHash : string;
  regAdmin : SignerWithAddress;
  newOwnerAddress : string;
}) => {
  const registry = await getContract(znsNames.registry.contract) as ZNSRegistry;

  const tx = await registry.connect(regAdmin).updateDomainOwner(
    domainHash,
    newOwnerAddress
  );
  const txReceipt = await tx.wait(2);

  // validate
  const ownerFromReg = await registry.getDomainOwner(domainHash);
  assert.equal(
    ownerFromReg,
    newOwnerAddress,
    `Domain owner change validation failed!
    Owner from ZNSRegistry: ${ownerFromReg}; New Owner: ${newOwnerAddress}`
  );

  logger.info(`Domain owner changed successfully! Transaction receipt: ${JSON.stringify(txReceipt)}`);

  return txReceipt;
};

