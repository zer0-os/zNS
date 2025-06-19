import { Db } from "mongodb";
import { getDBAdapter } from "./database";
import { Domain } from "./types";
import { ZeroAddress, ZeroHash } from "ethers";
import { IRootDomainRegistrationArgs, ISubdomainRegisterArgs } from "./types";

import * as hre from "hardhat";
import { ROOT_DOMAIN_ENCODING, SUBDOMAIN_BULK_SELECTOR, SUBDOMAIN_ENCODING, SAFE_TRANSFER_FROM_ENCODING, SAFE_TRANSFER_FROM_SELECTOR } from "./constants";
import { ZNSDomainToken__factory, ZNSRootRegistrar__factory, ZNSSubRegistrar__factory } from "../../../typechain";

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

  let count = 0;
  let batchRegisterData = functionSelector;
  let batchTransferData = SAFE_TRANSFER_FROM_SELECTOR;

  // Get safe address being used
  const safeAddress = process.env.TEST_SAFE_ADDRESS;
  if (!safeAddress) {
    throw Error("No Safe address set in environment variables");
  }

  for (const domain of domains) {
    let args = {
      name: domain.label,
      domainAddress: domain.owner.id,
      tokenOwner: process.env.TEST_SAFE_ADDRESS!,
      tokenURI: domain.tokenURI,
      distrConfig: {
        pricerContract: ZeroAddress,
        paymentType: 0n,
        accessType: 0n
      },
      paymentConfig: {
        token: ZeroAddress,
        beneficiary: ZeroAddress,
      }
    }

    let registerEncoding : string;

    if (functionSelector === SUBDOMAIN_BULK_SELECTOR) {
      if (domain.parentHash === ZeroHash) {
        throw Error("Subdomain registration requires parent hash to be set");
      }

      // remove `name` from args, leave rest of args in `rest`
      const { name, ...rest } = args;
      registerEncoding = ZNSSubRegistrar__factory.createInterface().encodeFunctionData(
        "registerSubdomainBulk",
        [[ { parentHash: domain.parentHash, label: args.name, ...rest } ]]
      );
    } else {
      registerEncoding = ZNSRootRegistrar__factory.createInterface().encodeFunctionData(
        "registerRootDomainBulk",
        [[ args ]]
      );
    }

    const transferEncoding = ZNSDomainToken__factory.createInterface().encodeFunctionData(
      "safeTransferFrom(address,address,uint256)",
      [ safeAddress, domain.owner.id, domain.tokenId ]
    );

    batchRegisterData += registerEncoding.slice(10); // remove '0x' prefix
    batchTransferData += transferEncoding.slice(10);
    count++;

    // If at slice size # of transactions or at the end of the array, finish batch
    if (count % registerSliceSize === 0 || domains.length - count === 0) {
      batchRegisterTxs.push(batchRegisterData);
      batchRegisterData = functionSelector; // reset batch register data
    }

    if (count % transferSliceSize === 0 || domains.length - count === 0) {
      batchTransferTxs.push(batchTransferData);
      batchTransferData = SAFE_TRANSFER_FROM_SELECTOR; // reset batch transfer data
    }
  }

  return [ batchRegisterTxs, batchTransferTxs ]
}