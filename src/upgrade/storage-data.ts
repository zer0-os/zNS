import * as hre from "hardhat";
import { ContractFactory } from "ethers";
import { getStorageLayout, getUnlinkedBytecode, getVersion, StorageLayout } from "@openzeppelin/upgrades-core";
import { readValidations } from "@openzeppelin/hardhat-upgrades/dist/utils/validations";
import { ContractStorageData, ContractStorageDiff } from "./types";
import { ZNSContract } from "../../test/helpers/types";
import { getLogger } from "../deploy/logger/create-logger";


export const getContractStorageLayout = async (
  contractFactory : ContractFactory
) : Promise<StorageLayout> => {
  const validations = await readValidations(hre);
  const unlinkedBytecode = getUnlinkedBytecode(validations, contractFactory.bytecode);
  const encodedArgs = contractFactory.interface.encodeDeploy();
  const version = getVersion(unlinkedBytecode, contractFactory.bytecode, encodedArgs);

  return getStorageLayout(validations, version);
};

export const readContractStorage = async (
  contractFactory : ContractFactory,
  contractObj : ZNSContract
) : Promise<ContractStorageData> => {
  const logger = getLogger();
  const layout = await getContractStorageLayout(contractFactory);

  return layout.storage.reduce(
    async (
      acc : Promise<ContractStorageData>,
      { label, type }
    ) : Promise<ContractStorageData> => {
      const newAcc = await acc;

      if (!type.includes("mapping") && !type.includes("array")) {
        try {
          const value = await contractObj[(label as keyof ZNSContract)]();

          newAcc.push({ [label]: value });
        } catch (e : unknown) {
          logger.debug(`Error on LABEL ${label}: ${(e as Error).message}`);
        }
      }

      return newAcc;
    },
    Promise.resolve([])
  );
};


export const compareStorageData = (
  dataBefore : ContractStorageData,
  dataAfter : ContractStorageData,
) => {
  const storageDiff = dataAfter.reduce(
    (acc : ContractStorageDiff | undefined, stateVar, idx) => {
      const [key, value] = Object.entries(stateVar)[0];

      if (value !== dataBefore[idx][key]) {
        console.error(
          `Mismatch on state var ${key} at idx ${idx}! Prev value: ${dataBefore[idx][key]}, new value: ${value}`
        );

        return [
          ...acc as ContractStorageDiff,
          {
            key,
            valueBefore: dataBefore[idx][key],
            valueAfter: value,
          },
        ];
      }
    }, []
  );

  if (storageDiff && storageDiff.length > 0) {
    throw new Error(`Storage data mismatch: ${JSON.stringify(storageDiff)}`);
  }
};
