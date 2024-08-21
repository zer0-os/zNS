import * as hre from "hardhat";
import { Domain } from "./types";
import * as fs from "fs";
import { deployZNS } from "../../../test/helpers";
import { registerDomains, registerDomainsLocal } from "./registration";
import { getZNS } from "./zns-contract-data";
import { ROOTS_FILENAME, SUBS_FILENAME } from "./constants";

// Script #2 to be run AFTER validation of the domains with subgraph
const main = async () => {
  const [ migrationAdmin, governor, admin ] = await hre.ethers.getSigners();

  const rootDomains = JSON.parse(fs.readFileSync(ROOTS_FILENAME, {
    encoding: "utf8"
  })) as Array<Domain>;

  // const subdomains = JSON.parse(fs.readFileSync(SUBS_FILENAME, {
  //   encoding: "utf8"
  // })) as Array<Domain>;

  console.log(`Registering ${rootDomains.length} root domains`);

  const registeredDomains : Array<string> = [];
  // const registeredDomains : Array<Domain> = [];

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
    const sliceSize = 1;

    for (let i = 0; i < 1; i += sliceSize) { // have only iterate once for now
    // for (let i = 0; i < rootDomains.length; i += sliceSize) { // have only iterate once for now
      // console.log(rootDomains.length);
      console.log(i)
      console.log(i + sliceSize)
      
      const slice = rootDomains.slice(i, i + sliceSize);
      const localRegisteredDomains = await registerDomainsLocal(migrationAdmin, slice, zns);
      console.log(localRegisteredDomains.txReceipt!.hash);
      console.log(localRegisteredDomains.domainHashes!.length);

      registeredDomains.concat(localRegisteredDomains.domainHashes!);
      // console.log(`Registered ${registeredDomains.length} root domains...`);
    }

    // for (let i = 0; i < subdomains.length; i += sliceSize) { // have only iterate once for now
    //   const slice = subdomains.slice(i, i + sliceSize);
    //   const localRegisteredDomains = await registerDomainsLocal(migrationAdmin, slice, zns);

    //   registeredDomains.concat(localRegisteredDomains.domainHashes!);
    //   console.log(`Registered ${registeredDomains.length} subdomains...`);
    // }

    // console.log(`Registered ${registeredDomains.length} domains in ${Date.now() - start}ms`);
    // then do the same for subdomains
  } else if (hre.network.name === "sepolia") {
    const zns = await getZNS(migrationAdmin);

    const registeredDomains = await registerDomains({
      regAdmin: migrationAdmin,
      zns, 
      domains: [rootDomains[26]] 
      // one by one testing, this is the amount on sepolia currently.
      // will fail when doing bulk TXs until we deploy those changes
    });
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