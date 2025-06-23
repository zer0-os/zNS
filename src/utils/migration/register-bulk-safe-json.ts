import * as hre from "hardhat";
import { DeployZNSParams, } from "../../../test/helpers";
import { REGISTER_ROOT_BULK_ABI, REGISTER_SUBS_BULK_ABI, ROOT_COLL_NAME, SAFE_TRANSFER_FROM_ABI, SUB_COLL_NAME } from "./constants";
import { Domain, SafeBatch, SafeTx } from "./types";
import { Addressable, ZeroAddress, ZeroHash } from "ethers";
import { connect } from "./helpers";
import { IZNSContractsCache } from "../../deploy/campaign/types";
import { getZNS } from "./zns-contract-data";
import * as fs from "fs";


/**
 * Generates JSON files for bulk registration of root and subdomains
 * and transfers of all domains to their respective owners.
 */
const main = async () => {
  const [ migrationAdmin ] = await hre.ethers.getSigners();

  const outputDir = "output";
  fs.mkdirSync(outputDir, { recursive: true });

  // First, create batches for all root domains
  const rootsFolderName = "registration/roots"
  fs.mkdirSync(`${outputDir}/${rootsFolderName}`, { recursive: true });

  const zns = await getZNS(migrationAdmin);

  // Get MongoDB client
  const client = await connect();

  // Get all root domain documents from collection
  const rootDomains = await client.collection(ROOT_COLL_NAME).find().toArray() as unknown as Domain[];

  // Create batch JSON files for root domains
  createBatches(
    rootDomains,
    zns,
    `${outputDir}/${rootsFolderName}`,
    true
  );

  const subsFolderName = "registration/subs";
  fs.mkdirSync(`${outputDir}/${subsFolderName}`, { recursive: true });

  // Get all subdomain documents from collection, sorted by depth
  const subdomains = await client.collection(SUB_COLL_NAME).find().sort({ depth: 1, _id: 1}).toArray() as unknown as Domain[];
  createBatches(
    subdomains,
    zns,
    `${outputDir}/${subsFolderName}`
  ); 

  // Now setup transfer calls
  const allDomains = [ ...rootDomains, ...subdomains ]

  const sliceSize = Number(process.env.TRANSFER_SLICE) ?? 500;

  let batchIndex = 0
  let batch = allDomains.slice(batchIndex, batchIndex + sliceSize);

  while (batch.length > 0) {
    let batchTx = createBatchTemplate("Batch Transfer");

    for (let i = 0; i < batch.length; i++) {
      const domain = batch[i];

      batchTx.transactions.push(
        createTx(
          zns.domainToken.target,
          "safeTransferFrom",
          SAFE_TRANSFER_FROM_ABI
        )
      );

      // safeTransferFrom(from, to, tokenId
      batchTx.transactions[i].contractInputsValues = {
        from: `${zns.domainToken.target}`,
        to: `${domain.address}`,
        tokenId: `${domain.tokenId}`,
      };
    }

    // Write batch to file
    const fileNumber = batchIndex > 9 ? batchIndex : `0${batchIndex}`;
    fs.mkdirSync(`${outputDir}/transfer`, { recursive: true });
    fs.writeFileSync(`${outputDir}/transfer/batch_${fileNumber}.json`, JSON.stringify(batchTx, null, 2));

    batchIndex++;
    batch = allDomains.slice(batchIndex * sliceSize, batchIndex * sliceSize + sliceSize);
  }

  process.exit(0);
};

const createBatches = async (
  domains : Domain[],
  zns : IZNSContractsCache,
  outputFile : string,
  rootDomains : boolean = false,
  sliceSize : number = Number(process.env.DOMAIN_SLICE) || 50
) => {
  let index = 0;

  let domainsBatch = domains.slice(index, index + sliceSize);

  while (domainsBatch.length > 0) {
    const batchTx = createBatchTemplate("Batch Registration");

    let contractAddress : string;
    let funcName : string;
    let funcAbi : Object;

    if (rootDomains) {
      contractAddress = await zns.rootRegistrar.getAddress();
      funcName = "registerRootDomainBulk";
      funcAbi = REGISTER_ROOT_BULK_ABI;
    } else {
      contractAddress = await zns.subRegistrar.getAddress();
      funcName = "registerSubDomainBulk";
      funcAbi = REGISTER_SUBS_BULK_ABI;
    }

    batchTx.transactions.push(
      createTx(
        contractAddress,
        funcName,
        funcAbi
      )
    );

    batchTx.transactions[0].contractInputsValues.args = [];

    for (let domain of domainsBatch) {
      const valuesArr = [
        domain.label,
        domain.address,
        domain.owner.id,
        domain.tokenURI,
        `[\"${ZeroAddress}\",0,0,"0x"]`,
        `[\"${ZeroAddress}\",\"${ZeroAddress}\"]`,
      ]

      if (domain.parentHash !== ZeroHash) {
        batchTx.transactions[0].contractInputsValues.args.push([domain.parentHash, ...valuesArr]);
      } else {
        batchTx.transactions[0].contractInputsValues.args.push(valuesArr);
      }
    }

    const fileNumber = index > 9 ? index.toString() : `0${index}`;
    fs.writeFileSync(`${outputFile}/batch_${fileNumber}.json`, JSON.stringify(batchTx, null, 2));

    // Increment, get more domains
    index++;
    const nextSlice = index * sliceSize;
    domainsBatch = domains.slice(nextSlice, nextSlice + sliceSize);
  }
}

const createBatchTemplate = (
  name : string = "Batch Transaction"
) : SafeBatch => {
  return {
    version: "1.0",
    chainId: process.env.CHAIN_ID ?? "1", 
    createdAt: Date.now(),
    meta: {
      name,
      description: "",
      txBuilderVersion: "1.18.0",
      createdFromSafeAddress: process.env.SAFE_ADDRESS ?? "",
      createdFromOwnerAddress: process.env.SAFE_OWNER_ADDRESS ?? "",
      checksum: ""
    },
    transactions: [ ]
  }
}

const createTx = (
  to: string | Addressable,
  funcName : string,
  funcAbi : Object,
) : SafeTx => {
  return {
    to: to,
    value: "0",
    data: null,
    contractMethod: {
      inputs: [ funcAbi ],
      name:  funcName,
      payable: false,
    },
    contractInputsValues: {}
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
