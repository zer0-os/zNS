import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ZNSContractMock, ZNSContractMockFactory, GeneralContractGetter } from "./types";
import { ZNSContract } from "../../src/deploy/campaign/types";
import {
  ZNSAccessController,
  ZToken,
} from "../../typechain";

export const validateUpgrade = async (
  deployer : SignerWithAddress,
  contract : Exclude<Exclude<ZNSContract, ZNSAccessController>, ZToken>,
  upgradeContract : ZNSContractMock,
  upgradeContractFactory : ZNSContractMockFactory,
  getters : Array<GeneralContractGetter>
) => {
  const preVals = await Promise.all(getters);

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await contract.connect(deployer).upgradeToAndCall(await upgradeContract.getAddress(), "0x");

  // Typechain doesn't update the generated interface for the contract after upgrading
  // so we use the new factory to attach to the existing address instead
  const upgradedContract = upgradeContractFactory.attach(await contract.getAddress()) as ZNSContractMock;

  // Because every upgraded contract will have the same additions to it,
  // we can be sure these functions exist
  const newNumber = BigInt("123");
  await upgradedContract.connect(deployer).setNewMapping(newNumber);
  await upgradedContract.setNewMappingSpecific(newNumber + 1n, deployer.address);
  await upgradedContract.setNewNumber(newNumber);
  await upgradedContract.setNewAddress(deployer.address);

  const postUpgradeCalls = [
    upgradedContract.connect(deployer).newMapping(newNumber),
    upgradedContract.newMapping(newNumber + 1n),
    upgradedContract.newNumber(),
    upgradedContract.newAddress(),
  ];

  const [
    mappingCall,
    mappingCallSpecific,
    numberCall,
    addressCall,
  ] = await Promise.all(postUpgradeCalls);

  // we're checking previous value after post upgrade calls
  // to make sure that writing into new storage slots
  // doesn't overwrite or corrupt the old ones
  const postVals = await Promise.all(getters);

  preVals.forEach((value, index) => {
    expect(value).to.eq(postVals[index]);
  });

  expect(mappingCall).to.eq(deployer.address);
  expect(mappingCallSpecific).to.eq(deployer.address);
  expect(numberCall).to.eq(newNumber);
  expect(addressCall).to.eq(deployer.address);
};
