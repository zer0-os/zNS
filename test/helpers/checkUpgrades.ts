import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSRegistry, ZNSRegistryMock  } from "../../typechain";
import { BigNumber, ethers } from "ethers";

export const registryActions = async (
  registry : ZNSRegistry,
  domainHash : string,
  accounts : Array<SignerWithAddress>,
) => {
  const [deployer, operator, mockRegistrar, mockResolver] = [...accounts];

  // Add an operator
  await registry.connect(deployer).setOwnerOperator(operator.address, true);

  // Create a domain record
  await registry.connect(mockRegistrar).createDomainRecord(
    domainHash,
    deployer.address,
    mockResolver.address
  );
};

export const registryPromises = async (
  registry : ZNSRegistry,
  domainHash : string,
  accounts : Array<SignerWithAddress>
) => {
  const [deployer, operator] = [...accounts];

  const calls = [
    registry.isOwnerOrOperator(domainHash, deployer.address),
    registry.isOwnerOrOperator(domainHash, operator.address),
    registry.exists(domainHash),
    registry.getAccessController(),
  ];

  return Promise.all(calls);
};

export const upgradedRegistryActions = async (
  upgradedRegistry : ZNSRegistryMock,
  newNumber : BigNumber,
  randomUser : SignerWithAddress
) => {

  await upgradedRegistry.connect(randomUser).setNewMapping(newNumber);
  await upgradedRegistry.setNewMappingSpecific(newNumber.add(1), randomUser.address);
  await upgradedRegistry.setNewNumber(newNumber);
  await upgradedRegistry.setNewAddress(randomUser.address);
};

export const upgradedRegistryPromises = async (
  upgradedRegistry : ZNSRegistryMock,
  newNumber : BigNumber
) => {
  const checkUpgradedGetters = [
    upgradedRegistry.newMapping(newNumber),
    upgradedRegistry.newMapping(newNumber.add(1)),
    upgradedRegistry.newNumber(),
    upgradedRegistry.newAddress(),
  ];

  return Promise.all(checkUpgradedGetters);
};
