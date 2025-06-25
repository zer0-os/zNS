import * as hre from "hardhat";
import { getLogger } from "../../deploy/logger/create-logger";
import { getMongoAdapter } from "../../deploy/db/mongo-adapter/get-adapter";
import { znsNames } from "../../deploy/missions/contracts/names";
import { IContractDbData } from "../../deploy/db/types";
import { ZNSAccessController } from "../../../typechain";


const renounceRoles = async () => {
  const [ deployer ] = await hre.ethers.getSigners();

  const logger = getLogger();
  const dbAdapter = await getMongoAdapter(logger);

  const {
    address: accessControllerAddress,
  } = await dbAdapter.getContract(znsNames.accessController.contract) as IContractDbData;

  const accessController = await hre.ethers.getContractAt(
    znsNames.accessController.contract,
    accessControllerAddress
  ) as unknown as ZNSAccessController;

  const adminRole = await accessController.GOVERNOR_ROLE();
  const governorRole = await accessController.ADMIN_ROLE();

  logger.info(`Renouncing ADMIN_ROLE for ${deployer.address}`);
  const tx1 = await accessController.renounceRole(adminRole, deployer.address);
  await tx1.wait(2);

  logger.info(`Renouncing GOVERNOR_ROLE for ${deployer.address}`);
  const tx2 = await accessController.renounceRole(governorRole, deployer.address);
  await tx2.wait(2);

  const isAdmin = await accessController.isAdmin(deployer.address);
  const isGovernor = await accessController.isGovernor(deployer.address);

  if (isAdmin || isGovernor) {
    throw new Error(`Failed to renounce roles. isAdmin: ${isAdmin}, isGovernor: ${isGovernor}`);
  }
};


renounceRoles()
  .then(() => {
    getLogger().info("Roles renounced successfully.");
    process.exit(0);
  })
  .catch(e => {
    getLogger().error(`Error renouncing roles: ${e.message}, stack: ${e.stack}`);
    process.exit(1);
  });
