import * as apollo from "@apollo/client/core";

import * as q from "./queries.ts"
import { exit } from "process";

export const createClient = (subgraphUri: string): apollo.ApolloClient<apollo.NormalizedCacheObject> => {
  const client = new apollo.ApolloClient({
    link: new apollo.HttpLink({ uri: subgraphUri, fetch }),
    cache: new apollo.InMemoryCache(),
  });

  return client;
};

export const getWorlds = async <T,>(client: apollo.ApolloClient<T>) => {
  const result = await client.query({
    query: q.getWorlds
  });

  if (result.error) {
    console.log("booooooooo")
    exit(1);
  }

  return result.data.domains
}