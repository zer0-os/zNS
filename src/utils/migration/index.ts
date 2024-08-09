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

// For pagination of data in subgraph we use 'first' and 'skip'
const main = async (
  first : number, 
  skip : number
) => {

  const [ migrationAdmin, governor, admin ] = await hre.ethers.getSigners();


  // First, validate domain data from subgraph against mainnet
  const { validDomains, invalidDomains } = await validateDomains(migrationAdmin, first, skip);

  // If there are errors, log them to a file for triage
  if (invalidDomains.length > 0) {
    fs.writeFileSync("invalid-domains.json", JSON.stringify(invalidDomains, null, 2));
    throw new Error("ivnalid domains! Check invalid-domains.json");
  }

  if (process.env.MIGRATION_LEVEL === "local") {
    const params = {
      deployer: migrationAdmin,
      governorAddresses: [migrationAdmin.address, governor.address],
      adminAddresses: [migrationAdmin.address, admin.address],
    };

    const zns = await deployZNS(params);

    const registeredDomains = await registerDomainsLocal(migrationAdmin, governor, admin, validDomains, zns);
  } else if (process.env.MIGRATION_LEVEL === "dev") {
    // Modify network dynamically to use sepolia things
    // We have several ZNS instances on sepolia already
    const networkName = "sepolia";
    const provider = await createProvider(
      hre.config,
      networkName,
    )
    hre.network.name = networkName;
    hre.network.config = hre.config.networks[networkName];
    hre.network.provider = provider;
    
    // Have to get signers again after modifying HH config
    const [ migrationAdmin ] = await hre.ethers.getSigners();

    // not typed right
    const zns = getZNSFromDB();
    
    // const zns = await getZNS({
    //   signer: migrationAdmin,
    //   action: "read"
    // });

    // console.log(await zns.rootRegistrar.getAddress())
    // first confirm network change works
    // await registerDomains({
    //   regAdmin: migrationAdmin,
    //   zns,
    //   domains: validDomains,
    // });
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

// Comment out to run in tests
// Uncomment to run as a script
main(1, 0).catch(error => {
  console.error(error);
  process.exitCode = 1;
});