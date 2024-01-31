# Operating Your Domains

Functionality is made available to you as the owner of a domain that allows you to control how others will engage with it. Specifically, you can control the how users access your domain, what their payment looks like if they register a subdomain of your domain, who is allowed to register a subdomain, and so on.

Within the `ZNSRegistry` specifically you are able to control the domain record for your domain which specifies the owner of that domain as well as the resolver being used for that domain. Read more on resolvers in [Domain Content and Resolutions](broken-reference)​

To create a complete picture of a domain, three configurations are to be set for it. At any time an owner is able to modify these configurations or remove them entirely. They are listed below as:

* Distribution configuration specifies who can register subdomains on your domain, how payment is made, and the pricing contract you use to generate prices for those domains. Read more in [Base Distribution Configuration](broken-reference)​
* Payment configuration specifies what ERC20 token payment is to be made in and what address will receive funds related to the registration of subdomains on your domain. This address is referred to as the beneficiary. Read more in [Payments](broken-reference)​
* Pricing configuration specifies the values that are required by the pricing contract defined in a domain's distribution configuration. These allow the contract to calculate prices in a way that is adjustable by the owner of that domain. These configurations could be complex or simple, depending on the needs of the chosen price contract. Read more in [Pricing](broken-reference)

Ownership of a domain in ZNS is divided into two pieces. First is the ownership in the ERC-721 token which is recognized by all other public exchanges as the core ownership of an NFT. The second is the ownership as specified in that domain's record in the `ZNSRegistry.`

This division is purposeful in that it allows third-party applications to make use of your domain while you still own it in the eyes of ZNS. To allow another user or a third-party application to make changes to your domain, you can add that address as an allowed operator in the `ZNSRegistry`.

Specifying an operator is not required, however, in order to transfer part of the ownership to another user contract because that contract won't be making any changes to your domain. Only if you intend to allow another user or contract to make changes to any of the domains you own, you must add them as a valid operator.

Note: Be very careful when transferring your NFT to any other protocols. Be sure to verify that their contracts operate in the way you expect!

Once specified, an operator is then able to access all of the domain management functions besides any that modify ownership or add further operators. Specifically, operators are not able to call to revoke or reclaim a domain. Revoking is only available to a user that owns both the domain token as well as the name of that domain specified by the record in the `ZNSRegistry`. Reclaiming a domain is only available to the owner of that domain's token.

Note: Operators as assigned on a per user basis, not per domain. Allowing an operator means that address will be able to modify the configuration of all domains that that user owns, just as they could.
