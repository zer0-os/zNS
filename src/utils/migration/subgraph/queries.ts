import { gql } from "@apollo/client/core";

export const getDomains = gql`
  query Domains($first: Int!, $skip: Int!) {
    domains(first: $first, skip: $skip) {
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
      depth
      label
      isWorld
      address
      parentHash
      parent {
        id
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
