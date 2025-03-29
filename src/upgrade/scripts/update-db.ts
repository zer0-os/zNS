import { getLogger } from "../../deploy/logger/create-logger";
import { getMongoAdapter } from "../../deploy/db/mongo-adapter/get-adapter";
import { updateAllContractsInDb } from "../db";


const executeDbUpdate = async () => {
  const logger = getLogger();
  const dbAdapter = await getMongoAdapter(logger);

  await updateAllContractsInDb({
    dbAdapter,
  });
};


executeDbUpdate()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
