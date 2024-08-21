import * as hre from "hardhat";
import * as fs from "fs";
import { validateDomains } from "./subgraph";
import { INV_FILENAME, ROOTS_FILENAME, SUBS_FILENAME } from "./constants";

// For pagination of data in subgraph we use 'first' and 'skip'
const main = async () => {
  const [ migrationAdmin, governor, admin ] = await hre.ethers.getSigners();

  // Max value for `first` is 1000
  // Use `skip` to paginate through the data
  const first = 1000;
  const skip = 0;

  // First, validate domain data from subgraph against mainnet
  const { validRoots, validSubs, invalidDomains } = await validateDomains(migrationAdmin, first, skip);

  // If there are errors, log them to a file for triage
  if (invalidDomains.length > 0) {
    fs.writeFileSync(INV_FILENAME, JSON.stringify(invalidDomains, null, 2));
    throw new Error(`Some domains failed validation! Check '${INV_FILENAME}'`);
  }

  fs.writeFileSync(ROOTS_FILENAME, JSON.stringify(validRoots, null, 2));
  fs.writeFileSync(SUBS_FILENAME, JSON.stringify(validSubs, null, 2));
  
  // Doesnt seem to be exiting HH process automatically?
  process.exit(0);
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});