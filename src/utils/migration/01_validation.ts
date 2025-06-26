import * as hre from "hardhat";
import { getDomains } from "./subgraph";
import { Domain, InvalidDomain } from "./types";
import { getDBAdapter } from "./database";
import { getZNS } from "./zns-contract-data";
import { validateDomain } from "./validate";
import { INVALID_COLL_NAME, ROOT_COLL_NAME, SUB_COLL_NAME } from "./constants";


const main = async () => {
  const [ migrationAdmin ] = await hre.ethers.getSigners();

  // Keeping as separate collections from the start will help downstream registration
  const rootDomainObjects = await getDomains(true);
  const subdomainObjects = await getDomains(false);

  console.log(`Found ${rootDomainObjects.length + subdomainObjects.length} domains`);

  const env = process.env.ENV_LEVEL;

  if (!env) throw Error("No ENV_LEVEL set in .env file");

  const zns = await getZNS(migrationAdmin, env);

  const validRoots : Array<Domain> = [];
  const validSubs : Array<Domain> = [];
  const invalidDomains : Array<InvalidDomain> = [];

  // Doing this creates strong typing and extensibility that allows
  // the below `insertMany` calls to add properties to the object for `_id`
  const roots = rootDomainObjects.map(d => d as Domain);
  const subs = subdomainObjects.map(d => d as Domain);

  const dbName = process.env.MONGO_DB_NAME_WRITE;
  if (!dbName) throw Error("Missing MONGO_DB_NAME_WRITE environment variable");

  const uri = process.env.MONGO_DB_URI_WRITE;
  if (!uri) throw Error("No connection string given");

  // Can iterate all at once for simplicity
  let index = 0;
  for(const domain of [...roots, ...subs]) {
    try {
      await validateDomain(domain, zns);

      if (domain.isWorld) {
        validRoots.push({ ...domain } as Domain);
      } else {
        validSubs.push({ ...domain } as Domain);
      }
    } catch (e) {
      // For debugging we keep invalid domains rather than throw errors
      invalidDomains.push({ message: (e as Error).message, domain });
    }

    console.log(`Processed ${++index} domains`);
  }

  // Connect to database collection and write user domain data to DB
  const client = (await getDBAdapter(uri)).db(dbName);

  // To avoid duplicate data, we clear the DB before any inserts
  await client.dropCollection(ROOT_COLL_NAME);
  await client.collection(ROOT_COLL_NAME).insertMany(validRoots);

  await client.dropCollection(SUB_COLL_NAME);
  await client.collection(SUB_COLL_NAME).insertMany(validSubs);

  // Domains that have split ownership will be considered invalid domains
  if (invalidDomains.length > 0) {
    await client.dropCollection(INVALID_COLL_NAME);
    await client.collection(INVALID_COLL_NAME).insertMany(invalidDomains);
  }
};

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
