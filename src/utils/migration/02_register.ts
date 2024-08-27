import * as hre from "hardhat";
import { Domain } from "./types";
import * as fs from "fs";
import { deployZNS } from "../../../test/helpers";
import { registerDomainsBulk, registerDomainsLocal } from "./registration";
import { getZNS } from "./zns-contract-data";
import { ROOTS_FILENAME, SUBS_FILENAME } from "./constants";
import { ContractTransactionReceipt } from "ethers/contract";

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

  const registeredDomains : Array<{ 
    domainHashes : Array<string> | undefined, 
    txReceipt : ContractTransactionReceipt | null | undefined
  }> = [];

  const start = Date.now();
  const sliceSize = 30; // TODO whats the most data we can fit in a real tx?

  if (hre.network.name === "sepolia") {
    const zns = await getZNS(migrationAdmin);

    // Only need to do this once on sepolia, unless new contracts are deployed
    // await zns.meowToken.connect(migrationAdmin).mint(migrationAdmin.address, hre.ethers.parseEther("99999999999999999999"));
    
    const allowance = await zns.meowToken.connect(migrationAdmin).allowance(
      migrationAdmin.address,
      await zns.treasury.getAddress()
    );

    // Approve migration admin for maximum possible amount
    if (allowance < (hre.ethers.MaxUint256)) {
      await zns.meowToken.connect(migrationAdmin).approve(await zns.treasury.getAddress(), hre.ethers.MaxUint256);
    }


    const sliceSize = 50;
    const start = 90;

    // one by one testing, this is the amount on sepolia currently.
    // will fail when doing bulk TXs until we deploy those changes
    const registeredDomains = await registerDomainsBulk(
      migrationAdmin,
      rootDomains,
      zns, 
      sliceSize,
      start
    );
    console.log(`registeredDomains: ${registeredDomains[0].txHash}`);
    console.log(`registeredDomains: ${registeredDomains[1].txHash}`);
    // console.log(`registeredDomains: ${registeredDomains[0].domainHashes}`);
    console.log(`done`);
    
    // console.log(`txRecipt: ${registeredDomains[0].txHash}`);

    // TODO then do again for subdomains
  } else if (hre.network.name === "zchain") {
    // TODO impl for when deployed on zchain
  } else {
    // Default to hardhat
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

    console.log(`Registering ${rootDomains.length} root domains with slice size ${sliceSize}`);
    for (let i = 0; i < rootDomains.length; i += sliceSize) {
      // TODO put this loop logic in a helper function that any network can use
      const slice = rootDomains.slice(i, i + sliceSize);
      const localRegisteredDomains = await registerDomainsLocal(migrationAdmin, slice, zns);

      registeredDomains.push(localRegisteredDomains!);

      // Log every 5 sets of domains we register
      console.log(`Registered ${registeredDomains.length} set${i === 0 ? "" : "s"} of root domains...`);
    }

    console.log(`rds length: ${registeredDomains.length}`);
    // For logging to read correctly we capture the length
    const snapshotLength = registeredDomains.length;

    // Now subdomains
    console.log(`Registering ${subdomains.length} subdomains with slice size ${sliceSize}`);
    for (let i = 0; i < subdomains.length; i += sliceSize) {
      const slice = subdomains.slice(i, i + sliceSize);
      const localRegisteredDomains = await registerDomainsLocal(migrationAdmin, slice, zns);

      registeredDomains.push(localRegisteredDomains!);

      // Show progress as we register
      console.log(`Registered ${registeredDomains.length - snapshotLength} set${i === 0 ? "" : "s"} of subdomains...`);
    }
  }

  const end = Date.now();

  console.log(`Registered ${registeredDomains.length} sets of domains in ${end - start}ms`);

  // double check count is correct!

  let runningTotal = 0;
  for (const entry of registeredDomains) {
    runningTotal += entry.domainHashes?.length || 0;
    // console.log(`entry length: ${entry.domainHashes ? entry.domainHashes.length : 0}`);
  }
  console.log(`Registered ${runningTotal} domains in total`);

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