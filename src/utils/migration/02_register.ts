import * as hre from "hardhat";
import { Domain } from "./types";
import * as fs from "fs";
import { deployZNS } from "../../../test/helpers";
import { registerDomains, registerDomainsLocal } from "./registration";
import { getZNS } from "./zns-contract-data";

// Script #2 to be run AFTER validation of the domains with subgraph
const main = async () => {
  const [ migrationAdmin, governor, admin ] = await hre.ethers.getSigners();

  const domains = JSON.parse(fs.readFileSync("valid-domains.json", {
    encoding: "utf8"
  })) as Array<Domain>;

  if (hre.network.name === "hardhat") {
    console.log("hh network");
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
    await registerDomainsLocal(migrationAdmin, [domains[0]], zns);

  } else if (hre.network.name === "sepolia") {
    const zns = await getZNS(migrationAdmin);

    const registeredDomains = await registerDomains({
      regAdmin: migrationAdmin,
      zns, 
      domains: domains.slice(0, 10) // Register 10 domains (end index is exclusive, so we do 0-9)
    });
    console.log(registeredDomains.length);
  } else if (process.env.MIGRATION_LEVEL === "prod") {
    // TODO impl when deployed on zchain
  } else {
    throw new Error("Invalid migration level env variable. Must specify 'local', 'dev', or 'prod'");
  }

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