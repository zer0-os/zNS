import * as hre from "hardhat";
import { createProvider } from "hardhat/internal/core/providers/construction";
import { createClient, getDomains } from "./client";
import { Domain, SubgraphError } from "../types";
import { validateDomain } from "./validate";

import { registerRootDomain } from "../registration";
import * as fs from "fs";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


// Grab domain data from the subgraph and validate against what's actually on mainnet
export const validateDomains = async (
  admin : SignerWithAddress,
  first : number,
  skip : number
) => {
  const url = process.env.SUBGRAPH_URL;

  if (!url) {
    throw new Error("Missing subgraph url");
  }

  const client = createClient(url);

  let domains : Array<Domain>;
  let count = 0;

  const validDomains = Array<Domain>();
  const invalidDomains = Array<SubgraphError>();

  const start = Date.now();

  // how do we ignore revokes of parent domains for now?
  domains = await getDomains(client, first, skip);

  while (domains.length > 0) { // TODO for debugging, change to match domains.length against skip

    console.log(`Validating ${domains.length} domains`);

    for (const domain of domains) {

      // We only return a value when errors occur
      const invalidDomain = await validateDomain(domain, admin);

      validDomains.push(domain);
      if (invalidDomain) {
        invalidDomains.push(invalidDomain);
      }

      count++;
      if (count % 100 === 0) {
        console.log(`Validated ${count} domains`);
      }
      // TODO Exit the loop after one iteration, temporary for debug
    }
    skip += first;

    domains = await getDomains(client, first, skip);

    break;
  }

  const end = Date.now();
  console.log(`Validated ${count} domains in ${end - start}ms`);

  return { validDomains, invalidDomains };
}