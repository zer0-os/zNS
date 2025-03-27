import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { compareStorageData, readContractStorage } from "./storage-data";
import { ZNSContract } from "../../test/helpers/types";
import { getLogger } from "../deploy/logger/create-logger";
import { TLogger } from "../deploy/campaign/types";
import { IContractData, IZNSContractsUpgraded, ZNSContractUpgraded } from "./types";
import { Addressable } from "ethers";
import { getMongoAdapter } from "../deploy/db/mongo-adapter/get-adapter";
import { MongoDBAdapter } from "../deploy/db/mongo-adapter/mongo-adapter";
import { updateContractInDb } from "./db";
import { znsNames } from "../deploy/missions/contracts/names";
import { IContractDbData } from "../deploy/db/types";


export const upgradeZNS = async ({
  governorExt,
  contractData,
  dbAdapter,
  logger,
} : {
  governorExt ?: SignerWithAddress;
  contractData : Array<IContractData>;
  dbAdapter : MongoDBAdapter;
  logger : TLogger;
}) => {
  let governor = governorExt;
  if (!governor) {
    [ governor ] = await hre.ethers.getSigners();
  }

  logger.info(`Governor acquired as ${governor.address}`);

  const znsUpgraded = await contractData.reduce(
    async (
      acc : Promise<IZNSContractsUpgraded>,
      { contractName, instanceName, address }
    ) => {
      const upgradedContracts = await acc;

      const upgradedContract = await upgradeZNSContract({
        contractName,
        contractAddress: address,
        governor: governor as SignerWithAddress,
        dbAdapter,
        logger,
      });

      upgradedContracts[instanceName] = upgradedContract;

      return upgradedContracts;
    },
    Promise.resolve({} as IZNSContractsUpgraded)
  );

  await dbAdapter.finalizeDeployedVersion();

  return znsUpgraded;
};

export const upgradeZNSContract = async ({
  contractName,
  contractAddress,
  governor,
  dbAdapter,
  logger,
} : {
  contractName : string;
  contractAddress : string | Addressable;
  governor : SignerWithAddress;
  dbAdapter : MongoDBAdapter;
  logger : TLogger;
}) => {
  const originalFactory = await hre.ethers.getContractFactory(contractName);
  const originalContract = originalFactory.attach(contractAddress) as ZNSContract;

  const storageDataPreUpgrade = await readContractStorage(
    originalFactory,
    originalContract,
  );
  logger.info(`Pre-upgrade storage data of ${contractName} acquired`);

  logger.info(`Initiating upgrade of ${contractName} at address ${contractAddress}`);
  let upgradedFactory = await hre.ethers.getContractFactory(`${contractName}Pausable`);
  upgradedFactory = upgradedFactory.connect(governor);

  const upgradedContract = await hre.upgrades.upgradeProxy(
    contractAddress,
    upgradedFactory
  ) as unknown as ZNSContractUpgraded;

  const implAddress = await hre.upgrades.erc1967.getImplementationAddress(await upgradedContract.getAddress());

  logger.info(`Upgraded ${contractName} to new implementation at: ${implAddress}`);

  await updateContractInDb({
    dbAdapter,
    contractName,
    implAddress,
  });

  const storageDataPostUpgrade = await readContractStorage(
    upgradedFactory,
    upgradedContract,
  );

  compareStorageData(storageDataPreUpgrade, storageDataPostUpgrade);
  logger.info("Storage compared successfully. Values are unchanged after upgrade");
  logger.info(`Upgrade of ${contractName} finished successfully`);

  return upgradedContract;
};

export const getContractNamesToUpgrade = () : Partial<typeof znsNames> => {
  const contractNames = JSON.parse(JSON.stringify(znsNames));
  delete contractNames.erc1967Proxy;
  delete contractNames.accessController;
  delete contractNames.meowToken;

  return contractNames;
};

export const getContractDataForUpgrade = async (
  dbAdapter : MongoDBAdapter,
) : Promise<Array<IContractData>> => {
  const contractNames = getContractNamesToUpgrade();

  return Object.values(contractNames).reduce(
    async (
      acc : Promise<Array<IContractData>>,
      { contract, instance }
    ) => {
      const contractData = await acc;

      const { address } = await dbAdapter.getContract(contract) as IContractDbData;

      contractData.push({
        contractName: contract,
        instanceName: instance,
        address,
      });

      return contractData;
    },
    Promise.resolve([])
  );
};
