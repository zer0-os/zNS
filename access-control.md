Operations Overview (subdomain ops are exempted)

High Level Operations

zNSRegistry

zNSDomainToken

zNSAddressResolver (zNS Default Resolver?)

zNS TLD Registrar/SubdomainRegistrar (ZNSEthRegistrar)
* mint new domains
* Update name storage of zNSRegistry (TLD only?)

zNSPriceOracle

Reference Code https://github.com/zer0-os/zNS/pull/18/

Goal: Identify internal operations and assign them sec, no sec
Identify admin only operations
Identify operations of specific users
Identify operations needed to maintain a subset of the system

Operations
1. zNSEthRegistrar (TLD/Subdomain Registrar)
2. zNSRegistry
    * exists - internal, nosec
    * isAllowedOperator - ? RFC - why do we care about owner, operators can be tied solely to domain
        * Replace With: nosec getDomainRoles() - returns an accounts roles from highest -> lowest sec for a given domain
    * getDomainRecord - internal, nosec
    * setDomainRecord - external, sec - Admin (creation)/operator(existing)
        * Admin or admin contract is solely responsible for entering new TLDs into the system, but operators
        * Operators are set on creation, with a sole operator defaulting to owner, but with the option to define multiple operators
        * modification of TLDs can be done via individual functions or with different require checks within this function
    * setOwner - sec - operator only
        * setOwner becomes -> clearOperatorsAndSend, requires multisig majority 
    * setResolver - sec- operator only (custom resolver requires operator to authorized on resolver as well)
3. zNSDomainToken
4. zNSAddressResolver (Default Resolver)
5. zNSPriceOracle

Ideas: For ZNS contracts - two layers, operators and ZAAC (Zero Admin Access Control) - responsible for maintaining the integrity of the system via zNS.
Can define multi-sig minimums for high sec operations based on number of operators

Domain Operators
Resolver Maintainers

Role based needs & recommendations
* Replace concept of owner with operators: Default to minter as sole operator but with the option for multiple operators to be set at creation
* Authorization to Associate Domain -> Non Default Resolver Contract:
    * ZNS users could register custom resolvers and resolver maintainers in a ZNS contract, where access to ops can be defined: ResolverRegistrar
    * Does zns guarantee resolvers are protected from bad actors?


Cross-Contract Operations
1. zNSEthRegistrar (TLD/Subdomain Registrar)
2. zNSRegistry
3. zNSDomainToken
4. zNSAddressResolver (Default Resolver)
5. zNSPriceOracle

Zero Layer Security - Zero Admin Control

Zero Admin Control (separate contract, called externally, responsible for any zNS system related access, stuff required to maintain integrity)

Are there operations that need to be maintained by the Zero system and restricted only to admins of our system