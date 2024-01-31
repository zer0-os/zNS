# Operating Your Domains

### Overview

Domain owners have access to functionality dictating how others can engage with that domain, e.g.,  how users can access that domain, what payment is for subdomain registration, who is allowed to register a subdomain, and so on. Within `ZNSRegistry`  a domain owner can specify the owner of that domain record, as well as the resolver being used for that domain. Read more on resolvers in [Broken link](broken-reference "mention").

Domain owners can set three discrete configurations for their domains. At any time an owner can modify these configurations, or remove them entirely. They are as follows:

* **Distribution Configuration** - specifies who can register subdomains under a domain, how payment is made, and the pricing contract used to generate prices for those domains. Read more in [Broken link](broken-reference "mention")
* **Payment Configuration** - specifies what ERC-20 token is accepted for payment and what address receives funds related to the registration of subdomains under that parent domain. This address is referred to as the beneficiary. Read more in [Broken link](broken-reference "mention")
* **Pricing Configuration** - specifies the values required by the pricing contract as defined in a domain's distribution configuration. These allow the contract to calculate prices in a way that is adjustable by the owner of that domain. These configurations can complex or simple, depending on the needs of the chosen price contract. Read more in [Broken link](broken-reference "mention")&#x20;

### Operators

ZNS domain ownership is two-part:  ownership of the domain's ERC-721 standard token -- which is recognized by all other public exchanges as the core ownership of an NFT -- and  ownership as specified in that domain's record in the `ZNSRegistry` contract. This division is purposeful; it enables third-party applications to manage a user's domain all while that user remains the fundamental owner of the domain per ZNS definitions.&#x20;

Users or third parties that manage a given domain's record -- but do not own its domain token -- are referred to as **operators** in ZNS. To enable another user or a third-party application to make changes to a domain, their address must be added as an allowed operator in the `ZNSRegistry` contract.

That said, specifying an operator is not required in order to transfer ownership of a domain's record to another account. Operators are only required if the owner of the domain's record -- be it a contract or another user -- intends to make changes to that domain's management functions at any time.

{% hint style="danger" %}
Be wary when transferring a ZNS domain's ownership to third-party protocols. Always verify that an application's contract operate in the expected manner!
{% endhint %}

Once specified, an operator can access all domain management functions for a given domain, less those that modify ownership or add further operators. To wit, operators cannot revoke or reclaim a domain. Revocation is only available to a user that owns both the domain token as well as the name of that domain specified by the record in the `ZNSRegistry`. See [Broken link](broken-reference "mention")for more details. Reclamation of a domain is only possible by the owner of that domain's token. Refer to [Broken link](broken-reference "mention")for more information.

{% hint style="info" %}
Note: Operators as assigned on a per user basis, not per domain. Allowing an operator means that address will be able to modify the configuration of all domains that that user owns, just as they could.
{% endhint %}
