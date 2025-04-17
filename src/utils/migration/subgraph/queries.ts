import { gql } from "@apollo/client/core";

export const getUsersAndDomains = gql`
  query Domains($first: Int!, $skip: Int!) {
    users(first: $first, skip: $skip) {
      id
      domains {
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
      }
    }
  }
`;
