# Base Distribution Configuration

When a top-level domain is registered through `ZNSRootRegistrar`, optional distribution configs --dictating the rules for creation of its subdomains -- can be specified. These are kept on the subdomain specific registrar `ZNSSubRegistrar` responsible for creating and managing subdomains.&#x20;

The registration process for subdomains also allows an optional distribution to be specified with the same parameters as specified below. If no configuration is provided, the configuration will be empty and any attempts to mint further subdomains will fail. The exception to this is if you are the owner of that domain or an approved operator. This case does not require payment and so payment configuration of the parent domain won’t matter.

> Note: All domain registrations include a "protocol fee" set by ZERO that applies only when the price and "stake fee" (if applicable) are above ZERO.
>
> If you are registering a domain through staking, "protocol fee" is symmetrical, meaning it will be charged when you register and when you revoke to get your stake back.

The configuration is as follows:

<table data-header-hidden><thead><tr><th></th><th width="440.3333333333333"></th><th></th></tr></thead><tbody><tr><td><strong>Property</strong></td><td><strong>Definition</strong></td><td><strong>Options</strong></td></tr><tr><td>IZNSPricerContract</td><td>The address of the contract that defines the pricing system for subdomains</td><td>ZNSFixedPricer (address) or ZNSCurvePricer (address)</td></tr><tr><td>PaymentType</td><td>Set the form of payment for subdomain creation.</td><td>Direct (0) or Stake (1)</td></tr><tr><td>AccessType</td><td>Specify what users are able to mint subdomains.</td><td>Locked (0), Open (1), or Mintlist (2)</td></tr></tbody></table>

A pricer contract is something that defines a model for how domains prices are to be calculated. Two price contracts are provided by ZNS as `ZNSFixedPricer` and `ZNSCurvePricer` but additional contracts are able to be developed and added for any community as the system is modular.

The fixed price contract defines a very simple model where the owner specifies a specific price for the cost of a subdomain and a fee that is optional and only used if parent chooses Stake payment for subdomains. For every subdomain of this domain, this will be the price. The curved price contract is more complex and specifies several variables that are used to calculate the price of a domain based on its length. More details on this are found here: [Broken link](broken-reference "mention")

> Note: Solidity does not allow optional parameters and so “optional” ones listed must be provided as zero values

Definitions of each option are:

* Direct: Payment is a transfer of funds from the user buying the domain to the beneficiary that the owner of the parent domain specified.
* Stake: Provide the contract with the funds until the subdomain is revoked by the owner and they are refunded. When domains are staked, there can be a stake fee applied as well if the parent domain owner has set one. When a domain is unstaked in the future, neither the stake fee or the protocol fee is returned and only the protocol fee will be charged again.
* Locked: Nobody can mint subdomains except for the owner or an allowed operator
* Open: Anyone can mint subdomains
* Mintlist**:** Only those on the specified list of allowed users can mint subdomains
