import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { compareStorageData, readContractStorage } from "./storage-data";
import { ZNSContract } from "../../test/helpers/types";
import { getLogger } from "../deploy/logger/create-logger";
import { TLogger } from "../deploy/campaign/types";
import { IContractData, IZNSContractsUpgraded, ZNSContractUpgraded } from "./types";
import { Addressable } from "ethers";


export const upgradeZNS = async ({
  governorExt,
  contractData,
} : {
  governorExt : SignerWithAddress;
  contractData : Array<IContractData>;
}) => {
  let governor = governorExt;
  if (!governor) {
    [ governor ] = await hre.ethers.getSigners();
  }

  const logger = getLogger();

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
        governor,
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

  const upgradedContract = await hre.upgrades.upgradeProxy(
    contractAddress,
    upgradedFactory
  ) as unknown as ZNSContractUpgraded;

  const implAddress = await hre.upgrades.erc1967.getImplementationAddress(await upgradedContract.getAddress());

  logger.info(`Upgraded ${contractName} to new implementation at: ${implAddress}`);

  const storageDataPostUpgrade = await readContractStorage(
    upgradedFactory,
    upgradedContract,
  );

  compareStorageData(storageDataPreUpgrade, storageDataPostUpgrade);
  logger.info("Storage compared successfully. Values are unchanged after upgrade");
  logger.info(`Upgrade of ${contractName} finished successfully`);

  return upgradedContract;
};
