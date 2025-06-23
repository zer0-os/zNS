import { Db } from "mongodb";
import { ZeroAddress, ZeroHash } from "ethers";
import { getDBAdapter } from "./database";
import { Domain, IRootDomainRegistrationArgs, ISubdomainRegisterArgs } from "./types";
import { ZNSDomainToken__factory, ZNSRootRegistrar__factory, ZNSSubRegistrar__factory } from "../../../typechain";
import { SUBDOMAIN_BULK_SELECTOR } from "./constants";

// Connect to the MongoDB database to read domain data for migration
export const connect = async (
  mongoUri?: string,
  mongoDbName?: string
) : Promise<Db> => {
    const uri = process.env.MONGO_DB_URI_MIG ?? mongoUri;
    if (!uri) throw Error("No connection string given");
  
    const dbName = process.env.MONGO_DB_NAME_MIG ?? mongoDbName;
    if (!dbName) throw Error("No DB name given");
  
    // Return socket connection
    return (await getDBAdapter(uri)).db(dbName);
}

// Create registration and transfer batches to use as txData
export const createBatches = (
  domains : Array<Domain>,
  functionSelector ?: string,
  registerSliceSize : number = 50,
  transferSliceSize : number = 500
) => {
  if (functionSelector) {
    return createBatchesSafe(domains, functionSelector, registerSliceSize, transferSliceSize);
  } else {
    return createBatchesEOA(domains, registerSliceSize);
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
      name : domain.label,
      domainAddress: domain.address,
      tokenOwner: domain.owner.id,
      tokenURI: domain.tokenURI,
      distrConfig: {
        pricerContract: ZeroAddress,
        priceConfig: "0x",
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
) : [ Array<string>, Array<Array<string>> ] => {
  // For registration we already have bulk functions, so each push to this array is an encoded batch
  let batchRegisterTxs : Array<string> = [];

  // For transfer we don't have bulk functions, so each push to this array is an array of encoded transfers
  let batchTransferTxs : Array<Array<string>> = [];

  // Get safe address being used
  const safeAddress = process.env.SAFE_ADDRESS;
  if (!safeAddress) {
    throw Error("No Safe address set in environment variables");
  }

  let registrationBatch : Array<any> = []; // TODO `any` for now, debug, remove later no explicit any
  let transfersBatch : Array<any> = [];

  // get domains we need to fit in gas block, then make tx of it and find estimation
  for (const [index, domain] of domains.entries()) {
    let args = {
      name: domain.label,
      domainAddress: domain.owner.id,
      tokenOwner: process.env.SAFE_ADDRESS!,
      tokenURI: domain.tokenURI,
      distrConfig: {
        pricerContract: ZeroAddress,
        paymentType: 0n,
        accessType: 0n,
        priceConfig: "0x",
      },
      paymentConfig: {
        token: ZeroAddress,
        beneficiary: ZeroAddress,
      }
    }

    if (functionSelector === SUBDOMAIN_BULK_SELECTOR) {
      // Subdomain, check parentHash
      if (domain.parentHash === ZeroHash) {
        throw Error("Subdomain registration requires parent hash to be set");
      }

      // remove `name` from args, leave rest of args in `rest`
      const { name, ...rest } = args;
      
      // Make sure priceConfig is included in distrConfig
      const subArgs = { 
        parentHash: domain.parentHash, 
        label: domain.label, 
        ...rest,
      };
      
      registrationBatch.push(subArgs);

      if (registrationBatch.length === registerSliceSize || index + 1 === domains.length) {
        const batchData = ZNSSubRegistrar__factory.createInterface().encodeFunctionData(
          "registerSubdomainBulk",
          [ registrationBatch ]
        );
        batchRegisterTxs.push(batchData);
        registrationBatch = []; // reset batch
      }      
    } else {
      registrationBatch.push(args);

      if (registrationBatch.length === registerSliceSize || index + 1 === domains.length) {
        const batchData = ZNSRootRegistrar__factory.createInterface().encodeFunctionData(
          "registerRootDomainBulk",
          [ registrationBatch ]
        );
        batchRegisterTxs.push(batchData);
        registrationBatch = []; // reset batch
      }
    }

    const transferEncoding = ZNSDomainToken__factory.createInterface().encodeFunctionData(
      "safeTransferFrom(address,address,uint256)",
      [ safeAddress, domain.owner.id, domain.tokenId ]
    );

    transfersBatch.push(transferEncoding);

    if (transfersBatch.length === transferSliceSize) {
      batchTransferTxs.push(transfersBatch);
      transfersBatch = []; // reset transfers
    }

    if (transfersBatch.length === transferSliceSize || index + 1 === domains.length) {
      // At the last set, so regardless of how much we have we push
      batchTransferTxs.push(transfersBatch);
    }
  }

  return [ batchRegisterTxs, batchTransferTxs ]
}
