import * as hre from "hardhat";
import { deployZNS, DeployZNSParams, IZNSContracts, IZNSContractsLocal } from "../../../test/helpers";
import { getZNS } from "./zns-contract-data";
import { getDBAdapter } from "./database";
import { ROOT_COLL_NAME } from "./constants";

import SafeApiKit from "@safe-global/api-kit";
import { SafeBatch, SafeTx } from "./types";
import { Addressable, ZeroAddress } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSRootRegistrar, IZNSSubRegistrar } from "../../../typechain";

import * as fs from "fs";

// We will need to adjust this file in the future no matter what after merging happens
// ignore this file for now
/* eslint-disable */
/* @typescript-eslint-disable */


// Script #2 to be run AFTER validation of the domains with subgraph
const main = async () => {
  const [ migrationAdmin, governor, admin ] = await hre.ethers.getSigners();

  // const env = process.env.ENV_LEVEL;
  // if (!env) throw Error("No ENV_LEVEL set in .env file");
  // TODO when deployed read/write zns on zchain
  // zns = await getZNS(migrationAdmin, env);

  const uri = process.env.MONGO_DB_URI;
  if (!uri) throw Error("No connection string given");

  const dbName = process.env.MONGO_DB_NAME;
  if (!dbName) throw Error("No DB name given");

  const client = (await getDBAdapter(uri)).db(dbName);

  // Get all root domain documents from collection
  const domains = await client.collection(ROOT_COLL_NAME).find().toArray();

  // // 1146, matches db
  // console.log(domains.length);

  const params : DeployZNSParams = {
    deployer: migrationAdmin,
    governorAddresses: [migrationAdmin.address],
    adminAddresses: [migrationAdmin.address],
  };

  // Get the `registerRootDomainBulk` function selector
  const zns = await deployZNS(params);
  const selector = zns.rootRegistrar.interface.getFunction("registerRootDomainBulk").selector;
  const toAddr = zns.rootRegistrar.target;

  // for single call to registerRootDomain, not bulk, just to test
  const batchTx = createBatch(toAddr, true);

  // just for a single domain
  for (let domain of domains.slice(0,50)) {
    const inputValues = [
      `${domain.label}`, // name
      `${domain.address}`, // domainAddress
      `${domain.minter.id}`, // tokenOwner
      `${domain.tokenURI}`, // tokenURI
      `[\"${domain.pricerContract}\",${domain.paymentType},${domain.accessType}]`, // distrConfig(pricerContract, paymentType, accessType)
      `[\"${domain.treasury.paymentToken}\",\"${domain.treasury.beneficiaryAddress}\"]`// paymentConfig(token, beneficiary)
    ];

    batchTx.transactions[0].contractInputValues.args.push(inputValues);
  } // TODO confirm if output is right format for array of structs

  fs.writeFileSync("batch.json", JSON.stringify(batchTx, null, 2));

  process.exit(0);
};

const createBatch = (
  contract : string | Addressable,
  bulk : boolean
) : SafeBatch => {
  return {
    version: "1.0",
    chainId: process.env.CHAIN_ID ?? "1", 
    createdAt: Date.now(),
    meta: {
      name: "Register Root Domains Batch",
      description: "",
      txBuilderVersion: "1.18.0", // TODO confirm this is correct for zchain
      createdFromSafeAddress: process.env.SAFE_ADDRESS ?? "",
      createdFromOwnerAddress: "", // TODO set this
      checksum: "" // TODO calc this for each batch
    },
    transactions: [ createTxJSON(contract, bulk) ]
  }
}


const createTxJSON = (
  to: string | Addressable,
  bulk : boolean
) : SafeTx => {
  let tx : SafeTx = {
    to: to,
    value: "0",
    data: null,
    contractMethod: {
      inputs: [],
      name: "registerRootDomain" + (bulk ? "Bulk" : ""), // TODO abstract for both root or sub registrar
      payable: false,
    },
    contractInputValues: {
      args: []
    }
  }

  if (bulk) {
    tx.contractMethod.inputs.push(getRegistertBulkAbi());
  } else {
    tx.contractMethod.inputs.push(getRegisterAbi());
  }

  return tx;
}

const getRegisterAbi = () => {
  return {
    components: [
      {
        internalType: "string",
        name: "name",
        type: "string"
      },
      {
        internalType: "address",
        name: "domainAddress",
        type: "address"
      },
      {
        internalType: "address",
        name: "tokenOwner",
        type: "address"
      },
      {
        internalType: "string",
        name: "tokenURI",
        type: "string"
      },
      {
        components: [
          {
            internalType: "contract IZNSPricer",
            name: "pricerContract",
            type: "address"
          },
          {
            internalType: "enum IDistributionConfig.PaymentType",
            name: "paymentType",
            type: "uint8"
          },
          {
            internalType: "enum IDistributionConfig.AccessType",
            name: "accessType",
            type: "uint8"
          }
        ],
        internalType: "struct IDistributionConfig.DistributionConfig",
        name: "distrConfig",
        type: "tuple"
      },
      {
        components: [
          {
            internalType: "contract IERC20",
            name: "token",
            type: "address"
          },
          {
            internalType: "address",
            name: "beneficiary",
            type: "address"
          }
        ],
        internalType: "struct PaymentConfig",
        name: "paymentConfig",
        type: "tuple"
      }
    ],
    internalType: "struct IZNSRootRegistrar.RootDomainRegistrationArgs",
    name: "args",
    type: "tuple"
  }
}

const getRegistertBulkAbi = () => {
  return { 
    // struct RootDomainRegistrationArgs[]
    components: [
      {
        internalType: "string",
        name: "name",
        type: "string"
      },
      {
        internalType: "address",
        name: "domainAddress",
        type: "address"
      },
      {
        internalType: "address",
        name: "tokenOwner",
        type: "address"
      },
      {
        internalType: "string",
        name: "tokenURI",
        type: "string"
      },
      { // struct DistributionConfig
        components: [
          {
            internalType: "contract IZNSPricer",
            name: "pricerContract",
            type: "address"
          },
          {
            internalType: "enum IDistributionConfig.PaymentType",
            name: "paymentType",
            type: "uint8"
          },
          {
            internalType: "enum IDistributionConfig.AccessType",
            name: "accessType",
            type: "uint8"
          }
        ],
        internalType: "struct IDistributionConfig.DistributionConfig",
        name: "distrConfig",
        type: "tuple"
      },
      { // struct PaymentConfig
        components: [
          {
            internalType: "contract IERC20",
            name: "token",
            type: "address"
          },
          {
            internalType: "address",
            name: "beneficiary",
            type: "address"
          }
        ],
        internalType: "struct PaymentConfig",
        name: "paymentConfig",
        type: "tuple"
      }
    ],
    internalType: "struct IRootRegistrar.RootDomainRegistrationArgs[]",
    name: "args",
    type: "tuple[]"
  }
}


main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});


  /// TODO try just making raw json, instead of using API kit for now
  // const apiKit = new SafeApiKit({
  //   chainId: 9369n, // zchain, env? no tx service, need custom
  // });

  // // sample get request to show connection works
  // const safeAddress = process.env.SAFE_ADDRESS;

  // if (!safeAddress) throw Error("No Safe address set in .env file");

  // const safeTx = {
  //   to: safeAddress,
  //   value: "0",
  //   data: "0x",
  //   operation: 0, // 0 for CALL, 1 for DELEGATE_CALL
  // }

  // const estimateTx = await apiKit.estimateSafeTransaction(
  //   safeAddress,
  //   safeTx
  // )

  // console.log(estimateTx);