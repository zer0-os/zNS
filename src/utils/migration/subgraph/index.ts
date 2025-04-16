import { createClient } from "./client";
import * as q from "./queries";


// Grab domain data from the subgraph and validate against what's actually on mainnet

export const getUsersAndDomains = async () => {
  const first = 1000;
  let skip  = 0;

  let client = await createClient();

  // First get all worlds
  let result = await client.query({
    query: q.getUsersAndDomains,
    variables: {
      first,
      skip,
    },
  });

  if (result.error) throw Error(`Error in graph query: ${result.error}`);

  const users = [];

  // We do this to collect ALL domains in a single array
  while (result.data.users.length > 0) {

    // For each user, get every domain
    for (const user of result.data.users) {
      // user data from subgraph already has user and all domains
      // so just return this
      users.push(user);
    }

    // Get next batch of domains
    skip += 1000;

    // Refresh client
    client = await createClient();

    result = await client.query({
      query: q.getUsersAndDomains,
      variables: {
        first,
        skip,
      },
    });
  }

  return users;
};


