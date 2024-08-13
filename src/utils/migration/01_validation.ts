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
const main = async () => {
  const [ migrationAdmin, governor, admin ] = await hre.ethers.getSigners();

  // Max value for `first` is 1000
  // Use `skip` to paginate through the data
  const first = 1000;
  const skip = 0; 

  // First, validate domain data from subgraph against mainnet
  const { validDomains, invalidDomains } = await validateDomains(migrationAdmin, first, skip);

  // If there are errors, log them to a file for triage
  if (invalidDomains.length > 0) {
    fs.writeFileSync("invalid-domains.json", JSON.stringify(invalidDomains, null, 2));
    throw new Error("invalid domains! Check invalid-domains.json");
  }

  fs.writeFileSync("valid-domains.json", JSON.stringify(validDomains, null, 2));
  
  process.exit(0);
};

// Comment out to run in tests
// Uncomment to run as a script
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});