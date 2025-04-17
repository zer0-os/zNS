import * as hre from "hardhat";
import { getUsersAndDomains } from "./subgraph";
import { Domain, InvalidDomain, User, ValidatedUser } from "./types";
import { getDBAdapter } from "./database";
import { getZNS } from "./zns-contract-data";
import { validateDomain } from "./validate"
import { ZeroAddress } from "ethers";


// For pagination of data in subgraph we use 'first' and 'skip'
const main = async () => {
  const [ migrationAdmin ] = await hre.ethers.getSigners();

  const users = await getUsersAndDomains() as Array<User>;

  console.log(`Found ${users.length} users`);
  
  const zns = await getZNS(migrationAdmin);
  const validatedUsers : Array<ValidatedUser> = [];

  // for each user, iterate list of domains
  for(let [index, user] of users.entries()) {
    const validDomains : Array<Domain> = []
    const invalidDomains : Array<InvalidDomain> = [];

    for (const domain of user.domains) {
      try {
        await validateDomain(domain, zns);
        validDomains.push(domain);
      } catch (e) {
        // For debugging we keep invalid domains rather than throw
        invalidDomains.push({ message: (e as Error).message, domain: domain });
      }
    }

    // Skip 0x0 address
    if (user.id != ZeroAddress) {
      validatedUsers.push({
        address: user.id,
        validDomains,
        invalidDomains
      });
    }

    console.log(`Users Processed: ${index + 1}`);
  }

  const dbName = "zns-domain-migration";
  const uri = process.env.MONGO_DB_URI_WRITE;

  if (!uri) throw Error("No connection string provided");

  let client = (await getDBAdapter(uri)).db(dbName);

  // To avoid duplicate data, we clear the DB before any inserts
  await client.dropCollection("user-domains");
  await client.collection("user-domains").insertMany(validatedUsers);

  // HH not exiting process properly, exit manually
  process.exit(0);
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});