import { getLogger } from "../../deploy/logger/create-logger";
import { getContractDataForUpgrade, upgradeZNS } from "../upgrade";
import { getMongoAdapter } from "../../deploy/db/mongo-adapter/get-adapter";


const execute = async () => {
  const logger = getLogger();
  const dbAdapter = await getMongoAdapter(logger);

  logger.info("Prepairing contract data for the upgrade...");

  const contractData = await getContractDataForUpgrade(dbAdapter);

  logger.info("Contract data prepared. Starting the upgrade...");

  const znsUpgraded = await upgradeZNS({
    contractData,
    logger,
  });

  return znsUpgraded;
};

execute()
  .then(znsUpgraded => {
    const log = getLogger();
    log.info(`Upgraded ${Object.keys(znsUpgraded).length} ZNS contracts.`);
    process.exit(0);
  })
  .catch(e => {
    const log = getLogger();
    log.error(`Error during upgrade! Message: ${e.message}, Stack: ${e.stack}`);
    process.exit(1);
  });
