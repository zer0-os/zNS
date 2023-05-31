import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ContractMock } from "../types";

// Every contract inherits from the same Mock contract in upgrade tests
// so we can reliably use any ___Mock contract here.
export const upgradedActions = async (
  contractMock : ContractMock,
  newNumber : BigNumber,
  randomUser : SignerWithAddress
) => {
  await contractMock.connect(randomUser).setNewMapping(newNumber);
  await contractMock.setNewMappingSpecific(newNumber.add(1), randomUser.address);
  await contractMock.setNewNumber(newNumber);
  await contractMock.setNewAddress(randomUser.address);
};

export const upgradedPromises = async (
  contractMock : ContractMock,
  newNumber : BigNumber
) : Promise<Array<string | BigNumber>> => {
  const checkUpgradedGetters = [
    contractMock.newMapping(newNumber),
    contractMock.newMapping(newNumber.add(1)),
    contractMock.newNumber(),
    contractMock.newAddress(),
  ];

  return Promise.all(checkUpgradedGetters);
};

// array of promises in
// how can this be done without having to give it each promise independently in the test itself?
// array of results out
// type ArgTypes = string | number | BigNumber;

// export const genericActions = async (
//   contractMock : ContractMock,
//   args : Array<ArgTypes>,
//   accounts : Array<SignerWithAddress>
// ) => {

// };