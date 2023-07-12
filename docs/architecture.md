# System Architecture

![zNS Smart Contract Connections and Call Routing](./img/full.jpg)


## [ZNSAccessController](./contracts/access/ZNSAccessController.md) and [AccessControlled](./contracts/access/AccessControlled.md)

![Access Control](./img/ac.jpg)

This is the module for access control of the whole ZNS system. Every contract inherits AccessControlled abstract contract that implements:

- `accessController` as a state variable to be present in every child
- a getter for accessController
- a setter declaration for `accessController` to make sure every child contract implements it locally
- an event to fire every time `accessController` is changes in state
- `onlyAdmin` modifier since it is used in most child contracts

Upon inheriting the `AccessControlled` every contract is connected to the overall access control of the system through `ZNSAccessController` address that has to be passed at initialization time in order to prevent non-admin accounts from setting crucial values in storage.

`ZNSAccessController` itself inherits `AccessControl` from Open Zeppelin and adds some specific logic to provide ZNS contracts with necessary functions to limit system access to crucial functions.

### Key responsibilities
- Provide a template for every contract in the system on how to add access control to its logic (via 1)
- Make sure important functions are implemented in children so that accessController variable can not be lost and can be reset on a live system
- Provide constants for all active roles in the system that will be used in production to validate callers
- Provide functionality to set good role structure for system safety
- Provide functionality to set and remove roles from accounts
- Provide easy checking functionality that all contracts using this module can access within their logic

## [ZNSRegistry](./contracts/registry/ZNSRegistry.md)

Key storage contract of the system responsible for basic crucial data about every domain/subdomain registered. The below data is mapped to each domain’s hash in `ZNSRegistry.records`.

- `owner` (address) - owner of a domain. This address is necessary for the system to keep track of owners of domains and to provide secure access to domain management functionality. Only domain owner can modify and control a domain. Can be any arbitrary Ethereum address: smart contract, EOA. In cases when subdomain distribution (or other functionality) is being managed by the arbitrary contract, this contract has to be the owner of the parent domain.
- `resolver` (address) - address of a contract responsible for binding each domain name to a content of a certain type (e.g. ethereum address). For more info see “Resolvers” section.

Every domain registered HAS to settle on this contract with its crucial data (above) written into a mapping keyed by domain name hash (bytes32).

ZNSRegistry also has a mapping of `operators` in its state to manage operators for each owner.

### Key responsibilities
- Serves as the last step of a domain registration process by saving the domain data in its storage
- Official final reference of an existence of a certain domain - we call ZNSRegistry to verify that a new domain being minted has not been minted already
- Is the first step in domain source discovery - we call `ZNSRegistry.getDomainResolver()` to find the Resolver that will tell us what this domain was created for (contract or wallet address, string, metadata hash, etc.). Currently ONLY ZNSAddressResolver is implemented, but more resolvers to come in the future for more data types.
- Reference for crucial domain related data (owner, resolver).
- Provide a way to install operators for any owner to allow them access to changing resolvers without the presence of the owner

## [ZNSDomainToken](./contracts/token/ZNSDomainToken.md)

A single token contract (ERC-721) responsible for tokenizing every domain/subdomain in the system, providing standard token functionality (e.g. transfer, mint, burn, etc.) for the ease of domain management along with ZNS specific functionality added on top of ERC ABI.

### Key responsibilities
- Mint a new token every time a domain is registered atomically within the register transaction (`ZNSRegistrar.register()` -> `ZNSDomainToken.register()`)
- Burn the respective token every time a domain is revoked atomically within the revoke transaction (`ZNSRegistrar.revokeDomain()` -> `ZNSDomainToken.revoke()`)
- Determine and check owner of any given domain token by the tokenId
- Transfer domain token to change the owner
- Serve as a standard ERC-721 token with all the functionality provided, so the token can be traded and managed by other applications

## Resolvers and [ZNSAddressResolver](./contracts/resolver/ZNSAddressResolver.md)
System is expected to have multiple Resolver contracts, each being responsible for resolutions to their own supported types for domain sources. Zero will deploy a certain amount of them to support data types planned (FUTURE) , but these Resolvers can potentially be developed, deployed and managed by any parent domain owner to provide more data type resolutions for their subdomains.

Resolver is structured to be a simple contract, having a mapping of a domain namehash to the specific source type (e.g. `bytes32 => address` OR `bytes32 => bytes`, etc.). Each Resolver can support one data type at a time or can be a combined one, supporting multiple.

