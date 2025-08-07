import * as hre from "hardhat";
import { MongoDBAdapter } from "../deploy/db/mongo-adapter/mongo-adapter";
import { VERSION_TYPES } from "../deploy/db/mongo-adapter/constants";
import { getLogger } from "../deploy/logger/create-logger";
import { znsNames } from "../deploy/missions/contracts/names";
import { getContractDataForUpgrade } from "./upgrade";


export const updateDbAndVerifyAll = async (
  dbAdapter : MongoDBAdapter,
) => {
  const logger = getLogger();

  const version = process.env.MONGO_DB_VERSION
  
  let newDbVersion : string;

  if (version) {
    newDbVersion = version;
  } else {
    newDbVersion = Date.now().toString();
  }

  const newContractsVersion = dbAdapter.getContractsVersionFromFile();
  logger.info(
    `Updating DB "${dbAdapter.dbName}" with new version: ${newDbVersion} and contracts version: ${newContractsVersion}`
  );

  // Update the version in the DB to TEMP while processing
  const insertResult = await dbAdapter.versions.insertOne({
    type: VERSION_TYPES.temp,
    dbVersion: newDbVersion,
    contractsVersion: newContractsVersion,
  });

  const contractNames = JSON.parse(JSON.stringify(znsNames));
  delete contractNames.erc1967Proxy;
  contractNames.meowToken.contract = process.env.MOCK_MEOW_TOKEN === "true"
    ? contractNames.meowToken.contractMock
    : contractNames.meowToken.contract;

  const contractData = await getContractDataForUpgrade(dbAdapter, contractNames);

  for (const { contractName, address } of contractData) {
    let implAddress : string | null;
    if (contractName === znsNames.accessController.contract) {
      implAddress = null;
    } else {
      implAddress = await hre.upgrades.erc1967.getImplementationAddress(
        address as string
      );
    }

    await updateContractInDb({
      dbAdapter,
      contractName,
      proxyAddress: address as string,
      implAddress,
      newDbVersion,
    });

    if (hre.network.name !== "hardhat" && contractName !== znsNames.accessController.contract) {
      try {
        await hre.run("verify:verify", {
          address: implAddress,
        });
      } catch (e) {
        logger.error(`Verification of ${address} failed with error ${e}`);
      }
    }
  }

  // Update the version in the DB as UPGRADED
  const replaceResult = await dbAdapter.versions.replaceOne(
    {
      _id: insertResult.insertedId,
    },
    {
      type: VERSION_TYPES.upgraded,
      dbVersion: newDbVersion,
      contractsVersion: newContractsVersion,
    },
    {
      upsert: true
    }
  )

  if (replaceResult.matchedCount === 0) {
    throw new Error(`Failed to update db data entry for version ${newDbVersion}`);
  }

  logger.info("DB update finished successfully.");
};

export const updateContractInDb = async ({
  dbAdapter,
  contractName,
  proxyAddress,
  implAddress,
  newDbVersion,
} : {
  dbAdapter : MongoDBAdapter;
  contractName : string;
  proxyAddress : string;
  implAddress : string | null;
  newDbVersion : string;
}) => {
  const artifactName = contractName === znsNames.accessController.contract
    || contractName === znsNames.meowToken.contract
    || contractName === znsNames.meowToken.contractMock
    ? contractName
    : `${contractName}Pausable`;

  const { abi, bytecode } = hre.artifacts.readArtifactSync(artifactName);

  await dbAdapter.writeContract(
    contractName,
    {
      name: contractName,
      address: proxyAddress,
      implementation: implAddress,
      abi: JSON.stringify(abi),
      bytecode,
    },
    newDbVersion,
  );
};
