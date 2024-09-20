import { createClient, getDomains } from "./client";
import { Domain, SubgraphError } from "../types";
import { validateDomain } from "./validate";
import { IZNSContracts } from "../../../deploy/campaign/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getZNS } from "../zns-contract-data";
import { ApolloClient, NormalizedCacheObject } from "@apollo/client"; // CommonJS error?
// import {ApolloClient } from "@apollo/client/core";



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

  const start = Date.now();

  // Get ZNS contracts from the MongoDB instance to validate against
  const zns = await getZNS(admin);

  // Validate root domains then subdomains
  const roots = await validateEach(client, zns, first, skip, true);
  const subs = await validateEach(client, zns, first, skip, false);

  const end = Date.now();
  console.log(`Validated all domains in ${end - start}ms`);

  return { 
    validRoots : roots.validDomains,
    validSubs : subs.validDomains,
    invalidDomains : roots.invalidDomains.concat(subs.invalidDomains)
  };
}

const validateEach = async (
  client : ApolloClient<NormalizedCacheObject>,
  zns : IZNSContracts,
  first : number,
  skip : number,
  isWorld : boolean
) => {
  const invalidDomains = Array<SubgraphError>();
  const validDomains = Array<Domain>();

  let domains = await getDomains(client, first, skip, isWorld);

  while (domains.length > 0) {
    console.log(`Validating ${domains.length} domains`);

    for (const [index, domain] of domains.entries()) {
      // `validateDomain` only returns a value if there is an error
      const invalidDomain = await validateDomain(domain, zns);
  
      if (invalidDomain) {
        invalidDomains.push(invalidDomain);
      } else {
        validDomains.push(domain);
      }
  
      if ((index + 1) % 100 === 0) console.log(`Validated ${index + 1} subdomains...`);
    }

    // We always get 1000 domains at a time, so we can just increment by that
    skip += 1000;

    console.log(`Getting more domains with first: ${first}, skip: ${skip}`);
    domains = await getDomains(client, first, skip, isWorld);
    console.log(`Found ${domains.length} more root domains`);
  }
  
  // Invalid domains could be empty
  return { validDomains, invalidDomains };
}
