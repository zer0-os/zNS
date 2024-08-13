import * as hre from "hardhat";
import { createProvider } from "hardhat/internal/core/providers/construction";
import { createClient, getDomains } from "./subgraph/client";
import { Domain, SubgraphError } from "./types";
import { validateDomain } from "./subgraph/validate";

// import { registerRootDomain, registerDomains } from "./registration";
import * as fs from "fs";
import { validateDomains } from "./subgraph";
import { getConfig } from "../../deploy/campaign/environments";
import { runZnsCampaign } from "../../deploy/zns-campaign";
import { deployZNS } from "../../../test/helpers";
import { IZNSContractsLocal } from "../../../test/helpers/types";
import { registerDomains, registerDomainsLocal } from "./registration";
import { getZNS } from "./zns-contract-data";
import { getZNSFromDB } from "./database";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// Script #2 to be run AFTER validation of the domains with subgraph
const main = async () => {
  const [ migrationAdmin, governor, admin ] = await hre.ethers.getSigners();

  const domains = JSON.parse(fs.readFileSync("valid-domains.json", {
    encoding: "utf8"
  })) as Array<Domain>;

  if (process.env.MIGRATION_LEVEL === "local") {
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
    await registerDomainsLocal(migrationAdmin, governor, admin, domains, zns);
  } else if (process.env.MIGRATION_LEVEL === "dev") {
    
  } else if (process.env.MIGRATION_LEVEL === "prod") {

  } else {
    throw new Error("Invalid migration level env variable. Must specify 'local', 'dev', or 'prod'");
  }

  
  // fs.writeFileSync("valid-domains.json", JSON.stringify(validDomains, null, 2));


  process.exit(0);
};

// Comment out to run in tests
// Uncomment to run as a script
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});