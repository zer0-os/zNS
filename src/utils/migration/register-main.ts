import * as hre from "hardhat";
import { SafeKit } from "./safeKit";
import { Domain, SafeKitConfig } from "./types";
import { connectToDb } from "./helpers";
import { ROOT_COLL_NAME, ROOT_DOMAIN_BULK_SELECTOR, SUB_COLL_NAME, SUBDOMAIN_BULK_SELECTOR } from "./constants";
import { proposeRegistrations } from "./proposeRegisterDomains";
import { getZNS } from "./zns-contract-data";
import { ZeroAddress } from "ethers";

import * as fs from "fs"; // TODO for debuggig, remove  

import { TLogger } from '@zero-tech/zdc';
import { getZnsLogger } from '../../deploy/get-logger';

// it would be good as a backup to always create batches for safe API
// along with creating JSON for same batches AND JSON for each individual domain
// to call singular `registerSubdomain` function as well

import SafeApiKit, { PendingTransactionsOptions, SafeMultisigTransactionEstimate, SafeMultisigTransactionEstimateResponse, SafeMultisigTransactionListResponse } from '@safe-global/api-kit'
import { SafeTransactionOptionalProps } from "@safe-global/protocol-kit";
import { MetaTransactionData, OperationType } from "@safe-global/types-kit";

/**
 * Script to create and propose signed transactions to the Safe for
 * as part of the second half of the ZNS domain migration.
 * 
 * This script will get the latest ZNS contracts as well as the domain information
 * from MongoDB. Then that data is formed into batches of raw txData encoding to
 * propose to the safe.
 * 
 * Required .env variables for running this script:
 * - MONGO_DB_URI
 * - MONGO_DB_NAME
 * - MONGO_DB_VERSION
 * - MONGO_DB_URI_MIG (The domain data is in a different cluster that needs a different connection)
 * - MONGO_DB_NAME_MIG
 * - SAFE_ADDRESS
 * - SAFE_OWNER (for HardHat config)
 * - CHAIN_ID
 * - [NETWORK]_RPC_URL (substitute NETWORK for the specific network being used)
 * 
 * Optional .env vars
 * - DELAY
 * - RETRIES
 * 
 * Required steps:
 * - ZNS v1.5 contracts must have been deployed to the target network
 * - ERC20 contract must have been deployed to the target network
 * - The Safe must already exist
 * - The Safe must have given approval for the ZNSTreasury to spend  
 * - The Safe must have the need ERC20 balance to register
 * - The Safe must have enough native token to fund the gas needed for each batch
 * 
 * Execution: After manually setting the `action` desired, run
 * `yarn hardhat run src/utils/migration/register-main.ts --network [NETWORK]
 * 
 * Note: Parent domains must exist for child domains to be minted. This will fail in
 * gas estimation by the SafeKit if the parent domain does not exist already, so we 
 * must propose *and* execute all root domains before we can propose any subdomains
 * 
 * Note: Manual gas estimation is done in the SafeKit as the documentation specifies
 * that while estimation is done automatically if excluded, it may not be accurate for
 * more complex transactions. To avoid the possibility of this failing downstream, this
 * is done here.
 * 
 * Note: Executing more than ~20 transactions sequentially isn't recommended. 
 * This may cause the provider to ignore transactions, incorrectly showing
 * they executed successfully.
 */
