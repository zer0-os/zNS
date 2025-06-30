import * as hre from "hardhat";
import { ROOT_COLL_NAME, SUB_COLL_NAME } from "./constants";
import { connectToDb, createBatches } from "./helpers";
import { getZNS } from "./zns-contract-data";
import { Domain, IRootDomainRegistrationArgs, ISubdomainRegistrationArgs, RootRegistrationArgsArrays } from "./types";

const main = async () => {
  const [ migrationAdmin ] = await hre.ethers.getSigners();

  const client = await connectToDb();

  const rootDomains = await client.collection(
    ROOT_COLL_NAME
  ).find().toArray() as unknown as Array<Domain>;

  const subdomains = await client.collection(
    SUB_COLL_NAME
  ).find().sort({ depth: 1, _id: 1 }).toArray() as unknown as Array<Domain>;

  const zns = await getZNS(migrationAdmin);

  const [ rootRegisterBatches ] = createBatches(rootDomains);
  const [ subRegisterBatches ] = createBatches(subdomains);

  let count = 0;
  // Send each batch
  console.log("Sending root domain registrations...");

  for(const batch of rootRegisterBatches) {
    const registerTx = await zns.rootRegistrar.connect(migrationAdmin).registerRootDomainBulk(
      batch as unknown as Array<IRootDomainRegistrationArgs>
    );

    // Wait for network confirmations
    await registerTx.wait(hre.network.name === "hardhat" ? 0 : 3);
    count++;

    if (count % 10 === 0) {
      console.log(`Processed ${count} root domain batches...`);
    }
  }

  count = 0;
  console.log("Sending subdomain registrations...");
  for(const batch of subRegisterBatches) {
    const registerTx = await zns.subRegistrar.connect(migrationAdmin).registerSubdomainBulk(
      batch as unknown as Array<ISubdomainRegistrationArgs>
    );

    // Wait for network confirmations
    await registerTx.wait(hre.network.name === "hardhat" ? 0 : 3);
    count++;

    if (count % 10 === 0) {
      console.log(`Processed ${count} subdomain batches...`);
    }
  }

  // Transfer all domains
  count = 0;
  console.log("Sending transfers...");
  for (const domain of [...rootDomains, ...subdomains]) {
    const transferTx = await zns.domainToken.connect(migrationAdmin).transferFrom(
      migrationAdmin.address,
      domain.owner.id,
      domain.tokenId,
    );

    // Wait for network confirmation to avoid overloading
    await transferTx.wait(hre.network.name === "hardhat" ? 0 : 3);

    count++;
    if (count % 10 === 0) {
      console.log(`Processed ${count} domain transfers...`);
    }
  }

  console.log("Done!");

  process.exit(0);
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
