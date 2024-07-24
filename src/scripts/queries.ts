import { gql } from "@apollo/client/core";

// TODO remove first 5 after testing
export const getDomains = gql`
  query Domains {
    domains(
      first: 1000
      ) {
        id
        minter
        tokenOwner
        recordOwner
        depth
        label
        isReclaimable
        reclaimableAddress
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

export const simpleQuery = gql`
  query Domains ($domainHash: Bytes!){
    domains(where: {id: $domainHash}) {
      id
      label
      paymentToken {
        id
      }
    }
  }
`;