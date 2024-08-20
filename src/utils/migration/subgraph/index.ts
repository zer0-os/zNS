import { createClient, getDomains } from "./client";
import { Domain, SubgraphError } from "../types";
import { validateDomain, validateDomainBulk } from "./validate";
import { IZNSContracts } from "../../../deploy/campaign/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getZNS } from "../zns-contract-data";


// Grab domain data from the subgraph and validate against what's actually on mainnet
export const validateDomains = async (
  admin : SignerWithAddress,
  first : number,
  skip : number,
) => {
  // TODO mainnet dev for now, should be
  const url = process.env.SUBGRAPH_URL_DEV;

  if (!url) {
    throw new Error("Missing subgraph url");
  }

  const client = createClient(url);

  let rootDomains : Array<Domain>;
  let subdomains : Array<Domain>;
  let count = 0;

  const validRootDomains = Array<Domain>();
  const validSubdomains = Array<Domain>();
  const invalidDomains = Array<SubgraphError>();

  const start = Date.now();

  // Get root domains and subdomains from the subgraph
  rootDomains = await getDomains(client, first, skip, true);
  subdomains = await getDomains(client, first, skip, false);

  // Get ZNS contracts from the MongoDB instance to validate against
  const zns = await getZNS(admin);

  let count = 0length;
  // Validate root domains
  while (rootDomains.length > 0) {
    console.log(`Validating ${rootDomains.length} root domains`);
    const { validDomains, invalidDomainsLocal } = await validateDomainBulk(rootDomains, zns);
    validRootDomains.concat(validDomains);

    // Log any invalid domains
    if (invalidDomains.length > 0) {
      invalidDomains.concat(invalidDomainsLocal);
    }

    // We always get 1000 domains at a time, so we can just increment by that
    skip += 1000;

    count++;
    if (count % 100 === 0) console.log(`Validated ${count} root domains...`);

    console.log(`Getting more root domains with first: ${first}, skip: ${skip}`);
    rootDomains = await getDomains(client, first, skip, true);
    console.log(`Found ${rootDomains.length} more root domains`);
  }

  // Validate subdomains
  count = 0;
  while (subdomains.length > 0) {
    console.log(`Validating ${subdomains.length} subdomains`);

    const { validDomains, invalidDomainsLocal } = await validateDomainBulk(subdomains, zns);
    validSubdomains.concat(validDomains);

    // Log any invalid domains
    if (invalidDomains.length > 0) {
      invalidDomains.concat(invalidDomainsLocal);
    }

    count++;
    if (count % 100 === 0) console.log(`Validated ${count} subdomains...`);

    skip += 1000;

    console.log(`Getting more subdomains with first: ${first}, skip: ${skip}`);
    subdomains = await getDomains(client, first, skip, false);
    console.log(`Found ${subdomains.length} more root domains`);
  }

  const end = Date.now();
  console.log(`Validated all domains in ${end - start}ms`);

  return { validRootDomains, validSubdomains, invalidDomains };
}
