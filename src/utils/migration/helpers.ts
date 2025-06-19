import { Db } from "mongodb";
import { getDBAdapter } from "./database";
import { Domain } from "./types";
import { ZeroAddress, ZeroHash } from "ethers";
import { IRootDomainRegistrationArgs, ISubdomainRegisterArgs } from "./types";

import * as hre from "hardhat";
import { ROOT_DOMAIN_ENCODING, SUBDOMAIN_BULK_SELECTOR, SUBDOMAIN_ENCODING, SAFE_TRANSFER_FROM_ENCODING, SAFE_TRANSFER_FROM_SELECTOR } from "./constants";

export const connectToDb = async (
  mongoUri?: string,
  mongoDbName?: string
) : Promise<Db> => {
    const uri = process.env.MONGO_DB_URI_WRITE ?? mongoUri;
    if (!uri) throw Error("No connection string given");
  
    const dbName = process.env.MONGO_DB_NAME_WRITE ?? mongoDbName;
    if (!dbName) throw Error("No DB name given");
  
    // Return socket connection
    return (await getDBAdapter(uri)).db(dbName);
}

export const createBatches = (
  domains : Array<Domain>,
  functionSelector ?: string,
  registerSliceSize : number = 50,
  transferSliceSize : number = 500
) => { // TODO return type // : Array<Array<IRootDomainRegistrationArgs | ISubdomainRegisterArgs>> | Array<string> 
  if (functionSelector) {
    return createBatchesSafe(domains, functionSelector, registerSliceSize, transferSliceSize);
  } else {
    return createBatchesEOA(domains, registerSliceSize); // TODO add transfer slice size
  }
}

const createBatchesEOA = (
  domains : Array<Domain>,
  sliceSize : number = 50
) : Array<Array<IRootDomainRegistrationArgs | ISubdomainRegisterArgs>> => {
  let txs : Array<IRootDomainRegistrationArgs | ISubdomainRegisterArgs> = [];
  const batchTxs : Array<Array<IRootDomainRegistrationArgs | ISubdomainRegisterArgs>> = [];

  // Create batch txs for root domains
  let count = 0;
  for (const domain of domains) {
    let domainArg : Partial<IRootDomainRegistrationArgs | ISubdomainRegisterArgs> = {
      domainAddress: domain.address,
      tokenOwner: domain.owner.id,
      tokenURI: domain.tokenURI,
      distrConfig: {
        pricerContract: ZeroAddress,
        paymentType: 0n,
        accessType: 0n,
      },
      paymentConfig: {
        token: ZeroAddress,
        beneficiary: ZeroAddress,
      }
    }

    // "label" is parameter name for subdomain registration, "name" for root domains
    // but "label" is used for both in the subgraph
    if (domain.parentHash !== ZeroHash) {
      domainArg = { parentHash: domain.parentHash, label: domain.label, ...domainArg };
      txs.push(domainArg as ISubdomainRegisterArgs);
    } else {
      domainArg = { name: domain.label, ...domainArg };
      txs.push(domainArg as IRootDomainRegistrationArgs);
    }

    if (txs.length % sliceSize === 0) {
      batchTxs.push(txs);
      txs = [];
    }

    count++;
  }

  return batchTxs;
}

const createBatchesSafe = (
  domains : Array<Domain>,
  functionSelector : string,
  registerSliceSize : number,
  transferSliceSize : number
) : [ Array<string>, Array<string> ] => {
  let batchRegisterTxs : Array<string> = [];
  let batchTransferTxs : Array<string> = [];

  const encoder = hre.ethers.AbiCoder.defaultAbiCoder();

  let count = 0;
  let batchRegister = functionSelector;
  let batchTransfer = SAFE_TRANSFER_FROM_SELECTOR;

  // Get safe address being used
  const safeAddress = process.env.TEST_SAFE_ADDRESS;
  if (!safeAddress) {
    throw Error("No Safe address set in environment variables");
  }

  for (const domain of domains) {
    if (functionSelector === SUBDOMAIN_BULK_SELECTOR && domain.parentHash === ZeroHash) {
      throw Error("Subdomain registration requires parent hash to be set");
    }

    let dataEncoding;

    let registerData = [
      domain.label,
      domain.address,
      safeAddress, // TODO could just be ownerId to avoid transfer later?
      domain.tokenURI,
      [ // distrConfig
        ZeroAddress,
        0n,
        0n,
      ],
      [ // paymentConfig
        ZeroAddress,
        ZeroAddress
      ]
    ];

    if (functionSelector === SUBDOMAIN_BULK_SELECTOR) {
      dataEncoding = SUBDOMAIN_ENCODING;
      registerData = [ domain.parentHash, ...registerData ];
    } else {
      dataEncoding = ROOT_DOMAIN_ENCODING;
    }

    const registerEncoding = encoder.encode(
      [ dataEncoding ],
      [ registerData ]
    );

    const transferEncoding = encoder.encode(
      SAFE_TRANSFER_FROM_ENCODING,
      [ safeAddress, domain.owner.id, domain.tokenId ]
    );

    batchRegister = batchRegister + registerEncoding.slice(2) // remove 0x prefix
    batchTransfer = batchTransfer + transferEncoding.slice(2);
    count++;

    // If at slice size # of transactions or at the end of the array, finish batch
    if (count % registerSliceSize === 0 || domains.length - count === 0) {
      batchRegisterTxs.push(batchRegister);
      batchRegister = functionSelector; // reset batch data
    }

    if (count % transferSliceSize === 0 || domains.length - count === 0) {
      batchTransferTxs.push(batchTransfer);
      batchTransfer = SAFE_TRANSFER_FROM_SELECTOR; // reset transfer data
    }
  }

  return [ batchRegisterTxs, batchTransferTxs ]
}