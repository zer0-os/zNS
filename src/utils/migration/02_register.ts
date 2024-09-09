import * as hre from "hardhat";
import { Domain } from "./types";
import * as fs from "fs";
import { deployZNS } from "../../../test/helpers";
import { registerDomainsBulk } from "./registration";
import { getZNS } from "./zns-contract-data";
import { ROOTS_FILENAME, SUBS_FILENAME } from "./constants";
import { ContractTransactionReceipt } from "ethers/contract";
import { IZNSContracts } from "../../deploy/campaign/types";

// Script #2 to be run AFTER validation of the domains with subgraph
const main = async () => {
  const [ migrationAdmin, governor, admin ] = await hre.ethers.getSigners();

  // Read domain data from file output of 01_validate.ts
  const rootDomains = JSON.parse(fs.readFileSync(ROOTS_FILENAME, {
    encoding: "utf8"
  })) as Array<Domain>;

  const subdomains = JSON.parse(fs.readFileSync(SUBS_FILENAME, {
    encoding: "utf8"
  })) as Array<Domain>;

  let zns : IZNSContracts;

  if (hre.network.name === "hardhat") {
    // Reset the network to be sure we aren't forking
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
    zns = await deployZNS(params);
  } else if (hre.network.name === "sepolia") {
    // Get instance of ZNS from DB
    zns = await getZNS(migrationAdmin);
  } else {
    // TODO setup when zchain is deployed
    throw new Error(`Network ${hre.network.name} not supported`);
  }

  // Give approval to the RootRegistrar and SubRegistrar to transfer on behalf of the migration admin
  await zns.domainToken.connect(migrationAdmin).setApprovalForAll(await zns.rootRegistrar.getAddress(), true);
  await zns.domainToken.connect(migrationAdmin).setApprovalForAll(await zns.subRegistrar.getAddress(), true);

  const startTime = Date.now();

  // How many domains we will register in a single transaction
  const sliceSize = 50;

  // For retry logic, we keep track 
  const start = 0;

  console.log(`Registering ${rootDomains.length} root domains with slice size ${sliceSize}`);
  const registeredDomains = await registerDomainsBulk(
    migrationAdmin,
    rootDomains,
    zns,
    sliceSize,
    start
  );

  console.log(`Registering ${subdomains.length} subdomains with slice size ${sliceSize}`);
  const registeredSubdomains = await registerDomainsBulk(
    migrationAdmin,
    subdomains,
    zns,
    sliceSize,
    start
  );

  // ms -> s -> min
  const totalTime = (Date.now() - startTime) / 1000 / 60;
  console.log(`Registered ${registeredDomains.length + registeredSubdomains.length} groups of domains in ${totalTime} minutes`);
  console.log("Done")

  // Manually exit here, HH runner doesn't exit properly
  process.exit(0);
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});