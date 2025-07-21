import { Db } from "mongodb";
import { ZeroAddress, ZeroHash } from "ethers";
import { getDBAdapter } from "./database";
import {
  Domain,
  IRootDomainRegistrationArgs,
  ISubdomainRegistrationArgs,
  RootRegistrationArgsBatches,
  SubRegistrationArgsBatches,
} from "./types";
import { ZNSDomainToken__factory, ZNSRootRegistrar__factory, ZNSSubRegistrar__factory } from "../../../typechain";
import { SUBDOMAIN_BULK_SELECTOR } from "./constants";
import { getZnsLogger } from "../../deploy/get-logger";
import { SafeKit } from "./safeKit";
import { OperationType } from "@safe-global/types-kit";

/**
 * Create and propose batch transactions to the Safe for domain registrations
 *
 * @param to The contract address to send transactions to
 * @param safeKit The SafeKit instance for transaction handling
 * @param domains Array of domains to register
 * @param selector Function selector for the registration method
 */
export const proposeRegistrations = async (
  to : string,
  safeKit : SafeKit,
  domains : Array<Domain>,
  selector : string
) => {
  const registrations = createBatches(
    domains,
    selector,
  ) as Array<string>;

  // Create proposals for registering domains
  await Promise.all([
    safeKit.createProposeSignedTxs(
      to,
      registrations
    ),
  ]);
};

/**
 * Connect to the MongoDB database to read domain data for migration
 *
 * @param mongoUri Optional MongoDB connection URI (falls back to environment variable)
 * @param mongoDbName Optional database name (falls back to environment variable)
 * @returns Promise resolving to the MongoDB database instance
 * @throws {Error} When connection URI or database name is not provided
 */
export const connectToDb = async (
  mongoUri ?: string,
  mongoDbName ?: string
) : Promise<Db> => {
  const uri = process.env.MONGO_DB_URI_WRITE ?? mongoUri;
  if (!uri) throw new Error(
    "No MongoDB connection string provided. Set MONGO_DB_URI_WRITE environment variable or pass mongoUri parameter"
  );

  const dbName = process.env.MONGO_DB_NAME_WRITE ?? mongoDbName;
  if (!dbName) throw new Error(
    "No MongoDB database name provided. Set MONGO_DB_NAME_WRITE environment variable or pass mongoDbName parameter"
  );

  // Return socket connection
  return (await getDBAdapter(uri)).db(dbName);
};

/**
 * Create registration and transfer batches to use as transaction data
 *
 * @param domains Array of domains to process
 * @param functionSelector Optional function selector for Safe transactions
 * @param registerSliceSize Number of registrations per batch (default: 50)
 * @returns Array of encoded transaction data or registration argument batches
 */
export const createBatches = (
  domains : Array<Domain>,
  functionSelector ?: string,
  registerSliceSize = 50,
) : Array<string> | RootRegistrationArgsBatches | SubRegistrationArgsBatches => {
  if (functionSelector) {
    return createBatchesSafe(
      domains,
      functionSelector,
      registerSliceSize,
    );
  } else {
    return createBatchesEOA(
      domains,
      registerSliceSize
    ) as RootRegistrationArgsBatches | SubRegistrationArgsBatches;
  }
};

/**
 * Create transaction batches used in the `register-bulk-eoa.ts` script
 *
 * @param domains Array of domains to process
 * @param sliceSize Number of domains per batch (default: 50)
 * @returns Array of batched registration arguments
 */
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

/**
 * Create encoded transaction batches for Safe multisig operations
 *
 * @param domains Array of domains to process
 * @param functionSelector Function selector to determine registration type
 * @param registerSliceSize Number of registrations per batch
 * @returns Array of encoded transaction data strings
 * @throws {Error} When Safe address is not configured or parentHash is missing for subdomains
 */
const createBatchesSafe = (
  domains : Array<Domain>,
  functionSelector : string,
  registerSliceSize : number,
) : Array<string> => {
  // For registration we already have bulk functions, so each push to this array is an encoded batch
  const batchRegisterTxs : Array<string> = [];

  // Get safe address being used
  const safeAddress = process.env.SAFE_ADDRESS;
  if (!safeAddress) {
    throw new Error("No Safe address set in environment variables. Set SAFE_ADDRESS environment variable");
  }

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  let registrationBatch : Array<any> = [];

  for (const [index, domain] of domains.entries()) {
    const args = {
      name: domain.label,
      domainAddress: domain.owner.id,
      tokenOwner: safeAddress,
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
        throw new Error("No parentHash for subdomain. Registration requires parent hash to be set");
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
  }

  return batchRegisterTxs;
};


// Get the logger instance for the decorator function below
const logger = getZnsLogger();

/**
 * Function decorator to log each method execution with argument details
 *
 * Automatically logs method calls with sanitized arguments (truncates long strings
 * like transaction data to avoid excessive log output)
 *
 * @param target The target object
 * @param propertyKey The method name being decorated
 * @param descriptor The property descriptor
 * @returns Modified property descriptor with logging functionality
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export const LogExecution = (target : any, propertyKey : string, descriptor : PropertyDescriptor) => {
  const originalMethod = descriptor.value;

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  descriptor.value = function (...args : Array<any>) {
    const argsCopy = { ...args };
    for (const [i,arg] of args.entries()) {
      if (typeof arg === "string" && arg.length > 42) {
        // We slice txData bytes to avoid unnecessarily long logs
        argsCopy[i] = args[i].slice(0,10);
        logger.info(`Executing method ${propertyKey} with args`, args);
      }
    }

    const result = originalMethod.apply(this, args);
    return result;
  };

  return descriptor;
};

/**
 * Create transfer transactions for domain tokens to their respective owners
 *
 * @param to The contract address to send transfer transactions to
 * @param domains Array of domains to create transfers for
 * @returns Array of transfer transaction objects for Safe execution
 * @throws {Error} When Safe address is not configured
 */
export const createTransfers = (
  to : string,
  domains : Array<Domain>,
) => {
  const transfers = [];

  // Get safe address being used
  const safeAddress = process.env.SAFE_ADDRESS;
  if (!safeAddress) {
    throw new Error("No Safe address set in environment variables. Set SAFE_ADDRESS environment variable");
  }

  for (const domain of domains) {
    if (!domain.isRevoked) {
      const transferEncoding = ZNSDomainToken__factory.createInterface().encodeFunctionData(
        "safeTransferFrom(address,address,uint256)",
        [ safeAddress, domain.owner.id, domain.tokenId ]
      );

      // The `to` address must be the contract the multisig will call,
      // not the multisig itself
      transfers.push({
        to,
        value: "0",
        data: transferEncoding,
        operation: OperationType.Call,
      });
    }
  }

  return transfers;
};
