import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSAccessController, ZNSAccessController__factory } from "../../typechain";
import { ethers } from "ethers";


// role names
export const GOVERNOR_ROLE = ethers.utils.solidityKeccak256(
  ["string"],
  ["GOVERNOR_ROLE"]
);
export const ADMIN_ROLE = ethers.utils.solidityKeccak256(
  ["string"],
  ["ADMIN_ROLE"]
);
export const REGISTRAR_ROLE = ethers.utils.solidityKeccak256(
  ["string"],
  ["REGISTRAR_ROLE"]
);

export const EXECUTOR_ROLE = ethers.utils.solidityKeccak256(
  ["string"],
  ["EXECUTOR_ROLE"]
);

export const deployAccessController = async ({
  deployer,
  governorAddresses,
  adminAddresses,
  logAddress,
} : {
  deployer : SignerWithAddress;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  logAddress : boolean;
}) : Promise<ZNSAccessController> => {
  const accessControllerFactory = new ZNSAccessController__factory(deployer);
  const controller = await accessControllerFactory.deploy();

  await controller.deployed();

  await controller.initialize(governorAddresses, adminAddresses);

  if (logAddress) console.log(`AccessController deployed at: ${controller.address}`);

  return controller;
};
