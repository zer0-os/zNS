import { getLogger, getMongoAdapter } from "@zero-tech/zdc";
import * as hre from "hardhat";
import { znsNames } from "../../deploy/missions/contracts/names";
import { ZNSDomainToken, ZNSRegistry, ZNSRootRegistrar, ZNSSubRegistrar } from "../../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IDistributionConfig, IPaymentConfig } from "../../../test/helpers/types";
import assert from "assert";


const logger = getLogger();

const getContract = async (name : string, version ?: string) => {
  const dbAdapter = await getMongoAdapter();

  const contract = await dbAdapter.getContract(
    name,
    version,
  );
  if (!contract) throw new Error("Contract not found in DB. Check name or version passed.");

  const factory = await hre.ethers.getContractFactory(name);
  if (!factory) throw new Error("Invalid contract name or db name is different than contract name");

  return factory.attach(contract.address);
};

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
  const rootRegistrar = await getContract(znsNames.rootRegistrar.contract) as ZNSRootRegistrar;

  return registerBase({
    contract: rootRegistrar,
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
  domainData : {
    parentHash : string;
    label : string;
    domainAddress : string;
    tokenUri : string;
    distrConfig : IDistributionConfig;
    paymentConfig : IPaymentConfig;
  };
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
  domainData : {
    parentHash : string;
    label : string;
    domainAddress : string;
    tokenUri : string;
    distrConfig : IDistributionConfig;
    paymentConfig : IPaymentConfig;
  };
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

  logger.info(`Registration of ${domainType} successful! Transaction receipt: ${JSON.stringify(txReceipt)}`);

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

export const getEventDomainHash = async ({
  label,
  tokenUri,
  registrantAddress,
} : {
  label : string;
  tokenUri : string;
  registrantAddress : string;
}) => {
  const rootRegistrar = await getContract(znsNames.rootRegistrar.contract) as ZNSRootRegistrar;

  const filter = rootRegistrar.filters.DomainRegistered(
    hre.ethers.ZeroHash,
    undefined,
    label,
    undefined,
    tokenUri,
    registrantAddress,
    undefined,
  );

  const events = await rootRegistrar.queryFilter(filter);
  const { args: { domainHash } } = events[events.length - 1];

  return domainHash;
};
