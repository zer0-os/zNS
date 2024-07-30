import { getMongoAdapter, MongoDBAdapter } from "@zero-tech/zdc";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { znsNames } from "../../deploy/missions/contracts/names.ts";
import * as hre from "hardhat";
import { MeowToken__factory } from "@zero-tech/ztoken/typechain-js";


let mongoAdapter : MongoDBAdapter | null = null;
export let dbVersion : string;


// TODO mig: !!! ADD A READ-ONLY MODE TO THE DB ADAPTER SO WE CAN'T MESS IT UP !!!
const getDBAdapter = async () => {
  if (!process.env.MONGO_DB_VERSION)
    throw new Error("MONGO_DB_VERSION is not defined. A current version you want to read from is required!");

  dbVersion = process.env.MONGO_DB_VERSION;

  if (!mongoAdapter) {
    mongoAdapter = await getMongoAdapter();
  }

  return mongoAdapter;
};

export const getContractFromDB = async ({
  name,
  version,
  signer,
} : {
  name : string;
  version ?: string;
  signer ?: SignerWithAddress;
}) => {
  const dbAdapter = await getDBAdapter();

  const contract = await dbAdapter.getContract(
    name,
    version,
  );
  if (!contract) throw new Error("Contract not found in DB. Check name or version passed.");

  let factory;
  if (name !== znsNames.meowToken.contract) {
    factory = await hre.ethers.getContractFactory(name, signer);
  } else {
    factory = new MeowToken__factory(signer);
  }

  if (!factory) throw new Error("Invalid contract name or db name is different from contract name");

  return factory.attach(contract.address);
};

