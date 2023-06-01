import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSContract, ZNSContractMock, ZNSContractMockFactory, GetterFunction } from "./types";
import { BigNumber } from "ethers";


export const validateUpgrade = async (
  deployer : SignerWithAddress,
  contract : ZNSContract,
  upgradeContract : ZNSContractMock,
  contractFactory : ZNSContractMockFactory,
  getters : Array<GetterFunction>
) => {
  const preVals = await Promise.all(getters);

  await contract.connect(deployer).upgradeTo(upgradeContract.address);

  const postVals = await Promise.all(getters);

  preVals.forEach((value, index) => {
    expect(value).to.eq(postVals[index]);
  });

  // Typechain doesn't update the generated interface for the contract after upgrading
  // so we use the new factory to attach to the existing address instead
  const upgradedContract = contractFactory.attach(contract.address);

  // Because every upgraded contract will have the same additions to it,
  // we can be sure these functions exist
  const newNumber = BigNumber.from("123");
  await upgradedContract.connect(deployer).setNewMapping(newNumber);
  await upgradedContract.setNewMappingSpecific(newNumber.add(1), deployer.address);
  await upgradedContract.setNewNumber(newNumber);
  await upgradedContract.setNewAddress(deployer.address);

  const upgradeCalls = [
    upgradedContract.connect(deployer).newMapping(newNumber),
    upgradedContract.newMapping(newNumber.add(1)),
    upgradedContract.newNumber(),
    upgradedContract.newAddress(),
  ];

  const [
    mappingCall,
    mappingCallSpecific,
    numberCall,
    addressCall,
  ] = await Promise.all(upgradeCalls);

  expect(mappingCall).to.eq(deployer.address);
  expect(mappingCallSpecific).to.eq(deployer.address);
  expect(numberCall).to.eq(newNumber);
  expect(addressCall).to.eq(deployer.address);
};