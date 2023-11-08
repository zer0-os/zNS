import { getMongoAdapter } from "../deploy/db/mongo-adapter/get-adapter";


export const dropDB = async () => {
  const adapter = await getMongoAdapter();
  return adapter.dropDB();
};

dropDB()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
