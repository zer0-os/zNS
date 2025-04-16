import * as hre from "hardhat";
import * as fs from "fs";
import { getUsersAndDomains } from "./subgraph";
import { Domain } from "./types";
import { getDBAdapter } from "./database";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getZNS } from "./zns-contract-data";
import { validateDomain } from "./validate"

import assert from "assert";


// For pagination of data in subgraph we use 'first' and 'skip'
const main = async () => {
  const [ migrationAdmin ] = await hre.ethers.getSigners();

  type User = { id: string, domains: Domain[] };
  type ValidatedUser = { address: string, validDomains: Domain[], invalidDomains: Domain[] };

  const users = await getUsersAndDomains() as Array<User>;

  console.log(`Found ${users.length} users`);
  
  const zns = await getZNS(migrationAdmin);
  const validatedUsers : Array<ValidatedUser> = [];

  // for each user, iterate list of domains
  for(let i = 0; i < 5; i++) {
    const user = users[i];

    const validDomains : Array<Domain> = []
    const invalidDomains : Array<Domain> = [];

    for (let j = 0; j < user.domains.length; j++) {
      const domain = user.domains[j];
      try {
        await validateDomain(domain, zns, false);
        validDomains.push(domain);
      } catch (e) {
        invalidDomains.push(domain);
        // console.log("invalid domain found")
        // throw (e as Error).message; // no point in try catch if we just throw error?
      }
    }

    validatedUsers.push({
      address: user.id,
      validDomains,
      invalidDomains
    });

    console.log(`Processed: ${i}`);
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

export const validateDomains = async (
  admin : SignerWithAddress,
  users : Array<any> // make user type
) : Promise<Map<string, Array<Domain>>> => {
  const start = Date.now();

  // Get ZNS contracts from the MongoDB instance to validate against
  const zns = await getZNS(admin);

  const invalidDomains : Array<Domain> = [];

  // array instead?
  const validatedUsers : Map<string, Array<Domain>> = new Map();

  const validatedUsers2 = [];
  // TODO remove subset when testedd
  const subsetUsers = users.slice(0,3);

  let counter = 0;
  for (let user of subsetUsers) {
    const userDomains = users[counter]

    console.log(`USERDOMAINS_OBJ: ${userDomains}`);
    const validDomains : Array<Domain> = []


    if (!userDomains) continue;

    for (let domain of userDomains) {
      try {
        await validateDomain(domain, zns, false);
        validDomains.push(domain);
      } catch (e) {
        console.log((e as Error).message);
        invalidDomains.push(domain);
      }
    }

    validatedUsers.set(user, validDomains);
    console.log(`Processed: ${++counter}`);
  }

  if (invalidDomains.length > 0) {
    fs.writeFileSync("output/invalid-domains.json", JSON.stringify(invalidDomains, undefined, 2));
  }

  // There should be no invalid domains for full run
  assert.equal(invalidDomains.length, 0);

  const end = Date.now();
  console.log(`Validated all domains in ${end - start}ms`);

  return validatedUsers;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});