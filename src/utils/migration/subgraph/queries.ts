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
      amountPaidStake
      amountPaidDirect
      accessType
      pricerContract
      paymentType
      subdomainCount
      tokenId
      tokenURI
      creationBlock
      creationTimestamp
      parent {
        id
        label
        depth
        isWorld
        isRevoked
        tokenId
        tokenURI
        parentHash
        treasury {
          paymentToken {
            id
            name
            symbol
          }
        }
        parent {
          id
          label
          depth
          isWorld
          isRevoked
          tokenId
          tokenURI
          parentHash
          treasury {
            paymentToken {
              id
              name
              symbol
            }
          }
          parent {
            id
            label
            depth
            isWorld
            isRevoked
            tokenId
            tokenURI
            parentHash
            treasury {
              paymentToken {
                id
                name
                symbol
              }
            }
          }
        }
      }
      curvePriceConfig {
        id
      }
      fixedPriceConfig {
        id
      }
    }
  }
`;
