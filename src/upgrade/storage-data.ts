import * as hre from "hardhat";
import { expect } from "chai";
import { Contract, ContractFactory } from "ethers";
import { getStorageLayout, getUnlinkedBytecode, getVersion, StorageLayout } from "@openzeppelin/upgrades-core";
import { readValidations } from "@openzeppelin/hardhat-upgrades/dist/utils/validations";
import { ContractStorageData } from "./types";
import { ZNSContract } from "../../test/helpers/types";


// TODO utils: move thess helpers to protocol-utils repo when available
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
  const layout = await getContractStorageLayout(contractFactory);

  return layout.storage.reduce(
    async (
      acc : Promise<ContractStorageData>,
      { contract, label, type }
    ) : Promise<ContractStorageData> => {
      const newAcc = await acc;

      if (
        (contract === "zStakePoolBase" ||
          contract === "zStakeCorePool" ||
          contract === "zStakeCorePoolMigration") &&
        !type.includes("mapping")
      ) {
        try {
          const value = await contractObj[(label as keyof ZNSContract)]();

          newAcc.push({ [label]: value });
        } catch (e : unknown) {
          console.log(`Error on LABEL ${label}: ${(e as Error).message}`);
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
  dataAfter.forEach(
    (stateVar, idx) => {
      const [key, value] = Object.entries(stateVar)[0];

      expect(value).to.equal(
        dataBefore[idx][key],
        `Mismatch on state var ${key} at idx ${idx}! Prev value: ${dataBefore[idx][key]}, new value: ${value}`
      );
    }
  );
};
