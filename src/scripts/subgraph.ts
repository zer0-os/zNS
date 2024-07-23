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

export const simpleQuery = async <T,>(client: apollo.ApolloClient<T>, domainHash: string) => {
  const result = await client.query({
    query: q.simpleQuery,
    variables: {
      domainHash
    }
  });

  if (result.error) {
    console.log("Error in subgraph query `simpleQuery`")
    exit(1);
  }

  return result.data.domains;
}

export const getDomains = async <T,>(client: apollo.ApolloClient<T>) => {
  const result = await client.query({
    query: q.getDomains
  });

  if (result.error) {
    console.log("Error in subgraph query `getDomains`")
    exit(1);
  }

  return result.data.domains
}