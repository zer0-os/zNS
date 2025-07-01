import { gql } from "@apollo/client/core";

export const getDomains = gql`
  query Domains($first: Int!, $skip: Int!, $isWorld: Boolean!) {
    domains(
      first: $first,
      skip: $skip
      where: { isWorld: $isWorld }
    ) {
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
      address
      isWorld
      isRevoked
      parentHash
      parent {
        id
        label
        depth
        isWorld
        isRevoked
        tokenId
        tokenURI
        parentHash
        parent {
          id
          label
          depth
          isWorld
          isRevoked
          tokenId
          tokenURI
          parentHash
          parent {
            id
            label
            depth
            isWorld
            isRevoked
            tokenId
            tokenURI
            parentHash
          }
        }
      }
      accessType
      pricerContract
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
      creationTimestamp
    }
  }
`;
