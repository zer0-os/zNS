import { getLogger } from "@zero-tech/zdc";
import * as hre from "hardhat";
import { znsNames } from "../../deploy/missions/contracts/names";
import { ZNSDomainToken, ZNSRegistry, ZNSRootRegistrar, ZNSSubRegistrar } from "../../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IDistributionConfig, IPaymentConfig } from "../../../test/helpers/types";
import assert from "assert";
import { getEventDomainHash } from "./getters";
import { DomainData } from "./types";
import { getZNS } from "./zns-contract-data";


const logger = getLogger();

/**
 * @dev Have to provide domainData.parentHash as ZeroHash ("0x00000...") for root domain registration!
 */
export const registerRootDomain = async ({
  regAdmin,
  domainData,
} : {
  regAdmin : SignerWithAddress;
  domainData : {
    parentHash : string;
    label : string;
    domainAddress : string;
    tokenUri : string;
    distrConfig : IDistributionConfig;
    paymentConfig : IPaymentConfig;
  };
}) => {
  const zns = await getZNS({
    signer: regAdmin, 
    action: "write"
  });
  // const rootRegistrar = await getContract(znsNames.rootRegistrar.contract) as ZNSRootRegistrar;

  // will this work with HH?
  // contract address doesnt exist on mainnet, so it will fail
  // trying to setup the contract tx
  // are we able to modify the HH network at runtime?
  return registerBase({
    contract: zns.rootRegistrar,
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
  contract,
  regAdmin,
  domainData,
} : {
  contract : ZNSRootRegistrar | ZNSSubRegistrar;
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
    tx = await (contract as ZNSRootRegistrar).connect(regAdmin).registerRootDomain(
      label,
      domainAddress,
      tokenUri,
      distrConfig,
      paymentConfig,
    );
  } else {
    domainType = "Subdomain";
    tx = await (contract as ZNSSubRegistrar).connect(regAdmin).registerSubdomain(
      parentHash,
      label,
      domainAddress,
      tokenUri,
      distrConfig,
      paymentConfig,
    );
  }

  const txReceipt = await tx.wait(2);

  const domainHash = await getEventDomainHash({
    label,
    tokenUri,
    registrantAddress: regAdmin.address,
  });

  // verify domain created properly
  const registry = await getContract(znsNames.registry.contract) as ZNSRegistry;
  const ownerFromReg = await registry.getDomainOwner(domainHash);
  assert.equal(
    ownerFromReg,
    regAdmin.address,
    `Domain validation failed!
    Owner from ZNSRegistry: ${ownerFromReg}; Registering Admin: ${regAdmin.address}`
  );

  const domainToken = await getContract(znsNames.domainToken.contract) as ZNSDomainToken;
  const tokenOwner = await domainToken.ownerOf(BigInt(domainHash));
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

