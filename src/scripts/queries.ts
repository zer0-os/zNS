import { gql } from "@apollo/client/core";

// TODO remove first 5 after testing
export const getWorlds = gql`
  query WorldDomains {
    domains(first: 5, where: {isWorld: false}) {
      id
      minter {
        id
      }
      owner {
        id
      }
      label
      isReclaimable
      reclaimableAddress {
        id
      }
      isWorld
      address
      parentHash
      accessType
      paymentType
      pricerContract
      paymentToken {
        id
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
      }
      creationBlock
    }
  }
`;




{
  
}