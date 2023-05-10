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

export const deployAccessController = async ({
  deployer,
  governorAddresses,
  adminAddresses,
} : {
  deployer : SignerWithAddress;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
}) : Promise<ZNSAccessController> => {
  const accessControllerFactory = new ZNSAccessController__factory(deployer);
  const controller = await accessControllerFactory.deploy();

  await controller.initialize(governorAddresses, adminAddresses);
  return controller;
};

export const getAccessRevertMsg = (addr : string, role : string) : string =>
  `AccessControl: account ${addr.toLowerCase()} is missing role ${role}`;
