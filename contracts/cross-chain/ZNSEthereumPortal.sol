// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";
import { IZNSEthereumPortal } from "./IZNSEthereumPortal.sol";
import { IPolygonZkEVMBridgeV2Ext } from "./IPolygonZkEVMBridgeV2Ext.sol";
import { ZeroAddressPassed } from "../utils/CommonErrors.sol";
import { BridgedDomain } from "../types/CrossChainTypes.sol";
import { IZNSRootRegistrar } from "../registrar/IZNSRootRegistrar.sol";
import { IZNSSubRegistrar } from "../registrar/IZNSSubRegistrar.sol";
import { IZNSRegistry } from "../registry/IZNSRegistry.sol";
import { IZNSDomainToken } from "../token/IZNSDomainToken.sol";
import { PaymentConfig } from "../treasury/IZNSTreasury.sol";
import { IZNSPricer } from "../types/IZNSPricer.sol";


// TODO multi: could this be a better name that implies cross-chain nature ???
contract ZNSEthereumPortal is UUPSUpgradeable, AAccessControlled, IZNSEthereumPortal {
    // *--| Cross-chain Data |--*
    // TODO multi: should we keep this extended interface ???
    IPolygonZkEVMBridgeV2Ext public polygonZkEVMBridge;
    // This chain
    uint32 public networkId;
    //  figure out better names for these vars !!!
    address public srcZnsPortal;

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
        address srcZnsPortal_,
        IZNSRootRegistrar rootRegistrar_,
        IZNSSubRegistrar subRegistrar_,
        IZNSDomainToken domainToken_,
        IZNSRegistry registry_
    ) external override initializer {
        _setAccessController(accessController_);

        if (
            address(zkEvmBridge_) == address(0)
            || srcZnsPortal_ == address(0)
            || address(rootRegistrar_) == address(0)
            || address(subRegistrar_) == address(0)
            || address(domainToken_) == address(0)
            || address(registry_) == address(0)
        ) revert ZeroAddressPassed();

        polygonZkEVMBridge = zkEvmBridge_;
        networkId = polygonZkEVMBridge.networkID();
        srcZnsPortal = srcZnsPortal_;
        rootRegistrar = rootRegistrar_;
        subRegistrar = subRegistrar_;
        domainToken = domainToken_;
        registry = registry_;
    }

    function onMessageReceived(
        address originAddress,
        uint32 originNetwork,
        bytes memory data
    ) external payable override {
        if (msg.sender != address(polygonZkEVMBridge)) revert InvalidCaller(msg.sender);
        if (originAddress != srcZnsPortal) revert InvalidOriginAddress(originAddress);

        BridgedDomain memory proof = abi.decode(data, (BridgedDomain));

        // Register bridged domain
        bytes32 domainHash;
        if (proof.parentHash == bytes32(0)) {
            domainHash = rootRegistrar.registerBridgedRootDomain(
                proof.label,
                proof.tokenUri
            );
        } else {
            domainHash = subRegistrar.registerBridgedSubdomain(
                proof.parentHash,
                proof.label,
                proof.tokenUri
            );
        }

        // Validate that we bridged a proper domain
        if (domainHash != proof.domainHash)
            revert DomainHashDoesNotMatchBridged(proof.domainHash, domainHash);

        // TODO multi: remove registry owner change if merged after DomainToken transfer changes!
        //  this should be done automatically by transferring the token!
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

    function setSrcZnsPortal(address newAddress) external onlyAdmin {
        if (newAddress == address(0)) revert ZeroAddressPassed();

        srcZnsPortal = newAddress;

        emit SrcZnsPortalSet(newAddress);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
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
