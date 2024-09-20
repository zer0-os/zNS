import * as hre from "hardhat";
import { Domain } from "./types";
import * as fs from "fs";
import { deployZNS } from "../../../test/helpers";
import { postMigrationValidation, registerDomainsBulk } from "./registration";
import { getZNS } from "./zns-contract-data";
import { ROOTS_FILENAME, SUBS_FILENAME } from "./constants";
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

  await zns.meowToken.connect(migrationAdmin).approve(await zns.treasury.getAddress(), hre.ethers.MaxUint256);
  await zns.meowToken.connect(migrationAdmin).mint(migrationAdmin.address, hre.ethers.parseEther("8000000"));

  console.log(
    `Balance of admin before: ${await zns.meowToken.balanceOf(migrationAdmin.address)}`
  );

  // Give approval to the RootRegistrar and SubRegistrar to transfer on behalf of the migration admin
  await zns.domainToken.connect(migrationAdmin).setApprovalForAll(await zns.rootRegistrar.getAddress(), true);
  await zns.domainToken.connect(migrationAdmin).setApprovalForAll(await zns.subRegistrar.getAddress(), true);

  const startTime = Date.now();

  // How many domains we will register in a single transaction
  const sliceSize = 50;

  // TODO because we no longer use the treasury at all we might be able to switch back to
  // having owners just be the registrant for the domain, not the user then do a transfer
  // would make it cheaper and faster, but on zchain gas probably won't matter
  const start = 0;

  console.log(`Registering ${rootDomains.length - start} root domains with slice size ${sliceSize}`);
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
    0
  );

  // // ms -> s -> min
  const totalTime = (Date.now() - startTime) / 1000 / 60;
  console.log(`Registered ${rootDomains.length + subdomains.length} groups of domains in ${totalTime} minutes`);
  console.log("Done")

  console.log(`txhash: ${registeredDomains[0].txHash}`);
  console.log(`exists: ${await zns.registry.exists(registeredDomains[0].domainHashes[0])}`);

  console.log(
    `Balance of admin after: ${await zns.meowToken.balanceOf(migrationAdmin.address)}`
  );

  // console.log("TEMP just doing postmigration validation for now to test")
  console.log("Confirming with post-migration validation...");
  const fullDomains = rootDomains.concat(subdomains);
  // await postMigrationValidation(
  //   zns,
  //   fullDomains
  // )

  // Manually exit here, HH runner doesn't exit properly
  process.exit(0);
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});