# Overview

A high level overview of ZNS

**ZNS (Zero Name Service**) is a naming system that provides unique identities and assigns human readable names for entities on the blockchain. It exists as its own system separated from those identities where at any point in time a user of the system can bind their blockchain wallet, smart contract, or any supported on or off-chain data to an available name they’ve chosen.

These names come in the form of domains or subdomains (e.g. _wilder_ or _wilder.world_) that are represented on-chain as standard ERC-721 tokens and specific records on ZNSRegistry smart contract. Ownership of a domain is divided into two pieces, the ownership of the token for that domain, and also the ownership of the domain’s record. These are kept in the `ZNSDomainToken` and `ZNSRegistry`respectively. This is done because true ownership is shown by owning the ERC-721 token, but this allows management of the domain by third-party applications without forfeiting actual ownership. See more in [Domain Ownership, Reclamation, and Token Transfers](<.gitbook/assets/domain ownership reclamation and token transfers>).

#### Smart Contract Upgradability <a href="#smart-contract-upgradability" id="smart-contract-upgradability"></a>

Most of the contracts in zNS (except `ZNSAccessController`) are upgradeable UUPS Proxies. We understand the limitations it entails, so please consider the following:

1.  1\.

    We decided to go with upgradeable pattern for zNS to ensure we are able to fix any potential problems that may arise in the system with usage. We also wanted to have an ability to evolve system over time with the help of user feedback and possibly add features that our users might find necessary.
2.  2\.

    Upgradability of contracts will be managed by the Zero DAO, which will directly control all aspects of zNS over time. The control will start with a Zero 6 of 12 multisig and slowly evolve into a full fledged DAO which will gain more and more control over time as the system logic finalizes.
3.  3\.

    All upgradeable proxies are of UUPS kind. One of the main reasons to use UUPS here is to introduce a way to remove upgradability with time after the system is fully finalized and proven to be bug free or if the Zero DAO decides to do it themselves.
4.  4\.

    Since Zero is an open-source platform, all smart contract changes coming with proxy upgrades will be public and available for anyone to see and analyze. In addition to that, any significant logic changes to existing contracts or addition of new contracts will be audited before they are deployed to Ethereum mainnet. When the DAO is fully functional, only the DAO will be able to approve a mainnet contract upgrade.

#### Subdomain Parental Control <a href="#subdomain-parental-control" id="subdomain-parental-control"></a>

Owners of parent domains that distribute subdomains have the power over the whole distribution process (type of payment, pricing, fees, access) and can change any of it at any time.

However, created and existing subdomains are fully emancipated from the parent once they are registered, meaning that the owner of the parent domain can NOT revoke his children, "rugpull" domains from under current owners or do anything else at all to any existing subdomain. You only have to trust the parent owner when you are buying the subdomain, after that, the only person who can control existing domain is you and you only. For more information on ownership see [Ownership](https://about/zns-documentation/domain-management/domain-ownership-reclamation-and-token-transfers#ownership).
