import * as hre from "hardhat";
import { deployZNS, DeployZNSParams } from "../../../test/helpers";
import { ROOT_COLL_NAME, ROOT_DOMAIN_BULK_SELECTOR, SUB_COLL_NAME, SUBDOMAIN_BULK_SELECTOR } from "./constants";

import { Domain, IRootDomainRegistrationArgs, ISubdomainRegisterArgs } from "./types";
import { ZeroAddress, ZeroHash } from "ethers";

import { connectToDb, createBatches } from "./helpers";
import { ZNSRootRegistrar, ZNSRootRegistrar__factory } from "../../../typechain";
import { getZNS } from "./zns-contract-data";

const main = async () => {
  const [ migrationAdmin ] = await hre.ethers.getSigners();

  const client = await connectToDb();

  const rootDomains = await client.collection(ROOT_COLL_NAME).find().toArray() as unknown as Domain[];
  const subdomains = await client.collection(SUB_COLL_NAME).find().sort({ depth: 1, _id: 1}).toArray() as unknown as Domain[];

  const zns = await getZNS(migrationAdmin);

  const [ rootRegisterBatches ] = createBatches(rootDomains);
  const [ subRegisterBatches ] = createBatches(subdomains);

  let count = 0;
  // Send each batch
  console.log("Sending root domain registrations...");

  for(let batch of rootRegisterBatches) {
    const registerTx = await zns.rootRegistrar.connect(migrationAdmin).registerRootDomainBulk(
      batch
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
  for(let batch of subRegisterBatches) {
    const registerTx = await zns.subRegistrar.connect(migrationAdmin).registerSubdomainBulk(tx);

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
  for (let domain of [...rootDomains, ...subdomains]) {
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
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
