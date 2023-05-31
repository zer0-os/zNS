import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSRegistry } from "../../../typechain";

export const registryActions = async (
  registry : ZNSRegistry,
  domainHash : string,
  accounts : Array<SignerWithAddress>,
) => {
  const [deployer, operator, mockRegistrar, mockResolver] = [...accounts.values()];

  // Add an operator
  await registry.connect(deployer).setOwnerOperator(operator.address, true);

  // Create a domain record
  await registry.connect(mockRegistrar).createDomainRecord(
    domainHash,
    deployer.address,
    mockResolver.address
  );

  const [
    ownerStatusBefore,
    operatorStatusBefore,
    existanceBefore,
    accessControllerBefore,
  ] = await registryPromises(registry, domainHash, [deployer, operator]);

  return [ownerStatusBefore, operatorStatusBefore, existanceBefore, accessControllerBefore];
};

export const registryPromises = async (
  registry : ZNSRegistry,
  domainHash : string,
  accounts : Array<SignerWithAddress>
) => {
  const [deployer, operator] = [...accounts.values()];

  const calls = [
    registry.isOwnerOrOperator(domainHash, deployer.address),
    registry.isOwnerOrOperator(domainHash, operator.address),
    registry.exists(domainHash),
    registry.getAccessController(),
  ];

  return Promise.all(calls);
};
