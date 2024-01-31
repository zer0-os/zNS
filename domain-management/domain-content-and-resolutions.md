# Domain Content and Resolutions

### Resolution

ZNS domains specify a resolver in as part of their configuration in their `ZNSRegistry`  contract record. The resolver is a module allowing domain names to be mapped to a piece of data. The data in question be a blockchain wallet, a contract address, a GitHub account, a Twitter ID,  and so on. Mapping a domain name in a domain's resolver enables other users and apps to call to `resolveDomainAddress` on a domain's name, and retrieve the resolved information.&#x20;

As an example, a domain's owner could map their domain, _0://john_, to their Ethereum wallet address. This would allow anybody to interact with that user's wallet -- as to transfer tokens, specify mintlist status, and more -- using a readily-parsable name (_0://john_) instead of an esoteric and easily forgotten 42-character hexadecimal address like `0x1F3aB7...`

ZNS domain resolution simplifies the otherwise complicated and decisively user un-friendly process of interacting with foreign hex hashes in lieu of human readable names.

At the moment, ZNS only uses a single type of resolver for addresses. The `ZNSAddressResolver` allows users to bind their domain names to wallet addresses as specified above. There is intent to create additional resolver types in the future to allow users to resolve to different types of information.&#x20;
