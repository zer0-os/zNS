import { getLogger } from "../../deploy/logger/create-logger";
import { getMongoAdapter } from "../../deploy/db/mongo-adapter/get-adapter";
import { getContractDataForUpgrade } from "../upgrade";
import { updateAllContractsInDb } from "../db";


const executeDbUpdate = async () => {
  const logger = getLogger();
  const dbAdapter = await getMongoAdapter(logger);

  const contractData = await getContractDataForUpgrade(dbAdapter);

  logger.info(
    `Updating DB with name ${dbAdapter.dbName} at version ${(await dbAdapter.getLatestVersion())?.dbVersion}`
  );

  await updateAllContractsInDb({
    contractData,
    dbAdapter,
  });

  logger.info("DB update complete");
};


executeDbUpdate()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
