import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { compareStorageData, readContractStorage } from "./storage-data";
import { ZNSContract } from "../../test/helpers/types";
import { TLogger } from "../deploy/campaign/types";
import { IContractData, IZNSContractsUpgraded, ZNSContractUpgraded } from "./types";
import { Addressable } from "ethers";
import { MongoDBAdapter } from "../deploy/db/mongo-adapter/mongo-adapter";
import { updateAllContractsInDb } from "./db";
import { znsNames } from "../deploy/missions/contracts/names";
import { IContractDbData } from "../deploy/db/types";


// TODO upg: add the ability to retry from where it left off/failed !
export const upgradeZNS = async ({
  governorExt,
  contractData,
  logger,
} : {
  governorExt ?: SignerWithAddress;
  contractData : Array<IContractData>;
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
        logger,
      });

      upgradedContracts[instanceName] = upgradedContract;

      return upgradedContracts;
    },
    Promise.resolve({} as IZNSContractsUpgraded)
  );

  return znsUpgraded;
};

export const upgradeZNSContract = async ({
  contractName,
  contractAddress,
  governor,
  logger,
} : {
  contractName : string;
  contractAddress : string | Addressable;
  governor : SignerWithAddress;
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

  let upgradedContract = await hre.upgrades.upgradeProxy(
    contractAddress,
    upgradedFactory,
  );

  upgradedContract = await upgradedContract.waitForDeployment();

  logger.info(`Upgraded ${contractName} to new implementation.`);

  const storageDataPostUpgrade = await readContractStorage(
    upgradedFactory,
    upgradedContract as unknown as ZNSContractUpgraded,
  );

  compareStorageData(storageDataPreUpgrade, storageDataPostUpgrade);
  logger.info("Storage compared successfully. Values are unchanged after upgrade");
  logger.info(`Upgrade of ${contractName} finished successfully`);

  return upgradedContract as unknown as ZNSContractUpgraded;
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
