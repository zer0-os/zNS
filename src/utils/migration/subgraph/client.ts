import * as apollo from "@apollo/client/core";

import * as q from "./queries";

export const createClient = (subgraphUri : string) : apollo.ApolloClient<apollo.NormalizedCacheObject> => {
  const client = new apollo.ApolloClient({
    link: new apollo.HttpLink({ uri: subgraphUri, fetch }),
    cache: new apollo.InMemoryCache(),
  });

  return client;
};

export const getDomains = async <T,>(client : apollo.ApolloClient<T>, first : number, skip : number, isWorld : boolean) => {
  const result = await client.query({
    query: q.getDomains,
    variables: {
      first,
      skip,
      isWorld
    },
  });

  if (result.error) {
    throw new Error("Error in subgraph query `getDomains`");
  }

  return result.data.domains;
};