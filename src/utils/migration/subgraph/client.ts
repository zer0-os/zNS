import {
  ApolloClient, 
  HttpLink, 
  InMemoryCache, 
  NormalizedCacheObject
} from "@apollo/client";


export const createClient = (subgraphUri ?: string) : ApolloClient<NormalizedCacheObject> => {
  const uri = subgraphUri ? subgraphUri : process.env.SUBGRAPH_URL_DEV;

  if (!uri) throw Error("No Subgraph URI provided");

  const client = new ApolloClient({
    link: new HttpLink({ uri: uri, fetch }),
    cache: new InMemoryCache(),
  });

  return client;
};
