import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSAccessController, ZNSAccessController__factory } from "../../typechain";


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
