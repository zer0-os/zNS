import { createClient, getDomains } from "./subgraph/client";
import { Domain, SubgraphError } from "./subgraph/types";
import { validate } from "./validate";

import * as fs from "fs";

const main = async () => {
  const url = process.env.SUBGRAPH_URL;

  if (!url) {
    throw new Error("Missing subgraph url");
  }

  const client = createClient(url);
  // For pagination
  let skip = 0;
  const first = 10;

  let domains : Array<Domain>;

  const validDomains = Array<Domain>();
  const invalidDomains = Array<SubgraphError>();
  let count = 0;

  const start = Date.now();

  do {
    domains = await getDomains(client, first, skip);

    console.log(`Validating ${domains.length} domains`);

    for (const domain of domains) {

      // We only return a value when errors occur
      const invalidDomain = await validate(domain);

      validDomains.push(domain);
      if (invalidDomain) {
        invalidDomains.push(invalidDomain);
      }

      count++;
      if (count % 100 === 0) {
        console.log(`Validated ${count} domains`);
      }
    }

    skip += first;
  } while (false); // domains.length === first);, just to make it run once while testing

  const end = Date.now();
  console.log(`Validated ${count} domains in ${end - start}ms`);

  // If there are errors, log them to a file for triage
  if (invalidDomains.length > 0) {
    fs.writeFileSync("invalid-domains.json", JSON.stringify(invalidDomains, null, 2));
  }

  // Output validated domain data to a readable JSON file
  fs.writeFileSync("valid-domains.json", JSON.stringify(validDomains, null, 2));

  // NEXT should read from `validDomainsArray` and begin registration process
  // only if `invalidDomains` array is empty
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});