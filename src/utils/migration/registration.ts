import * as hre from "hardhat";
import { deployZNS, DeployZNSParams, IZNSContracts, IZNSContractsLocal, paymentConfigEmpty } from "../../../test/helpers";
import { getZNS } from "./zns-contract-data";
import { getDBAdapter } from "./database";
import { REGISTER_ROOT_BULK_ABI, REGISTER_SUBS_BULK_ABI, ROOT_COLL_NAME, SAFE_TRANSFER_FROM_ABI, SUB_COLL_NAME } from "./constants";

import SafeApiKit from "@safe-global/api-kit";
import { Domain, SafeBatch, SafeTx } from "./types";
import { Addressable, ZeroAddress, ZeroHash } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSRootRegistrar, IZNSSubRegistrar } from "../../../typechain";

import * as fs from "fs";

// Script #2 to be run AFTER validation of the domains with subgraph
const main = async () => {
  const [ migrationAdmin, governor, admin ] = await hre.ethers.getSigners();

  const uri = process.env.MONGO_DB_URI;
  if (!uri) throw Error("No connection string given");

  const dbName = process.env.MONGO_DB_NAME;
  if (!dbName) throw Error("No DB name given");

  const client = (await getDBAdapter(uri)).db(dbName);

  // Get all root domain documents from collection
  const rootDomains = await client.collection(ROOT_COLL_NAME).find().toArray() as unknown as Domain[];

  const outputDir = "output/registration";
  // if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  // }

  // First, create batches for all root domains
  const rootsFolderName = "roots"
  // if (!fs.existsSync(`${outputDir}/${rootsFolderName}`)) {
    fs.mkdirSync(`${outputDir}/${rootsFolderName}`);
  // }

  const params : DeployZNSParams = {
    deployer: migrationAdmin,
    governorAddresses: [migrationAdmin.address],
    adminAddresses: [migrationAdmin.address],
  };

  const zns = await deployZNS(params); // TODO Replace with get from DB when deployed to zchain

  // Create batch JSON files for root domains
  createBatches(
    rootDomains,
    zns,
    `${outputDir}/${rootsFolderName}`,
    true
  );

  const subsFolderName = "subs";
  if (!fs.existsSync(`${outputDir}/${subsFolderName}`)) {
    fs.mkdirSync(`${outputDir}/${subsFolderName}`);
  }

  const subdomains = await client.collection(SUB_COLL_NAME).find().sort({ depth: 1, _id: 1}).toArray() as unknown as Domain[];
  createBatches(
    subdomains,
    zns,
    `${outputDir}/${subsFolderName}`
  ); 

  // There are no subdomains with depth 4 or higher, stop registration here
  // Now setup transfer calls
  const allDomains = [...rootDomains, ...subdomains,]

  const sliceSize = 500;
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

      batchTx.transactions[i].contractInputsValues = {
        from: `${zns.domainToken.target}`, // TODO is this correct?
        to: `${domain.address}`,
        tokenId: `${domain.tokenId}`,
        data: "" // TODO empty? 0x? zerohash?
      };
    }
    const fileNumber = batchIndex > 9 ? batchIndex : `0${batchIndex}`;
    fs.mkdirSync(`output/transfer`, { recursive: true });
    fs.writeFileSync(`output/transfer/batch_${fileNumber}.json`, JSON.stringify(batchTx, null, 2));

    batchIndex++;
    batch = allDomains.slice(batchIndex * sliceSize, batchIndex * sliceSize + sliceSize);
  }

  process.exit(0);
};

const createBatches = (
  domains : Domain[],
  zns : IZNSContracts | IZNSContractsLocal,
  outputFile : string,
  forRootDomains : boolean = false,
  sliceSize : number = 50
) => {
  let index = 0;

  let domainsBatch = domains.slice(index, index + sliceSize);

  while (domainsBatch.length > 0) { // TODO TEMP remove index check after test
    // for single call to registerRootDomain, not bulk, just to test
    const batchTx = createBatchTemplate("Batch Registration");

    let contractAddress;
    let funcName;
    let funcAbi;

    if (forRootDomains) {
      contractAddress = zns.rootRegistrar.target
      funcName = "registerRootDomainBulk";
      funcAbi = REGISTER_ROOT_BULK_ABI;
    } else {
      contractAddress = zns.subRegistrar.target
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

    // TODO rerun validation to get paymentToken, also to refresh data
    for (let domain of domainsBatch) {
      const valuesArr = [
        domain.label,
        domain.address,
        domain.owner.id,
        domain.tokenURI,
        `[\"${domain.pricerContract ?? ZeroAddress}\", ${domain.paymentType ?? 0}, ${domain.accessType ?? 0}]`,
        `[\"${domain.treasury.paymentToken ?? ZeroAddress}\",\"${domain.treasury.beneficiaryAddress ?? ZeroAddress}\"]`,
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
    domainsBatch = domains.slice(index * sliceSize, index * sliceSize + sliceSize);
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
      txBuilderVersion: "1.18.0", // TODO confirm this is correct for zchain, or needs to be correct at all
      createdFromSafeAddress: process.env.SAFE_ADDRESS ?? "",
      createdFromOwnerAddress: "", // TODO set this
      checksum: "" // TODO calc this for each batch
    },
    transactions: [ ]
  }
}

const createTx = (
  to: string | Addressable,
  funcName : string,
  funcAbi : any, // TODO type?
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
