// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IDistributionConfig } from "../types/IDistributionConfig.sol";
import { PaymentConfig } from "../treasury/IZNSTreasury.sol";


/**
 * @notice Stake fee is 0x0 for anything other than subdomain under a parent with Stake Payment
 * parent hash will be 0x0 for root domain
 */
    struct CoreRegisterArgs {
        bytes32 parentHash;
        bytes32 domainHash;
        address registrant;
        address domainAddress;
        uint256 price;
        uint256 stakeFee;
        string label;
        string tokenURI;
        bool isStakePayment;
        PaymentConfig paymentConfig;
    }


interface IZNSRootRegistrarTypes is IDistributionConfig {
    error NotTheOwnerOf(
        OwnerOf ownerOf,
        address candidate,
        bytes32 domainHash
    );

    error InvalidOwnerOfEnumValue(OwnerOf value);

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
     * @param label The name as the last part of the full domain string (level) registered
     * @param domainHash The hash of the domain registered
     * @param tokenId The tokenId of the domain registered
     * @param tokenURI The tokenURI of the domain registered
     * @param registrant The address that called `ZNSRootRegistrar.registerRootDomain()`
     * @param domainAddress The domain address of the domain registered
     */
    // TODO multi: make parentHash indexed instead of tokenId !!!
    event DomainRegistered(
        bytes32 parentHash,
        bytes32 indexed domainHash,
        string label,
        uint256 indexed tokenId,
        string tokenURI,
        address indexed registrant,
        address domainAddress
    );

    /**
     * @notice Emitted when a domain is revoked.
     * @param domainHash The hash of the domain revoked
     * @param owner The address that called `ZNSRootRegistrar.sol.revokeDomain()` and domain owner
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
     * @param registrant The address that called `ZNSRootRegistrar.sol.reclaimDomain()`
     */
    event DomainReclaimed(
        bytes32 indexed domainHash,
        address indexed registrant
    );

    /**
     * @notice Emitted when the `rootPricer` address is set in state.
     * @param rootPricer The new address of any IZNSPricer type contract
     */
    event RootPricerSet(address rootPricer);

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
     * @notice Emitted when the `subRegistrar` address is set in state.
     * @param subRegistrar The new address of the SubRegistrar contract
     */
    event SubRegistrarSet(address subRegistrar);
}
