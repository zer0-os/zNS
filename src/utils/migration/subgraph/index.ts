import { createClient } from "./client";
import * as q from "./queries";

// Grab domain data from the subgraph and validate against what's actually on mainnet
export const getDomains = async (isWorld : boolean) => {
  const first = 1000;
  let skip  = 0;

  let client = await createClient();

  // First get all worlds
  let result = await client.query({
    query: q.getDomains,
    variables: {
      first,
      skip,
      isWorld,
    },
  });

  if (result.error) throw Error(`Error in graph query: ${result.error}`);

  const domains = [];

  // We do this to collect ALL domains in a single array
  while (result.data.domains.length > 0) {
    // For each user, get every domain
    for (const domain of result.data.domains) {
      // user data from subgraph already has user and all domains
      // so just return this
      domains.push(domain);
    }

    // Get next batch of domains
    skip += 1000;

    // Refresh client each iteration
    client = await createClient();

    result = await client.query({
      query: q.getDomains,
      variables: {
        first,
        skip,
        isWorld,
      },
    });
  }

  return domains;
};


