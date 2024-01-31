# Domain Registration

### Registration Data

<figure><img src="broken-reference" alt=""><figcaption><p>The complete ZNS architecture</p></figcaption></figure>

There are two contracts responsible for registering domains:

1. `ZNSRootRegistrar` - Top-level (root) domains. "Worlds" in ZERO ID.
2. `ZNSSubRegistrar` - Subdomains. "Domains" in ZERO ID.

Domain registration at any level requires data to be passed from the buyer to the contract. Some of this data is necessary, and some is optional. Data optionability is contingent on desire and readiness to allow for the open registration of subdomains for the given domain being registered. This distribution data is baked into the optional subdomain minting configurations required to open a domain to subdomain registrations. It can be set at the time of parent domain registration or at any point after registration by directly calling the relevant contracts, or through application layers like ZERO's Explorer UI.

> Supplying optional data on registration will increase the price of the registration transaction. If you set these configurations later, a separate transaction will be required.

The only parameter **required** to register a domain is `name` or `label`, for the registration of top-level domains or subdomains respectively. These are the human-readable identifiers of a domain. In _0://john_   -- a top level domain -- both the `name` and `label` are _john._ In _0://john.art --_ a subdomain -- the `name` is _john.art_ and the `label` of the subdomain is just _art_.

All optional parameters for registration data are outlined below, in [#distribution-config](domain-registration.md#distribution-config "mention")and [#payment-config](domain-registration.md#payment-config "mention").

### Warnings <a href="#registration" id="registration"></a>

{% hint style="danger" %}
Be sure to review subdomain registration rules set by the parent domain's owner before purchasing a subdomain. ZNS allows parent domain owners to accept payment for child domains in any ERC-20 token. In case of stake-to-mint subdomains, revoking the subdomain and reclaiming stake will return the stake in whatever amount and ERC-20 token was required to mint.&#x20;

Because ERC-20 tokens can vary greatly in price day-to-day or year-to-year, the value of a reclaimed stake on domain registration might be less than its origin value at the time of stake. This is can be based on a variety of factors that including token supply, deflationary or inflationary nature, simple price variability, market forces, and more.&#x20;

ZERO recommends thoroughly researching any ERC-20 token being used to register subdomains. ZNS provides a means to freely set rules and tokens for any domain owner, but cannot guarantee how these tokens and economies will work outside of ZNS.
{% endhint %}

A domain's price and associated fees can be learned by calling the respective Pricer contract's `getPriceAndFee()` function and `ZNSCurvePricer.getFeeForPrice()` to get the amount for `protocolFee`. This price and amount of ERC-20 tokens must be approved at the wallet level in order to register a domain. Similarly, the fees for the `ZNSTreasury` contract that will perform token transfers must also be approved at the dApp level to continue the domain registration process.

{% hint style="danger" %}
When approving any contract to spend funds, only approve exact amount you have reviewed and agreed to doing the registration flow. Do not approve `ZNSTreasury` or any other smart contract to spend more tokens than what is required by the domain price and additional fees referenced above. Approving more than the price detailed at the dApp level, is in Explorer, can leave the door open or exploitation.

As a general rule, approving only exact amounts when dealing with smart contracts or other wallets and safeguards against exploitation or other malicious actions.
{% endhint %}

### Distribution Config

The main configuration that links all of the distribution rules together when registering a domain includes:

* &#x20;`pricerContract`  -  points to the contract responsible for returning or calculating prices for subdomains
* `PaymentType` - reflects how users will pay for subdomains
* `AccessType` - signifies who (or no one at all) can create subdomains of a given domain.

See [Broken link](broken-reference "mention") section for detailed explanation of this config.

### Payment Config

These configurations are optional when minting a domain, but necessary to allow for the open minting of subdomains under that domain:

* `token` - The ERC-20  in which subdomain payments will be accepted
* `beneficiary` - The address that will receive subdomain payments or fees related to staked payments.

See the [Broken link](broken-reference "mention") section for detailed explanation of this config.

{% hint style="info" %}
Please note that anyone who owns the domain's ERC-721 token and its record (see [Broken link](broken-reference "mention")) can bypass all the above-detailed distribution rules for subdomains when minting their own subdomains under the parent domain in question, i.e., a domain owner can register any number of subdomains at any time for free (less transaction fees) under their own parent domain.
{% endhint %}

### Domain Content

Any domain in ZNS can be linked to specific on- or off-chain data. This data can be set during the domain registration process, or at any later point by the domain's owner. At present, ZNS only supports the address resolvers, allowing any domain in the system to be resolved to an Ethereum address. See [Broken link](broken-reference "mention")for more information.

### Token URI

As every domain is in ZNS represented by an ERC-721 token, any domain can be pointed to specific metadata. Currently, ZNS only support images generated by the ZERO ID Explorer platform. Upon domain registration for ZERO ID, Explorer will generate a domain's image and supply the URI automatically at the time of registration.

> For full ZERO platform integration, it is recommended not to supply a custom `tokenURI` , but to use the one generated as part of registration via Explorer. ZERO does not currently support custom images and metadata.

For more image generation and usage information, please refer to ZERO's Explorer documentation.
