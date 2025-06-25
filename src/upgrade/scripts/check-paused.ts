import { getMongoAdapter } from "../../deploy/db/mongo-adapter/get-adapter";
import { getContractDataForUpgrade, getContractNamesToUpgrade } from "../upgrade";
import * as hre from "hardhat";
import { getLogger } from "../../deploy/logger/create-logger";
import { IZNSPausable } from "../../../typechain";


const checkPaused = async () => {
  const logger = getLogger();
  const dbAdapter = await getMongoAdapter(logger);
  const contractData = await getContractDataForUpgrade(dbAdapter, getContractNamesToUpgrade());

  for (const { contractName, address } of contractData) {
    const factory = await hre.ethers.getContractFactory(`${contractName}Pausable`);
    const contract = factory.attach(address) as IZNSPausable;

    if (typeof contract.paused === "function") {
      const isPaused = await contract.paused();
      console.log(`${contractName} at ${address} is ${isPaused ? "paused" : "not paused"}`);
    } else {
      console.warn(`${contractName} does not have a paused() function`);
    }
  }
};

checkPaused()
  .then(() => {
    const logger = getLogger();
    logger.info("Paused status check completed successfully.");
    process.exit(0);
  })
  .catch(error => {
    const logger = getLogger();
    logger.error(`
    Error checking paused status: ${error.message}
    Stack: ${error.stack}
    `);
    process.exit(1);
  });
