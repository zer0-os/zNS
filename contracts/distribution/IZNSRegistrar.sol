// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


interface IZNSRegistrar {

    /**
     * @notice Emitted when a NEW domain is registered.
     * @param domainHash The hash of the domain registered
     * @param tokenId The tokenId of the domain registered
     * @param name The name as string of the domain registered
     * @param registrant The address that called {ZNSRegistrar.registerDomain()}
     * @param resolver The resolver contract address of the domain registered
     * @param domainAddress The domain address of the domain registered - the address
     * to which a domain name will relate to in ZNS. E.g. if a user made a domain for his wallet,
     * the address of the wallet will be the `domainAddress`. This can be 0 as this variable is not required
     * to perform registration process and can be set at a later time by the domain owner.
     */
    event DomainRegistered(
        bytes32 indexed domainHash,
        uint256 indexed tokenId,
        string name,
        address indexed registrant,
        address resolver,
        address domainAddress
    );

    /**
     * @notice Emitted when a domain is revoked.
     * @param domainHash The hash of the domain revoked
     * @param registrant The address that called {ZNSRegistrar.revokeDomain()}
     */
    event DomainRevoked(bytes32 indexed domainHash, address indexed registrant);

    /**
     * @notice Emitted when an ownership of the Name is reclaimed by the Token owner.
     * @param domainHash The hash of the domain reclaimed
     * @param registrant The address that called {ZNSRegistrar.reclaimDomain()}
     */
    event DomainReclaimed(
        bytes32 indexed domainHash,
        address indexed registrant
    );

    /**
     * @notice Emitted when the `registry` address is set in state.
     * @param registry The new address of the registry contract
     */
    event RegistrySet(address registry);

    /**
     * @notice Emitted when the `treasury` address is set in state.
     * @param treasury The new address of the treasury contract
     */
    event TreasurySet(address treasury);

    /**
     * @notice Emitted when the `domainToken` address is set in state.
     * @param domainToken The new address of the domainToken contract
     */
    event DomainTokenSet(address domainToken);

    /**
     * @notice Emitted when the `addressResolver` address is set in state.
     * @param addressResolver The new address of the addressResolver contract
     */
    event AddressResolverSet(address addressResolver);

    function registerDomain(
        string calldata name,
        address resolverContent
    ) external returns (bytes32);

    function revokeDomain(bytes32 domainHash) external;

    function reclaimDomain(bytes32 domainHash) external;

    function setRegistry(address registry_) external;

    function setTreasury(address treasury_) external;

    function setDomainToken(address domainToken_) external;

    function setAddressResolver(address addressResolver_) external;

    function setAccessController(address accessController_) external;

    function getAccessController() external view returns (address);

    function initialize(
        address accessController_,
        address registry_,
        address treasury_,
        address domainToken_,
        address addressResolver_
    ) external;
}
