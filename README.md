# Overview

### **ZERO Name Service**

**ZERO Name Service (ZNS**) is a naming system providing unique identities and human readable names for entities on the blockchain. ZNS exists as its own system separated from those identities; at any point ZNS users can bind blockchain wallets, smart contracts, or any other supported on or off-chain data to an available name they've registered. ZNS names are left-right dot-concatenated, and routed via the _0://_ prefix, e.g. _0://hello_ or _0://hello.goodbye_. For more information ZNS nomenclature, see [names-and-hashing.md](names-and-hashing.md "mention")

### ZNS Domains

Names in ZNS can be one of two designations: top-level domains or subdomains (which are infinitely iterative from the second-level and beyond).  ZNS domains are represented on-chain as standard ERC-721 tokens (NFTs) and as specific records in the `ZNSRegistry` smart contract. Domain ownership is bipartite, comprised of this NFT token ownership and the domain's record ownership. These are stored in the `ZNSDomainToken` and `ZNSRegistry` smart contracts, respectively. While true ownership of the domain is conferred to the owner of the ERC-721 token, ZNS users can delegate ownership of their domain's record, which allows for management of the domain by third-party applications _without forfeiting actual ownership_. This model is outlined further in [domain-ownership-reclamation-and-token-transfers.md](domain-management/domain-ownership-reclamation-and-token-transfers.md "mention")

### Domain Creation

Ownership of any ZNS domain confers the ability to create subdomains underneath it. Top-level domains (_0://hello_) can spin out child domains (_0://hello.goodbye_). Likewise, child subdomains can create further subdomains underneath themselves (_0://hello.goodbye.bonjour_), which can create still further subdomains (_0://hello.goodbye.bonjour.adieu_) in an infinite chain from the top to twentieth or hundredth level and beyond. This extremely powerful paradigm makes ZNS ideal for building out systems of blockchain organization like DAO and sub-DAO communities, especially with the 'parental controls' in place governing subdomain minting and child Domain autonomy.

> In ZERO's native ZERO ID protocol and Explorer application, top-level ZNS domains are known as _"_Worlds" and any level of subdomain is referred to simply as a "Domain."&#x20;

### Subdomain Parental Control

Domain owners have total control over the subdomain distribution process for that domain, should they choose to allow it. While domain owners always have the ability to register child domains under their own parent domain, they can choose to open or restrict that same ability to the general public. Should a ZNS domain owner choose to 'open' their domain to public subdomain registration, they have power over the entire distribution process: subdomain pricing and fees, type of payment accepted (stake or direct, specific ERC-20 token), mint payment beneficiary, etc. Moreover, the owner of a domain that allows subdomain registration can change any of these configurations at any time.

Once created, however, any child domain is fully emancipated from its parent domain. This means that the owner of the parent domain cannot revoke, or "rugpull", subdomains from under their current owners. They cannot otherwise affect or alter the subdomains registered under their parent. \
\
The trustful relationship between a parent domain and its child subdomain extends only to the registration process. After that, a subdomain owner has complete control over their domain regardless of the parent domain owner. For more information on ownership in ZNS, see [domain-ownership-reclamation-and-token-transfers.md](domain-management/domain-ownership-reclamation-and-token-transfers.md "mention") and [#domain-revocation](./#domain-revocation "mention").

### Domain Revocation

ZNS allows for the registration of top-level domains and subdomains via stake-to-mint, as well as one-time, direct payments. In the event that a domain was registered via stake payments -- as with ZERO ID's Worlds -- that stake payment can be reclaimed by the domain owner at any time, functionally revoking the domain. A domain that has been revoked becomes available to register again by anyone; new subdomains cannot be minted under a revoked domain until it has been re-registered. As mentioned above in [#subdomain-parental-control](./#subdomain-parental-control "mention"), existing children domains under a revoked parent domain remain fully emancipated and intact.&#x20;
