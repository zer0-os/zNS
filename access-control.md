Operations Overview (subdomain ops are exempted)

High Level Operations

zNSRegistry

zNSDomainToken

zNSAddressResolver (zNS Default Resolver?)

zNS TLD Registrar/SubdomainRegistrar (ZNSEthRegistrar)
* mint new domains
* Update name storage of zNSRegistry (TLD only?)

zNSPriceOracle

Reference Code 

Goal: Identify internal operations and assign them sec, no sec
Identify admin only operations
Identify operations of specific users
Identify operations needed to maintain a subset of the system

Internal Operations
1. zNSEthRegistrar (TLD/Subdomain Registrar)
2. zNSRegistry
3. zNSDomainToken
4. zNSAddressResolver (Default Resolver)
5. zNSPriceOracle

Cross-Contract Operations
1. zNSEthRegistrar (TLD/Subdomain Registrar)
2. zNSRegistry
3. zNSDomainToken
4. zNSAddressResolver (Default Resolver)
5. zNSPriceOracle



Zero Admin Control (separate contract, called externally, responsible for any zNS system related access, stuff required to maintain integrity)

Are there operations that need to be maintained by the Zero system and restricted only to admins of our system