import * as hre from "hardhat";
import { getUsersAndDomains } from "./subgraph";
import { Domain } from "./types";
import { getDBAdapter } from "./database";
import { getZNS } from "./zns-contract-data";
import { validateDomain } from "./validate"
import assert from "assert";
import { ZeroAddress } from "ethers";


// For pagination of data in subgraph we use 'first' and 'skip'
const main = async () => {
  const [ migrationAdmin ] = await hre.ethers.getSigners();

  type User = { id: string, domains: Domain[] };
  type InvalidDomain = { message: string, domain: Domain };
  type ValidatedUser = { address: string, validDomains: Domain[], invalidDomains: InvalidDomain[] };

  const users = await getUsersAndDomains() as Array<User>;

  console.log(`Found ${users.length} users`);
  
  const zns = await getZNS(migrationAdmin);
  const validatedUsers : Array<ValidatedUser> = [];

  // for each user, iterate list of domains
  for(let i = 0; i < users.slice(0,5).length; i++) {
    const user = users[i];

    const validDomains : Array<Domain> = []
    const invalidDomains : Array<InvalidDomain> = [];

    if (user.id != ZeroAddress) {
      // As extra validation, be sure the on-chain domain token balance of a user
      // matches the number of domains given by the subgraph
      const domainBalance = await zns.domainToken.balanceOf(user.id);
      assert.equal(domainBalance, user.domains.length);
    }

    for (let j = 0; j < user.domains.length; j++) {
      const domain = user.domains[j];
      try {
        await validateDomain(domain, zns, false);
        validDomains.push(domain);
      } catch (e) {
        // For debugging we keep invalid domains rather than throw
        invalidDomains.push({ message: (e as Error).message, domain: domain });
      }
    }

    if (invalidDomains.length === 0 && validDomains.length > 0) {
      validatedUsers.push({
        address: user.id,
        validDomains,
        invalidDomains
      });
    } else {
        console.log(`Empty or Invalid Domains found for user ${user.id}`);
        console.log(invalidDomains.length);
        console.log(validDomains.length);
    }
    // } else {
    //   // Shouldnt reach this
    //   // should skip if empty
    // }

    console.log(`Users Processed: ${i + 1}`);
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

// export const validateDomains = async (
//   admin : SignerWithAddress,
//   users : Array<any> // make user type
// ) : Promise<Map<string, Array<Domain>>> => {
//   const start = Date.now();

//   // Get ZNS contracts from the MongoDB instance to validate against
//   const zns = await getZNS(admin);

//   const invalidDomains : Array<Domain> = [];

//   // array instead?
//   const validatedUsers : Map<string, Array<Domain>> = new Map();

//   const validatedUsers2 = [];
//   // TODO remove subset when testedd
//   const subsetUsers = users.slice(0,3);

//   let counter = 0;
//   for (let user of subsetUsers) {
//     const userDomains = users[counter]

//     console.log(`USERDOMAINS_OBJ: ${userDomains}`);
//     const validDomains : Array<Domain> = []


//     if (!userDomains) continue;

//     for (let domain of userDomains) {
//       try {
//         await validateDomain(domain, zns, false);
//         validDomains.push(domain);
//       } catch (e) {
//         console.log((e as Error).message);
//         invalidDomains.push(domain);
//       }
//     }

//     validatedUsers.set(user, validDomains);
//     console.log(`Processed: ${++counter}`);
//   }

//   if (invalidDomains.length > 0) {
//     fs.writeFileSync("output/invalid-domains.json", JSON.stringify(invalidDomains, undefined, 2));
//   }

//   // There should be no invalid domains for full run
//   assert.equal(invalidDomains.length, 0);

//   const end = Date.now();
//   console.log(`Validated all domains in ${end - start}ms`);

//   return validatedUsers;
// }

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});