import * as hre from "hardhat";
import { SafeKit } from "./safeKit"

// Gnosis Safe Modules
import SafeApiKit, { ProposeTransactionProps } from '@safe-global/api-kit'
import Safe from '@safe-global/protocol-kit'
import { MetaTransactionData, OperationType } from "@safe-global/types-kit";
import { getDBAdapter, getZNSFromDB } from "./database";
import { ROOT_COLL_NAME, ROOT_DOMAIN_BULK_SELECTOR, SAFE_TRANSFER_FROM_SELECTOR, SUB_COLL_NAME, SUBDOMAIN_BULK_SELECTOR } from "./constants";
import { Domain, IRootDomainRegistrationArgs, ISubdomainRegisterArgs, SafeKitConfig } from "./types";
import { connect, createBatches } from "./helpers";
import { ZeroAddress } from "ethers";
import { getZNS } from "./zns-contract-data";

import { ERC20Mock__factory, ERC20Mock, ZNSRootRegistrar__factory, ZNSDomainToken__factory } from "../../../typechain";

// todo extract db connection to a separate file
// Options
// 1. generate json, upload manually
// 2. generate and propose programmatically
// 3. generate, propose, sign, execute programmatically
// 4. use EOA to form and call to contract directly

// Using Safe API Kit and Protocol Kit
const main = async () => {
  const [ migrationAdmin ] = await hre.ethers.getSigners();

  const config : SafeKitConfig = {
    network : hre.network.name,
    chainId: BigInt(process.env.SEPOLIA_CHAIN_ID!),
    rpcUrl: process.env.SEPOLIA_RPC_URL!,
    safeAddress: process.env.TEST_SAFE_ADDRESS!,
    safeOwnerAddress: migrationAdmin.address,
  }

  const safeKit = await SafeKit.init(config);

  // If admin given is not a Safe owner, fail early
  if (hre.network.name !== "hardhat" && !await safeKit.isOwner(migrationAdmin.address)) {
    throw new Error("Migration admin is not a Safe owner");
  }

  // Get ZNS
  const zns = await getZNS(migrationAdmin, "test");

  if (await zns.meowToken.balanceOf(config.safeAddress) === 0n) {
    const mintTx = await zns.meowToken.mint(config.safeAddress, hre.ethers.parseEther("999999"));
    await mintTx.wait(hre.network.name !== "hardhat" ? 3 : 0);
  }

  // Approve the treasury to spend the Safe's MEOW tokens
  if (await zns.meowToken.allowance(config.safeAddress, zns.treasury.target) === 0n) { 
    // TODO PROPOSE THE APPROVAL WITH THE SAFE
    // safeKit.giveApproval(safeAddress, token)
  }

  // Get domain data from different db
  const client = await connect();

  console.log("Getting root domains from db...");
  const rootDomains = await client.collection(ROOT_COLL_NAME).find().toArray() as unknown as Domain[];
  
  console.log("Getting subdomains from db...");
  const subdomains = await client.collection(SUB_COLL_NAME).find().sort({ depth: 1, _id: 1}).toArray() as unknown as Domain[];
  
  console.log("Creating root domain register and transfer batches...");
  const [ rootBatches, rootTransfers ] = createBatches(
    rootDomains.slice(3,7), // TODO remove slice after debug
    ROOT_DOMAIN_BULK_SELECTOR,
    2 // manual 2 domains per batch
  ) as [ string[], string[] ];
  
  // console.log("Creating subdomain register and transfer batches...");
  // const [ subBatches, subTransfers ] = createBatches(subdomains, SUBDOMAIN_BULK_SELECTOR) as [ string[], string[] ];

  // The value of what the next nonce in teh Safe should be
  const currentNonce = await safeKit.protocolKit.getNonce();

  // Form tx, sign, and propose each batch to Safe
  console.log("Proposing all batches to Safe...");
  for (const [index, txData] of [ ...rootBatches ].entries()) { // Add after test //   ...subBatches, ...rootTransfers, ...subTransfers]
    let proposalData : ProposeTransactionProps;

    if (txData.slice(0,10) === ROOT_DOMAIN_BULK_SELECTOR) {
      proposalData = await safeKit.createSignedTx(
        zns.rootRegistrar.target.toString(),
        txData,
        currentNonce + index, // Must provide a nonce to order transactions sequentially
      );
    } else if (txData.slice(0,10) === SUBDOMAIN_BULK_SELECTOR) {
      proposalData = await safeKit.createSignedTx(
        // zns.subRegistrar.target.toString(),
        zns.subRegistrar.target.toString(),
        txData,
        currentNonce + index,

      );
    } else if (txData.slice(0,10) === SAFE_TRANSFER_FROM_SELECTOR) {
      proposalData = await safeKit.createSignedTx(
        zns.domainToken.target.toString(),
        txData,
        currentNonce + index,
      );
    } else {
      throw new Error(`Unknown transaction data selector: ${txData.slice(0,10)}`);
    }

    console.log(`Proposing batch tx: ${index} for: ${txData.slice(0,10)}`);

    await safeKit.proposeTx(proposalData);
  }

  console.log("All batches proposed to Safe");
}


main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  process.exit(0);
});