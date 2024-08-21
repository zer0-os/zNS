import { createClient, getDomains } from "./client";
import { Domain, SubgraphError } from "../types";
import { validateDomain } from "./validate";
import { IZNSContracts } from "../../../deploy/campaign/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getZNS } from "../zns-contract-data";


// Grab domain data from the subgraph and validate against what's actually on mainnet
export const validateDomains = async (
  admin : SignerWithAddress,
  first : number,
  skip : number,
) => {
  // TODO mainnet dev for now, should be just mainnet
  // both use the same data though
  const url = process.env.SUBGRAPH_URL_DEV;

  if (!url) {
    throw new Error("Missing subgraph url");
  }

  const client = createClient(url);

  let rootDomains : Array<Domain>;
  let subdomains : Array<Domain>;

  const validRootDomains = Array<Domain>();
  const validSubdomains = Array<Domain>();
  const invalidDomains = Array<SubgraphError>();

  const start = Date.now();

  // Get root domains and subdomains from the subgraph
  rootDomains = await getDomains(client, first, skip, true);
  subdomains = await getDomains(client, first, skip, false);

  // Get ZNS contracts from the MongoDB instance to validate against
  const zns = await getZNS(admin);

  
  // Validate root domains
  while (rootDomains.length > 0) {
    console.log(`Validating ${rootDomains.length} root domains`);

    // If any domains are invalid, they will be returned in an array
    invalidDomains.concat(await validateEach(rootDomains, zns));

    // We always get 1000 domains at a time, so we can just increment by that
    skip += 1000;

    console.log(`Getting more root domains with first: ${first}, skip: ${skip}`);
    rootDomains = await getDomains(client, first, skip, true);
    console.log(`Found ${rootDomains.length} more root domains`);
  }

  // Validate subdomains
  let subCount = 0;
  while (subdomains.length > 0) {
    console.log(`Validating ${subdomains.length} subdomains`);

    // If any domains are invalid, they will be returned in an array
    invalidDomains.concat(await validateEach(subdomains, zns));

    skip += 1000;

    console.log(`Getting more subdomains with first: ${first}, skip: ${skip}`);
    subdomains = await getDomains(client, first, skip, false);
    console.log(`Found ${subdomains.length} more subdomains`);
  }

  const end = Date.now();
  console.log(`Validated all domains in ${end - start}ms`);

  return { validRootDomains, validSubdomains, invalidDomains };
}

const validateEach = async (domains : Array<Domain>, zns : IZNSContracts) => {
  const invalidDomains = Array<SubgraphError>();

  for (const [index, domain] of domains.entries()) {
    // Log any invalid domains
    const invalidDomain = await validateDomain(domain, zns);

    if (invalidDomain) {
      invalidDomains.push(invalidDomain);
    }

    if ((index + 1) % 100 === 0) console.log(`Validated ${index + 1} subdomains...`);
  }

  // Could be empty
  return invalidDomains;
}