The ONLY resolver currently implemented is `ZNSAddressResolver`. It supports only address data type and has a simple mapping of `bytes32 domainHash => address contentAddress`.

### Key responsibilities
- Provide a straightforward binging of a domain namehash to specific domain source data (e.g. `hash(“cooldomainname”) => 0x1bc5d767ff…`)
- Provide a simple and straightforward resolution from a name to domain source
- Provide the way for any DO to change their domain source at any point in time along with simple access control which will not allow anyone else, other than the domain owner, to change this data
- Interface checking logic (ERC-165) to provide easy type checking on supported types for the current Resolver.

## [ZNSPriceOracle](./contracts/distribution/ZNSPriceOracle.md)
Price Oracle contract serves as the trusted source of pricing data and determines prices of domain names based on the predefined formula and length of the domain name. Current implementation includes a formula, all the base values necessary to calculate prices and their setters.

`ZNSPriceOracle` is called by `ZNSTreasury` contract within the operation of staking user funds to register a new domain. Beside the actual pricing, ZNSPriceOracle also provides calculation of the fees based on the price of the domain. Upon determining the price + fee, the data comes back to ZNSTreasury that performs it’s own state writes and withdraws the funds from user’s wallet.

### Key responsibilities
- Provide deterministic formula for domain name price calculations based on the length of the label string
- Provide a way to get a calculated fee value based on the price of the domain
- Provide ways to reconfigure pricing and fees on a live system based on the set of variables through their setters

## [ZNSTreasury](./contracts/distribution/ZNSTreasury.md)
This contract performs staking logic with the help of `ZNSPriceOracle`, which it uses to get pricing and fees for every domain registered. Treasury itself performs the actual stake transfers and stores their amounts mapped by `domainHash`. These amounts are used to unstake upon domain revocation later.

It also moves fees to `zeroVault` address specified by the ZNS Admin along with `stakingToken` which represents any ERC-20 that is chosen to use as the token for domain payments (staking). The original `stakingToken` will be `$ZERO`, but the contract is made to support any other standard ERC-20 token in the future, which can easily be re-set in state.

### Key responsibilities
- Perform actual stake transfers based on the prices and fees acquired from ZNSPriceOracle as a part of the register transaction (locked to ZNSRegistrar only)
- Perform stake withdrawals for users who are removing their domains from ZNS as a part of the revoke transaction (locked to ZNSRegistrar only)
- Store staked amount in state (and possibly token address), tied to the domain hash and not a specific owner to be more adaptable to owner changes without the need to perform extra logic
- Store the address of the ERC-20 staking token and provide ways to re-set it in production
- Store the address of the ZNSPriceOracle contract in order to perform calls to get prices and fees.

## [ZNSRegistrar](./contracts/distribution/ZNSRegistrar.md)
While Registrars in general can have arbitrary distribution logic (e.g. sales, auctions, giveaways, etc.) `ZNSRegistrar` is specifically designed to distribute all Root Domains of ZNS. It will do it through staking logic in conjunctions with other possible SCs.

`ZNSRegistrar` is the entry point to the ZNS system for most main domain operations (register, reclaim, revoke) and is connected to all other contracts besides `ZNSPriceOracle`. It combines multiple operations into atomic transactions and routes the logic inside ZNS to achieve proper results for main domain operations. It also ensures proper sequences in which operations should be performed.

`ZNSRegistrar` is the only contract in the system that has a proper ROLE assigned to it in `ZNSAccessController` to use it as a way to protect other contracts to be called only by the ZNSRegistrar, which protects the data in the system and ensures proper operation execution. Many other contract functions have `onlyRegistrar()` modifiers which make sure that the caller is a contract with REGISTRAR_ROLE.

### Key responsibilities
- Store all system crucial modules (beside ZNSPriceOracle) in state to be able to call required contracts for any flow.
- Provide the main function for registering Root Domains, make sure that operations, especially ones using other contracts are performed properly and in proper sequence. Combine logic of other contracts in one atomic transaction. Check name existence, take the stake from the user, mint a domain token, set the data in ZNSRegistry.
- Provide the main function for reclaiming full domain ownership for owners of the specific Domain Token. Ensure that ONLY the owner of the actual token (tokenId) can do this, call ZNSRegistry to update the owner in records.
- Provide the main function for revoking domains. Make sure that the only address allowed to do that is both: owner of the Name and owner of the Token. Call ZNSRegistry to delete record, call ZNSDomainToken to burn the token, call ZNSTreasury to unstake.