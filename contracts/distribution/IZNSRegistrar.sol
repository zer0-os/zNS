// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IDistributionConfig } from "./subdomains/IDistributionConfig.sol";
import { AZNSPricing } from "./subdomains/abstractions/AZNSPricing.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


struct CoreRegisterArgs {
    // 0x0 for root domains
    bytes32 parentHash;
    bytes32 domainHash;
    string label;
    address registrant;
    uint256 price;
    // 0x0 for anything other than subdomain under a parent with Stake Payment
    uint256 stakeFee;
    address domainAddress;
    bool isStakePayment;
}

interface IZNSRegistrar is IDistributionConfig {

    enum OwnerOf {
        NAME,
        TOKEN,
        BOTH
    }

    /**
     * @notice Emitted when a NEW domain is registered.
     * @dev `domainAddress` parameter is the address to which a domain name will relate to in ZNS.
     * E.g. if a user made a domain for his wallet, the address of the wallet will be the `domainAddress`.
     * This can be 0 as this variable is not required to perform registration process
     * and can be set at a later time by the domain owner.
     * @param parentHash The hash of the parent domain (0x0 for root domains)
     * @param domainHash The hash of the domain registered
     * @param tokenId The tokenId of the domain registered
     * @param name The name as string of the domain registered
     * @param registrant The address that called `ZNSRegistrar.registerDomain()`
     * @param domainAddress The domain address of the domain registered
     */
    event DomainRegistered(
        bytes32 parentHash,
        bytes32 indexed domainHash,
        uint256 indexed tokenId,
        string name,
        address indexed registrant,
        address domainAddress
    );

    /**
     * @notice Emitted when a domain is revoked.
     * @param domainHash The hash of the domain revoked
     * @param owner The address that called `ZNSRegistrar.revokeDomain()` and domain owner
     * @param stakeRefunded A flag for whether the stake was refunded or not
     */
    event DomainRevoked(
        bytes32 indexed domainHash,
        address indexed owner,
        bool indexed stakeRefunded
    );

    /**
     * @notice Emitted when an ownership of the Name is reclaimed by the Token owner.
     * @param domainHash The hash of the domain reclaimed
     * @param registrant The address that called `ZNSRegistrar.reclaimDomain()`
     */
    event DomainReclaimed(
        bytes32 indexed domainHash,
        address indexed registrant
    );

    /**
     * @notice Emitted when the `priceOracle` address is set in state.
     * @param priceOracle The new address of the PriceOracle contract
     */
    event PriceOracleSet(address priceOracle);

    /**
     * @notice Emitted when the `treasury` address is set in state.
     * @param treasury The new address of the Treasury contract
     */
    event TreasurySet(address treasury);

    /**
     * @notice Emitted when the `domainToken` address is set in state.
     * @param domainToken The new address of the DomainToken contract
     */
    event DomainTokenSet(address domainToken);

    /**
     * @notice Emitted when the `subdomainRegistrar` address is set in state.
     * @param subdomainRegistrar The new address of the SubdomainRegistrar contract
     */
    event SubdomainRegistrarSet(address subdomainRegistrar);

    /**
     * @notice Emitted when the `addressResolver` address is set in state.
     * @param addressResolver The new address of the AddressResolver contract
     */
    event AddressResolverSet(address addressResolver);

    function initialize(
        address accessController_,
        address registry_,
        address priceOracle_,
        address treasury_,
        address domainToken_,
        address addressResolver_
    ) external;

    function registerDomain(
        string calldata name,
        address domainAddress,
        DistributionConfig calldata distributionConfig
    ) external returns (bytes32);

    function coreRegister(
        CoreRegisterArgs memory args
    ) external;

    function coreRevoke(bytes32 domainHash, address owner) external;

    function revokeDomain(bytes32 domainHash) external;

    function reclaimDomain(bytes32 domainHash) external;

    function isOwnerOf(bytes32 domainHash, address candidate, OwnerOf ownerOf) external view returns (bool);

    function setRegistry(address registry_) external;

    function setPriceOracle(address priceOracle_) external;

    function setTreasury(address treasury_) external;

    function setDomainToken(address domainToken_) external;

    function setSubdomainRegistrar(address subdomainRegistrar_) external;

    function setAddressResolver(address addressResolver_) external;

    function setAccessController(address accessController_) external;

    function getAccessController() external view returns (address);
}
