import { Db } from "mongodb";
import { ZeroAddress, ZeroHash } from "ethers";
import { getDBAdapter } from "./database";
import {
  CreateBatchesResponse,
  Domain,
  IRootDomainRegistrationArgs,
  ISubdomainRegistrationArgs,
  RootRegistrationArgsArrays,
  SubRegistrationArgsArrays,
} from "./types";
import { ZNSDomainToken__factory, ZNSRootRegistrar__factory, ZNSSubRegistrar__factory } from "../../../typechain";
import { SUBDOMAIN_BULK_SELECTOR } from "./constants";
import { getZnsLogger } from "../../deploy/get-logger";
import { SafeKit } from "./safeKit";

// Create and propose batch transactions to the Safe
export const proposeRegistrations = async (
  to : string,
  safeKit : SafeKit,
  domains : Array<Domain>,
  selector : string
) => {
  const [ registrations, transfers ] = createBatches(
    domains,
    selector,
  ) as CreateBatchesResponse;

  // Create proposals for registering domains
  await Promise.all([
    // Wrapping in a Promise object reduces execution time
    safeKit.createProposeSignedTxs(
      to,
      registrations
    ),
  ]);

  // To avoid iterating domains multiple times, we get transfers as well
  // and store them for later use
  return transfers;
};

// Connect to the MongoDB database to read domain data for migration
export const connectToDb = async (
  mongoUri ?: string,
  mongoDbName ?: string
) : Promise<Db> => {
  const uri = process.env.MONGO_DB_URI_MIG ?? mongoUri;
  if (!uri) throw Error("No connection string given");

  const dbName = process.env.MONGO_DB_NAME_MIG ?? mongoDbName;
  if (!dbName) throw Error("No DB name given");

  // Return socket connection
  return (await getDBAdapter(uri)).db(dbName);
};

// Create registration and transfer batches to use as txData
export const createBatches = (
  domains : Array<Domain>,
  functionSelector ?: string,
  registerSliceSize = 50,
  transferSliceSize = 500
) : CreateBatchesResponse | RootRegistrationArgsArrays | SubRegistrationArgsArrays => {
  if (functionSelector) {
    return createBatchesSafe(
      domains,
      functionSelector,
      registerSliceSize,
      transferSliceSize
    ) as CreateBatchesResponse;
  } else {
    return createBatchesEOA(
      domains,
      registerSliceSize
    ) as RootRegistrationArgsArrays | SubRegistrationArgsArrays;
  }
};

// Create transaction batches used in the `register-bulk-eoa.ts` script
const createBatchesEOA = (
  domains : Array<Domain>,
  sliceSize = 50
) => {
  const txs : Array<IRootDomainRegistrationArgs | ISubdomainRegistrationArgs> = [];
  let batchTxs : Array<Array<IRootDomainRegistrationArgs | ISubdomainRegistrationArgs>> = [];

  // Create batch txs for domains
  for (const [index, domain] of domains.entries()) {
    const domainArg = {
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
      },
    };

    // "label" is parameter name for subdomain registration, "name" for root domains
    // but "label" is used for both in the subgraph
    if (domain.parentHash !== ZeroHash) {
      const { name, ...rest } = domainArg;
      const subArg = { parentHash: domain.parentHash, label: domain.label, ...rest } as ISubdomainRegistrationArgs;
      txs.push(subArg);
    } else {
      txs.push(domainArg);
    }

    if (batchTxs.length === sliceSize || index + 1 === domains.length) {
      batchTxs.push(txs);
      batchTxs = [];
    }
  }

  return batchTxs;
};

const createBatchesSafe = (
  domains : Array<Domain>,
  functionSelector : string,
  registerSliceSize : number,
  transferSliceSize : number
) : CreateBatchesResponse => {
  // For registration we already have bulk functions, so each push to this array is an encoded batch
  const batchRegisterTxs : Array<string> = [];

  // For transfer we don't have bulk functions, so each push to this array is an array of encoded transfers
  const batchTransferTxs : Array<Array<string>> = [];

  // Get safe address being used
  const safeAddress = process.env.SAFE_ADDRESS;
  if (!safeAddress) {
    throw Error("No Safe address set in environment variables");
  }

  // Add better typing for this
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  let registrationBatch : Array<any> = [];
  let transfersBatch : Array<string> = [];

  for (const [index, domain] of domains.entries()) {
    const args = {
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
      },
    };

    if (functionSelector === SUBDOMAIN_BULK_SELECTOR) {
      // Subdomain, check parentHash
      let parentHash;

      if (domain.parentHash && domain.parentHash !== ZeroHash) {
        parentHash = domain.parentHash;
      } else if (domain.parent?.id && domain.parent?.id !== ZeroHash) {
        parentHash = domain.parent?.id;
      } else {
        throw Error("No parentHash for subdomain. Registration requires parent hash to be set");
      }

      // remove `name` from args, leave rest of args in `rest`
      const { name, ...rest } = args;

      // Make sure priceConfig is included in distrConfig
      const subArgs = {
        parentHash,
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

    // Domains marked as `revoked` won't need to be transferred to any user
    // So we can ignore this
    if (!domain.isRevoked) {
      const transferEncoding = ZNSDomainToken__factory.createInterface().encodeFunctionData(
        "safeTransferFrom(address,address,uint256)",
        [ safeAddress, domain.owner.id, domain.tokenId ]
      );

      transfersBatch.push(transferEncoding);
    }

    if (transfersBatch.length === transferSliceSize) {
      batchTransferTxs.push(transfersBatch);
      transfersBatch = []; // reset transfers
    }

    if (transfersBatch.length === transferSliceSize || index + 1 === domains.length) {
      // At the last set, so regardless of how much we have we push
      batchTransferTxs.push(transfersBatch);
    }
  }

  return [ batchRegisterTxs, batchTransferTxs ];
};


// Get the logger instance for the decorator function below
const logger = getZnsLogger();

// Function decorator to log each execution
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export const LogExecution = (target : any, propertyKey : string, descriptor : PropertyDescriptor) => {
  const originalMethod = descriptor.value;

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  descriptor.value = function (...args : Array<any>) {
    const argsCopy = { ...args };
    for (const [i,arg] of args.entries()) {
      if (typeof arg === "string" && arg.length > 42) {
        // // We slice txData bytes to avoid unnecessarily long logs
        argsCopy[i] = argsCopy[i].slice(0,10);
        logger.info(`Executing method ${propertyKey} with args`, args);
      }
    }

    const result = originalMethod.apply(this, args);
    return result;
  };

  return descriptor;
};

