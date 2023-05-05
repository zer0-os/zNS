** Access Control Spike **

Reference Code https://github.com/zer0-os/zNS/pull/18/

Goal: Identify an appropriate level of access control for zNS administration and its consumers for the current suite of functionality. This does not include subdomain minting.  

This analysis assumes a few guiding architecture principles of zNS
1. Maximize User Ownership:  Operations on entities within zNS are owned (and also the responsibility of) the user. 
2. Open: Inspection of code yields confidence that these are the building blocks of a decentralized system to associate a domain with any type of content.  This means Zero Administrator access should be limited to operations required to maintain integrity of the system for all users. 

** Operations Analysis: **
Below are access level security recommendations and associated thoughts for zNS MVP operations for today's (5/5/2023) implementation for zNS. 
* nosec = no access control security needed. 
* sec = access control recommended, will be followed by a list of roles

1. zNSEthRegistrar (TLD/Subdomain Registrar)
2. zNSRegistry - Creates new domain records and sets owner(s) and resolver. Controls modification of those records. Allows for querying of zNS domains and their operators by owner.
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
3. zNSDomainToken
4. zNSAddressResolver (Default Resolver)
    * supportsInterface - nosec
    * getAddress - nosec
    * setAddress - sec - owner only
5. zNSPriceOracle
    * getPrice - nosec
    * setBasePrice - sec operator and owner 
    * setPriceMultiplier - sec - operator and owner
    * setBaseLength - sec - operator and owner
    * setBaseLengths (set default price length for domains and subdomains) - sec operator and owner
        * RFC should default be able to change on subdomains, following principle of democratic user control, up to them
        * perhaps should allow for a configuration to be set on subdomain systems
    * setZNSRegistrar ()
    * Summary: Zero admin should only have control over initalization/upgradeability based on our principles, everything else can be owner


**Analysis**:
This analysis presumes 3 roles of access - Owner, Operator, and Zero Admin. A Zero admin may be an account or another smart contract. Operators are controlled by the owner and can perform a subset of domain management operations. 

zNSPriceOracle - All price setting operation access can be limited to owners & operators. Zero Admin control can be limited to upgradeability, if there is a need to maintain registrar mappings in the price oracle then it may be appropriate for ZAC to assign those mappings


zNSAddressResolver - Resolution of zNS name to a system (setting the contract that acts as the resolver) is data that should be the sole propriety of the owner. This is a key relationship of zNS, and answers (in what way does this domain name have meaning? E.g. is it tied to another system of SCs or is it just a name)
zNSRegistry - Modification of records


zNSRegistry - Similar to the address resolver operations that require access control are 

Recommendations: Access Control by Zero should be limited to the cases where the user is minting a domain under default contracts that provide some base level of utility in our ecosystem. E.g. Zero Access Control can set a domains resolver to the default if no custom resolver is provided. One these defaults are overriden by the owner. zNS has no access to revoke.

While zNS matures and is in development I can propose two potential paths for admin level access

Option 2:
 Zero maintains rights to upgradeability over contracts until such a time that Zero Access control decisions are made via DAO or some other multisig. This may provide some assurances to the userbase about our commitment to a decentralized, democratic system, but in reality we are only obscuring centralization that is still there.

Option 2:
 Zero does all of the above, but an ADMIN role is provided access to manage state variables of our default contracts and TLD registries. This will make iterating on technical upgrades far more efficient at the cost of appearing less decentralized. 
 




Domain Operators
Resolver Maintainers

Role based needs & recommendations
* Replace concept of owner with operators: Default to minter as sole operator but with the option for multiple operators to be set at creation
* Authorization to Associate Domain -> Non Default Resolver Contract:
    * ZNS users could register custom resolvers and resolver maintainers in a ZNS contract, where access to ops can be defined: ResolverRegistrar
    * Does zns guarantee resolvers are protected from bad actors?