import * as hre from "hardhat";
import { MongoDBAdapter } from "../deploy/db/mongo-adapter/mongo-adapter";
import { IContractData } from "./types";
import { IDBVersion } from "../deploy/db/mongo-adapter/types";


export const updateAllContractsInDb = async ({
  contractData,
  dbAdapter,
} : {
  contractData : Array<IContractData>;
  dbAdapter : MongoDBAdapter;
}) => {
  for (const { contractName, address } of contractData) {
    const implAddress = await hre.upgrades.erc1967.getImplementationAddress(
      address as string
    );

    await updateContractInDb({
      dbAdapter,
      contractName,
      implAddress,
    });
  }
};

export const updateContractInDb = async ({
  dbAdapter,
  contractName,
  implAddress,
} : {
  dbAdapter : MongoDBAdapter;
  contractName : string;
  implAddress : string;
}) => {
  const { abi, bytecode } = hre.artifacts.readArtifactSync(`${contractName}Pausable`);

  const { dbVersion: curVersion } = await dbAdapter.getLatestVersion() as IDBVersion;

  await dbAdapter.contracts.updateOne(
    {
      name: contractName,
      version: curVersion,
    },
    {
      $set: {
        abi: JSON.stringify(abi),
        bytecode,
        implementation: implAddress,
      },
    },
    {
      upsert: true,
    }
  );
};
