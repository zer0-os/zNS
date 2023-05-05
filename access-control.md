**Access Control Investigation**

Reference Code https://github.com/zer0-os/zNS/pull/18/

**Goal**
Identify optimal access control strategies for zNS administratators and consumers for the current suite of functionality. (Subdomains excluded)


**Abstract** 


This analysis assumes a few guiding architecture principles of zNS.

1. Maximize User Ownership:  Operations on entities within zNS are owned (and also the responsibility of) the user. 
2. Open: Inspection of code yields confidence that these are the building blocks of a decentralized system to associate a domain with any type of content.  This means Zero Administrator access should be limited to operations required to maintain integrity of the system for all users. 

The analysis here presumes the 3 roles of access defined in the reference code - Owner, Operator, and Zero Admin. A Zero admin may be an account or another smart contract. Operators are controlled by the owner and can perform a subset of domain management operations. 

**Operations Analysis**


Below are access level security recommendations and associated thoughts for zNS MVP operations for today's (5/5/2023) implementation for zNS. 

Key
* nosec = no access control security needed. 
* sec = access control recommended, will be followed by a list of roles

1. zNSRegistry - Creates new domain records and sets owner(s) and resolver. Controls modification of those records. Allows for querying of zNS domains and their operators by owner.
    * exists - nosec
    * isAllowedOperator - nosec,
    * getDomainRecord -nosec
    * setDomainRecord - sec - Admin (create)/operator(modify/create)
        * Admin can initialize a domain with defaults 
        * Operators are set on creation, with a sole operator defaulting to owner, but with the option to define multiple operators
        * modification of TLDs can be done via individual functions or with different require checks within this function
    * setOwner - sec - operator only
        * setOwner becomes -> clearOperatorsAndSend, requires multisig majority 
    * setResolver - sec - owner only, but should default to address resolver, imo address resolver should be required so that ownership is tied to Ethereum
2. zNSDomainToken -
    * TODO Will the ZNSDomainToken be the addressOf (resolver system) for all inital zNS mvps?
    * register - sec, zero admin (where admin is ZNSRegistry)
    * revoke - sec, zero admin (where admin is ZNSRegistry), provide method in registry to initiate revoke process
3. zNSAddressResolver (Default Resolver)
    * supportsInterface - nosec
    * getAddress - nosec
    * setAddress - sec - owner only
4. zNSPriceOracle
    * getPrice - nosec
    * setBasePrice - sec operator and owner 
    * setPriceMultiplier - sec - operator and owner
    * setBaseLength - sec - operator and owner
    * setBaseLengths (set default price length for domains and subdomains) - sec operator and owner
        * RFC should default be able to change on subdomains, following principle of democratic user control, up to them
        * perhaps should allow for a configuration to be set on subdomain systems
    * setZNSRegistrar ()
    * Summary: Zero admin should only have control over initalization/upgradeability based on our principles, everything else can be owner

**Conclusions and Recommendations**:


zNSPriceOracle - All price setting operation access can be limited to owners & operators. If there is a need to maintain registrar mappings in the price oracle then it may be appropriate for ZAC to assign those mappings. Monetary operations to guarantee revenue of Zero system (e.g. royalties) should be hardcoded and immutable (or at a minimum separate operations controlled by Zero Admins)


zNSAddressResolver - Resolution of zNS name to a system (setting the contract that acts as the resolver) is data that should be the sole propriety of the owner, or with the understanding that operators are given full trust of a zNS domain. This is a key relationship of zNS, and answers: in what way does this domain name have meaning within ethereum? E.g. is it tied to another system of SCs or is it just a name. 


zNSRegistry - Similar to zNS Address resolver,modification of records and resolvers require such a high degree of trust that a decision needs to be made on what the purview of operators should be. (See aside on operators and owners for recommendations)


zNSDomainToken - Because this contract appears to exist as a way to separate minting/revoke concerns from the registry itself, these contracts can be be maintained by the Zero Admin Role. The zNSRegistry contract should be the primary admin in this scenario


**Recommendations on Operators and Owners:**


The analysis of the above contracts suggests that nearly every operation (e.g. manipulating price, defining resolvers) granted to an operator in zNS MVP requires such a high degree of trust to the point that operators might as well be owners from a domain operability perspective.


In tandem with our principle of high user responsibility, I recommend we allow operators to perform any operation with the exception of minting, changing domain ownership, and managing operators. This allows operators full bandwidth to help manage a system, but with owners always have the capability to recover from a breach of trust


Another possible route, which might simplify AC but add complexity elsewhere is to simply allow for multiple owners, and remove the operator role entirely.

**Zero Administrator Access Recommendations**


Access Control by Zero should be limited to the cases where the user is minting a domain under default contracts that provide some base level of utility in our ecosystem. E.g. Zero Access Control can set a domains resolver to the default if no custom resolver is provided. One these defaults are overriden by the owner. zNS has no access to revoke.


While the zNS MVP matures and is in development I can propose two potential paths for admin level access.


Option 1:
 Zero maintains rights to upgradeability over contracts until such a time that Zero Access control decisions are made via DAO or some other multisig. This may provide some assurances to the userbase about our commitment to a decentralized, democratic system, but in reality we are only obscuring centralization that is still there.

Option 2:
 Zero does all of the above, but an ADMIN role is provided access to manage state variables of our default contracts and TLD registries. This will make iterating on technical upgrades far more efficient at the cost of appearing less decentralized. 
 
