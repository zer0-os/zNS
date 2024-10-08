// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";
import { IPolygonZkEVMBridgeV2Ext } from "./IPolygonZkEVMBridgeV2Ext.sol";
import { ZeroAddressPassed } from "../utils/CommonErrors.sol";
import { RegistrationProof } from "../types/CrossChainTypes.sol";
import { IZNSRootRegistrar } from "../registrar/IZNSRootRegistrar.sol";
import { IZNSSubRegistrar } from "../registrar/IZNSSubRegistrar.sol";
import { IZNSRegistry } from "../registry/IZNSRegistry.sol";
import { IZNSDomainToken } from "../token/IZNSDomainToken.sol";
import { IDistributionConfig } from "../types/IDistributionConfig.sol";
import { PaymentConfig } from "../treasury/IZNSTreasury.sol";
import { IZNSPricer } from "../types/IZNSPricer.sol";


// TODO multi: could this be a better name that implies cross-chain nature ???
contract ZNSEthereumPortal is UUPSUpgradeable, AAccessControlled, IDistributionConfig {

    event DomainClaimed(
        uint32 indexed srcNetworkId,
        address srcPortalAddress,
        bytes32 indexed domainHash,
        address indexed domainOwner
    );
    event L2PortalAddressSet(address newAddress);

    // TODO multi: can this be better and have smth like NotPolygonBridge ???
    error CalledByInvalidContract(address caller);
    error DomainHashDoesNotMatchBridged(bytes32 bridgedHashL1, bytes32 generatedHashL2);

    // TODO multi: check that all state vars are needed and remove redundant ones !!!
    // *--| Cross-chain Data |--*
    IPolygonZkEVMBridgeV2Ext public polygonZkEVMBridge;
    // This chain
    uint32 public networkId;
    // TODO multi: should this be an Interface Var ???
    address public znsZkEvmPortalL1;

    // *--| ZNS Data for THIS chain |--*
    IZNSRootRegistrar public rootRegistrar;
    IZNSSubRegistrar public subRegistrar;
    IZNSDomainToken public domainToken;
    IZNSRegistry public registry;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address accessController_,
        IPolygonZkEVMBridgeV2Ext zkEvmBridge_,
        address znsZkEvmPortalL1_,
        IZNSRootRegistrar rootRegistrar_,
        IZNSSubRegistrar subRegistrar_,
        IZNSDomainToken domainToken_,
        IZNSRegistry registry_
    ) external initializer {
        _setAccessController(accessController_);

        if (
            address(zkEvmBridge_) == address(0)
            || znsZkEvmPortalL1_ == address(0)
            || address(rootRegistrar_) == address(0)
            || address(subRegistrar_) == address(0)
            || address(domainToken_) == address(0)
            || address(registry_) == address(0)
        ) revert ZeroAddressPassed();

        polygonZkEVMBridge = zkEvmBridge_;
        networkId = polygonZkEVMBridge.networkID();
        znsZkEvmPortalL1 = znsZkEvmPortalL1_;
        rootRegistrar = rootRegistrar_;
        subRegistrar = subRegistrar_;
        domainToken = domainToken_;
        registry = registry_;
    }

    function onMessageReceived(
        address originAddress,
        uint32 originNetwork,
        bytes memory data
    ) external payable {
        if (msg.sender == address(polygonZkEVMBridge)) revert CalledByInvalidContract(msg.sender);

        RegistrationProof memory proof = abi.decode(data, (RegistrationProof));

        DistributionConfig memory emptyDistrConfig;
        PaymentConfig memory emptyPaymentConfig;

        // Register bridged domain
        bytes32 domainHash;
        if (proof.parentHash == bytes32(0)) {
            domainHash = rootRegistrar.registerBridgedRootDomain(
                proof.label,
                proof.tokenUri
            );
        } else {
            // TODO multi: think on how to best make this work when the parent is not present
            //  on this chain and the checks for it will fail
            //  maybe make a new function specifically to be registered from here ONLY ???
            domainHash = subRegistrar.registerSubdomain(
                proof.parentHash,
                proof.label,
                address(0),
                proof.tokenUri,
                emptyDistrConfig,
                emptyPaymentConfig
            );
        }

        // Validate that we bridged a proper domain
        if (domainHash != proof.domainHash)
            revert DomainHashDoesNotMatchBridged(proof.domainHash, domainHash);

        // Transfer domain ownership to the address of registrant on L1
        registry.updateDomainOwner(
            proof.domainHash,
            proof.domainOwner
        );
        // Transfer the token
        domainToken.transferFrom(
            address(this),
            proof.domainOwner,
            uint256(proof.domainHash)
        );

        emit DomainClaimed(
            originNetwork,
            originAddress,
            proof.domainHash,
            proof.domainOwner
        );
    }

    function setL2PortalAddress(address newAddress) external onlyAdmin {
        if (newAddress == address(0)) revert ZeroAddressPassed();

        znsZkEvmPortalL1 = newAddress;

        emit L2PortalAddressSet(newAddress);
    }

    /**
     * @notice To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized
     * @param newImplementation The implementation contract to upgrade to
     */
    // solhint-disable-next-line
    function _authorizeUpgrade(address newImplementation) internal view override {
        accessController.checkGovernor(msg.sender);
    }
}
