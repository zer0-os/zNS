import * as hre from "hardhat";
import { createProvider } from "hardhat/internal/core/providers/construction";
import { createClient, getDomains } from "./subgraph/client";
import { Domain, SubgraphError } from "./types";
import { validateDomain } from "./subgraph/validate";

import { registerRootDomain, registerRootDomainBulk } from "./registration";
import * as fs from "fs";
import { validateDomains } from "./subgraph";
import { getConfig } from "../../deploy/campaign/environments";
import { runZnsCampaign } from "../../deploy/zns-campaign";
import { deployZNS } from "../../../test/helpers";
import { IZNSContractsLocal } from "../../../test/helpers/types";

const main = async () => {

  const [migrationAdmin, zeroVault, governor, admin ] = await hre.ethers.getSigners();


  let first = 25;
  let skip = 0;
  // First, validate domain data from subgraph against mainnet
  const { validDomains, invalidDomains } = await validateDomains(migrationAdmin, 25, 0);

  // If there are errors, log them to a file for triage
  if (invalidDomains.length > 0) {
    fs.writeFileSync("invalid-domains.json", JSON.stringify(invalidDomains, null, 2));
    // exit?
    // exit as soon as we find a single one?
  }

  let mongoAdapter;

  // TODO figure out where this flow goes
  if (process.env.MIGRATION_LEVEL === "local") {
    // Set network to stop forking mainnet
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [],
    });

    const params = {
      deployer: migrationAdmin,
      governorAddresses: [migrationAdmin.address, governor.address],
      adminAddresses: [migrationAdmin.address, admin.address],
    };
    
    // Helper for local environment
    // TODO runznsCampaign causes errors?
    let zns : IZNSContractsLocal = await deployZNS(params); 

    // Give minter balance and approval for registrations
    await zns.meowToken.connect(migrationAdmin).mint(migrationAdmin.address, hre.ethers.parseEther("99999999999999999999"));
    await zns.meowToken.connect(migrationAdmin).approve(await zns.treasury.getAddress(), hre.ethers.MaxUint256);
    
    console.log("Registering domains");
    const start = Date.now();
    await registerRootDomainBulk({
      zns,
      regAdmin: migrationAdmin,
      domains: validDomains,
    });
    const end = Date.now();
    console.log(`Time taken: ${end - start}ms`);
  } else if (process.env.MIGRATION_LEVEL === "dev") {
    // TODO implement and verify
    // Modify network dynamically to use sepolia things
    // We have several ZNS instances on sepolia already
    // const networkName = "sepolia";
    // const provider = await createProvider(
    //   hre.config,
    //   networkName,
    // )
    // hre.network.name = networkName;
    // hre.network.config = hre.config.networks[networkName];
    // hre.network.provider = provider;
  } else if (process.env.MIGRATION_LEVEL === "prod") {
    // TODO implement
    // Connect to meowchain for real recreation of domain tree
  } else {
    throw new Error("Invalid migration level");
  }

  process.exit(0);

  // If we can't jointly do both "read" and "write" steps together, we will
  // output validated domain data to a readable JSON file for "write" step
  // fs.writeFileSync("valid-domains.json", JSON.stringify(validDomains, null, 2));
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});