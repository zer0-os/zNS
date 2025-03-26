import * as hre from "hardhat";
import { MongoDBAdapter } from "../deploy/db/mongo-adapter/mongo-adapter";


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

  await dbAdapter.contracts.updateOne(
    {
      name: contractName,
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
