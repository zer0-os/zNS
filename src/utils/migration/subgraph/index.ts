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
  skip : number
) => {
  // TODO mainnet dev for now, should be
  const url = process.env.SUBGRAPH_URL_DEV;

  if (!url) {
    throw new Error("Missing subgraph url");
  }

  const client = createClient(url);

  let domains : Array<Domain>;
  let count = 0;

  const validDomains = Array<Domain>();
  const invalidDomains = Array<SubgraphError>();

  const start = Date.now();

  domains = await getDomains(client, first, skip);

  // Get ZNS contracts from the MongoDB instance to validate against
  const zns = await getZNS({
    signer: admin,
    action: "read"
  });

  while (domains.length > 0) {
    console.log(`Validating ${domains.length} domains`);

    for (const domain of domains) {

      // We only return a value when errors occur
      const invalidDomain = await validateDomain(domain, zns);

      validDomains.push(domain);
      if (invalidDomain) {
        invalidDomains.push(invalidDomain);
      }

      count++;
      if (count % 100 === 0) {
        console.log(`Validated ${count} domains`);
      }
    }

    // Add 1000 to skip for all future iterations to get as many entities 
    // as possible from a single query
    skip += 1000;

    console.log(`Getting more domains with first: ${first}, skip: ${skip}`);
    domains = await getDomains(client, first, skip);
    console.log(`Found ${domains.length} more domains`);
  }

  const end = Date.now();
  console.log(`Validated ${count} domains in ${end - start}ms`);

  return { validDomains, invalidDomains };
}