const main = async () => {
  const [ migrationAdmin ] = await hre.ethers.getSigners();

  const logger : TLogger = getZnsLogger();

  // Get domain data from different db
  const client = await connectToDb();

  const safeAddress = process.env.SAFE_ADDRESS;
  if (!safeAddress) throw Error("No Safe address was provided");

  // Modify as needed, using Sepolia for testing
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw Error("No RPC URL was provided");

  const chainId = process.env.CHAIN_ID;
  if (!chainId) throw Error("No chain ID was provided");

  const config : SafeKitConfig = {
    network : hre.network.name,
    chainId: BigInt(chainId),
    rpcUrl,
    safeAddress,
    safeOwnerAddress: migrationAdmin.address,
    delay: Number(process.env.DELAY) || 10000, // ms to wait between proposing/executing transactions
    retryAttempts: Number(process.env.RETRIES) || 3, // Number of times to retry executing a tx if it fails TODO impl
    db: client
  }

  // Setup the SafeKit
  const safeKit = await SafeKit.init(config);

  // If admin given is not a Safe owner, fail early
  if (!await safeKit.isOwner(migrationAdmin.address)) {
    throw Error("Migration admin is not a Safe owner");
  }

  // We use this flag to separate root domain and subdomain registration
  // This is because gas estimation of a tx that includes registration of
  // a domain where a parent does not exist yet will fail. So the root domain batch
  // must be proposed *and* executed before subdomain registration can be proposed
  // Likewise, any transfers will fail gas estimation for domains that do not exist yet.

  let action = "subs"; // <--- Set this variable before each run as "roots", "subs", or "transfer"

  const zns = await getZNS(migrationAdmin);

  let transfers;
  switch (action) {
    case "roots":
      logger.info("Proposing root domain registrations...");

      const rootDomains = await client.collection(ROOT_COLL_NAME).find().toArray() as unknown as Domain[];

      transfers = await proposeRegistrations(
        await zns.rootRegistrar.getAddress(),
        safeKit,
        rootDomains.slice(50),
        ROOT_DOMAIN_BULK_SELECTOR
      );

      // Store transfers for after execution of registrations
      await client.collection(`${ROOT_COLL_NAME}-transfers`).insertOne({ batches: transfers });
      break;
    case "subs":
      // let pendingTxs = await safeKit.apiKit.getPendingTransactions(config.safeAddress, { ordering: "nonce" });
      // for (let [i,tx] of pendingTxs.results.entries()) {
      //   console.log(i, tx.nonce, tx.safeTxHash);
      //   await safeKit.protocolKit.executeTransaction(tx);
      // }

      // For debugging, verify that parents exist
      // for (let [i,d] of rootDomains.entries()) {
      //   const owner = await zns.registry.getDomainOwner(d.id);
      //   if (owner === ZeroAddress) {
      //     console.log(i, d.label, d.id)
      //   }
      // }
      // const txs = await safeKit.apiKit.getAllTransactions(safeAddress);
      // 8630200
      // for (let [i,tx] of txs.results.entries()) {
      //   if (tx.blockNumber == 8630200) {
      //     console.log(txs.results.length - i - 1, i, tx.blockNumber, tx.to)
      //   }
      // }


      const subdomains = await client.collection(SUB_COLL_NAME).find().sort({ depth: 1, _id: 1}).toArray() as unknown as Domain[];
      // const lvl1s = subdomains.filter(d => d.depth === 1);

      // for (let [i,d] of [...rootDomains, ...lvl1s].entries()) {
      //   const owner = await zns.registry.getDomainOwner(d.id);
      //   if (owner === ZeroAddress) {
      //     console.log("unminted lvl1:", i, d.label, d.id);
      //   }
      // };

      // logger.info("Proposing subdomain registrations...");

      const lvl2s = subdomains.filter(d => d.depth === 2);

      // lvl2s.forEach((d,i) => { console.log(i, d.label, d.id, d.parent?.label, d.parent?.id)});
      for(let [i,d] of lvl2s.entries()) {
        let parentHash;
        if (d.parent && d.parent.id) {
          parentHash = d.parent.id
        } else {
          parentHash = d.parentHash
        }
        
        // check lvl1 subs that didnt get minted
        // vs lvl2 subs who have parent.id or parent hash as 0x0 in reg
        if (!parentHash) {
          console.log("lvl2 with no parenthash or parent.id")
          console.log(i, d.label, d.id)
        }

        const owner = await zns.registry.getDomainOwner(parentHash);

        if (owner === ZeroAddress) {
          // console.log("resolved parentHash: ", parentHash)
          // console.log("lvl2 with 0x0 parent", i, d.label, d.id, d.parent?.label, d.parent?.id, d.parentHash);

          // The parents domain information, to register ourselves (the lvl1 that is missing)
          console.log(i, d.parent?.label, d.parent?.id,)
        }
      }



      // for(let [i,d] of lvl1s.entries()) {
      //   if (
      //          d.label === "nft"
      //       || d.label === "belshe"
      //       || d.label === "exhibition"
      //       || d.label === "commission"
      //     ) {
      //       const owner = await zns.registry.getDomainOwner(d.id);
      //       console.log(i, d.label, d.depth, owner.toString(), d.parentHash, d.parent?.id);
      //   }
      // }
      //   if (await zns.registry.getDomainOwner(d.id) === ZeroAddress) {
      //     console.log(i, d.label, d.id)
      //   }
      // }
    
      let depth = 2;
      transfers = await proposeRegistrations(
        await zns.subRegistrar.getAddress(),
        safeKit,
        subdomains.filter(d => d.depth === depth),
        SUBDOMAIN_BULK_SELECTOR
      );
      break;
    case "transfer":
      // Grab stored transfer txs from earlier runs
      const rootTransfers = client.collection(`${ROOT_COLL_NAME}-transfers`).find() as unknown as string[];
      const subTransfers = client.collection(`${SUB_COLL_NAME}-transfers`).find() as unknown as string[];

      await safeKit.createProposeSignedTxs(
        await zns.domainToken.getAddress(),
        [ ...rootTransfers, ...subTransfers ]
      )
      break;
    default:
      throw Error("Unknown action");
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  process.exit(0);
});