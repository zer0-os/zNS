import * as hre from "hardhat";
import { Domain } from "./types";
import * as fs from "fs";
import { deployZNS } from "../../../test/helpers";
import { registerDomains, registerDomainsLocal } from "./registration";
import { getZNS } from "./zns-contract-data";
import { ROOTS_FILENAME } from "./constants";

// Script #2 to be run AFTER validation of the domains with subgraph
const main = async () => {
  const [ migrationAdmin, governor, admin ] = await hre.ethers.getSigners();

  const rootDomains = JSON.parse(fs.readFileSync(ROOTS_FILENAME, {
    encoding: "utf8"
  })) as Array<Domain>;

  const subdomains = JSON.parse(fs.readFileSync(ROOTS_FILENAME, {
    encoding: "utf8"
  })) as Array<Domain>;

  console.log(`Registering ${rootDomains.length} root domains`);

  const registeredDomains : Array<Domain> = [];

  const start = Date.now();

  if (hre.network.name === "hardhat") {
    // Reset the network to be sure we are not forking.
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [],
    });

    const params = {
      deployer: migrationAdmin,
      governorAddresses: [migrationAdmin.address, governor.address],
      adminAddresses: [migrationAdmin.address, admin.address],
    };

    // Recreate the domain tree with local ZNS
    const zns = await deployZNS(params);

    const sliceSize = 100;
    for (let i = 0; i < 1; i += sliceSize) { // have only iterate once for now
      const slice = rootDomains.slice(i, i + sliceSize);

      // add console logs here to track is something fails
      const localRegisteredDomains = await registerDomainsLocal(migrationAdmin, slice, zns);

      // registeredDomains.concat(localRegisteredDomains);

      console.log(`Registered ${localRegisteredDomains.domainHashes!.length} domains...`);
    }

    console.log();
  } else if (hre.network.name === "sepolia") {
    // const zns = await getZNS(migrationAdmin);

    // const registeredDomains = await registerDomains({
    //   regAdmin: migrationAdmin,
    //   zns, 
    //   domains: domains.slice(10, 20) // Register 10 domains (end index is exclusive)
    // });
    // console.log(registeredDomains.length);
  } else if (process.env.MIGRATION_LEVEL === "prod") {
    // TODO impl when deployed on zchain
  } else {
    throw new Error("Invalid migration level env variable. Must specify 'local', 'dev', or 'prod'");
  }

  const end = Date.now();
  console.log(`Registered ${registeredDomains.length} domains in ${end - start}ms`);



  // It seems the HH script process hangs at completion
  // Manually exit here
  process.exit(0);
};

// Comment out to run in tests
// Uncomment to run as a script
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});