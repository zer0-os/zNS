import * as hre from "hardhat";
import { Domain } from "./types";
import * as fs from "fs";
import { deployZNS } from "../../../test/helpers";
import { registerDomainsBulk, registerDomainsLocal } from "./registration";
import { getZNS } from "./zns-contract-data";
import { ROOTS_FILENAME, SUBS_FILENAME } from "./constants";
import { ContractTransactionReceipt } from "ethers/contract";
import { IZNSContracts } from "../../deploy/campaign/types";

// Script #2 to be run AFTER validation of the domains with subgraph
const main = async () => {
  const [ migrationAdmin, governor, admin ] = await hre.ethers.getSigners();

  const rootDomains = JSON.parse(fs.readFileSync(ROOTS_FILENAME, {
    encoding: "utf8"
  })) as Array<Domain>;

  const subdomains = JSON.parse(fs.readFileSync(SUBS_FILENAME, {
    encoding: "utf8"
  })) as Array<Domain>;

  console.log(`Registering ${rootDomains.length} root domains`);

  // const registeredDomains : Array<{ 
  //   domainHashes : Array<string> | undefined, 
  //   txReceipt : ContractTransactionReceipt | null | undefined
  // }> = [];

  let zns : IZNSContracts;

  // for hardhat
  if (hre.network.name === "hardhat") {
    // Ensure we aren't forking
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
    // TODO make sure we have enough funds to register domains when we use zchain
    throw new Error(`Network ${hre.network.name} not supported`);
  }

  // Only need to do this once on sepolia, unless new contracts are deployed    
  const allowance = await zns.meowToken.connect(migrationAdmin).allowance(
    migrationAdmin.address,
    await zns.treasury.getAddress()
  );

  // Approve migration admin for maximum possible amount
  if (allowance < (hre.ethers.MaxUint256)) {
    await zns.meowToken.connect(migrationAdmin).approve(await zns.treasury.getAddress(), hre.ethers.MaxUint256);
  }

  await zns.domainToken.connect(migrationAdmin).setApprovalForAll(await zns.rootRegistrar.getAddress(), true);

  // TODO fix, On real chain we wont use the mock that can simply mint tokens
  await zns.meowToken.connect(migrationAdmin).mint(migrationAdmin.address, hre.ethers.parseEther("99999999999999999999"));

  const startTime = Date.now();

  // How many domains we will register in a single transaction
  const sliceSize = 50;

  // How many domains have been registered so far
  // We use this for retry logic.
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

  const tid = rootDomains[0].tokenId;
  const ownerBefore = await zns.domainToken.ownerOf(tid);

  // ms -> s -> min
  const totalTime = (Date.now() - startTime) / 1000 / 60;
  console.log(`Registered ${registeredDomains.length + registeredSubdomains.length} groups of domains in ${totalTime} minutes`);
  console.log("Done")

  // Manually exit here
  process.exit(0);
};

// Comment out to run in tests
// Uncomment to run as a script
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});