# Subdomain Distribution

### Subdomain Design <a href="#design" id="design"></a>

The `ZNSSubRegistrar` is used for registering and managing subdomains. It connects to the `ZNSRootRegistrar` to settle the most crucial domain data (owner, resolver, NFT) and stores subdomain distribution data (pricing, payment, access option) on itself.&#x20;

The `ZNSRootRegistrar` calls the `ZNSSubRegistrar` to get distribution data for root domains as well as to set this data for newly registered root domains.

Every root domain or subdomain in the chain is a potential parent for subdomain distribution and can set its own configs and rules for this. These configs can be changed or turned off at any time by the owner of the relevant domain

### Distribution

A domain of any level in zNS supports issuing subdomains. The rules and the availability of subdomains for a certain domain of any level depends on the rules set by the owner of the parent domain. As written in the [domain-registration.md](../domain-registration.md "mention") section, parts of the full distribution configuration (excluding pricing) can be set right in the registration transaction. When you are buying your domain for the first time, you will still have to do another transaction to the pricer contract specified in your distribution configuration to set the prices and fees (if applicable) that will be paid for your subdomains.

There are several necessary configs that need to be set by the domain owner to fully turn on subdomain distribution. They are further detailed in [operating-your-domains.md](../domain-management/operating-your-domains.md "mention").
