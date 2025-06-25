import * as hre from "hardhat";
import { getLogger } from "../../deploy/logger/create-logger";
import { getContractDataForUpgrade, getContractNamesToUpgrade } from "../upgrade";
import { getMongoAdapter } from "../../deploy/db/mongo-adapter/get-adapter";
import { IZNSPausable } from "../../../typechain";


const pauseAllContracts = async () => {
  const [governor] = await hre.ethers.getSigners();
  const logger = getLogger();

  logger.info(`Governor acquired as ${governor.address}`);

  const dbAdapter = await getMongoAdapter(logger);
  const contractData = await getContractDataForUpgrade(dbAdapter, getContractNamesToUpgrade());

  for (const { contractName, address } of contractData) {
    const factory = await hre.ethers.getContractFactory(`${contractName}Pausable`);
    const contract = factory.attach(address) as IZNSPausable;

    if (typeof contract.pause === "function") {
      logger.info(`Pausing ${contractName} at ${address}`);
      const tx = await contract.connect(governor).pause();
      await tx.wait(2);
      logger.info(`${contractName} paused successfully`);
    } else {
      logger.warn(`${contractName} does not have a pause function`);
    }
  }
};

pauseAllContracts()
  .then(() => {
    const logger = getLogger();
    logger.info("All contracts paused successfully.");
    process.exit(0);
  })
  .catch(error => {
    const logger = getLogger();
    logger.error(`
    Error pausing contracts: ${error.message}
    Stack: ${error.stack}
    `);
    process.exit(1);
  });
