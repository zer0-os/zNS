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


const logger = getLogger();

export const registerRootDomainBulk = async ({
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
    const { domainHash, txReceipt} = await registerRootDomain({
      regAdmin,
      zns,
      action: "read", // TODO need still? not for local
      domainData: domainData,
    });
    // console.log(`Domain registered with hash: ${domainHash}`);
    // console.log(`Transaction receipt: ${txReceipt?.hash}`);
  }
  // console.log("Done recreating domain tree")
};

/**
 * @dev Have to provide domainData.parentHash as ZeroHash ("0x00000...") for root domain registration!
 */
export const registerRootDomain = async ({
  regAdmin,
  zns,
  action,
  domainData,
} : {
  regAdmin : SignerWithAddress;
  zns : IZNSContractsLocal; // TODO cant do `TypeA || TypeB` here??
  action : string;
  domainData : {
    parentHash : string;
    label : string;
    domainAddress : string;
    tokenUri : string;
    distrConfig : IDistributionConfig;
    paymentConfig : IPaymentConfig;
  };
}) => {
  return registerBase({
    zns,
    regAdmin,
    domainData,
  });
};

/**
 * @dev Have to provide domainData.parentHash for subdomain registration!
 */
export const registerSubdomain = async ({
  regAdmin,
  domainData,
} : {
  regAdmin : SignerWithAddress;
  domainData : DomainData;
}) => {
  const subRegistrar = await getContract(znsNames.subRegistrar.contract) as ZNSSubRegistrar;

  return registerBase({
    contract: subRegistrar,
    regAdmin,
    domainData,
  });
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

  const txReceipt = await tx.wait();

  // console.log(`txReceipt.hash: ${txReceipt?.hash}`);

  const domainHash = await getEventDomainHash({
    label,
    tokenUri,
    rootRegistrar: zns.rootRegistrar,
    registrantAddress: regAdmin.address,
  });

  // console.log(`domainHash: ${domainHash}`);

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

