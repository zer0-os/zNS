import { gql } from "@apollo/client/core";

export const getDomains = gql`
  query Domains($first: Int!, $skip: Int!) {
    domains(first: $first, skip: $skip, orderBy: depth, orderDirection: asc) {
      id
      minter {
        id
      }
      owner {
        id
      }
      domainToken {
        owner {
          id
        }
      }
      isRevoked
      depth
      label
      isWorld
      address
      parentHash
      parent {
        id
        isRevoked
        label
      }
      accessType
      paymentType
      pricerContract
      paymentToken {
        id
        name
        symbol
      }
      paymentType
      curvePriceConfig {
        id
      }
      fixedPriceConfig {
        id
      }
      subdomainCount
      address
      tokenId
      tokenURI
      treasury {
        id
        beneficiaryAddress
      }
      creationBlock
    }
  }
`;
