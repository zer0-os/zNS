// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IPolygonZkEVMBridgeV2 } from "@zero-tech/zkevm-contracts/contracts/v2/interfaces/IPolygonZkEVMBridgeV2.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";
import { IZNSZChainPortal } from "./IZNSZChainPortal.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IZNSChainResolver } from "../resolver/IZNSChainResolver.sol";
import { IZNSPricer } from "../types/IZNSPricer.sol";
import { IZNSRegistry } from "../registry/IZNSRegistry.sol";
import { IZNSRootRegistrarTrunk } from "../registrar/IZNSRootRegistrarTrunk.sol";
import { IZNSSubRegistrar } from "../registrar/IZNSSubRegistrar.sol";
import { IZNSTreasury } from "../treasury/IZNSTreasury.sol";
import { PaymentConfig } from "../treasury/IZNSTreasury.sol";
import { BridgedDomain } from "../types/CrossChainTypes.sol";
import { ZeroAddressPassed } from "../utils/CommonErrors.sol";


// TODO multi: can we make it work on ALL chain under ZkEVM ??? make contract more general ???
contract ZNSZChainPortal is UUPSUpgradeable, AAccessControlled, IZNSZChainPortal {
    // *--| Cross-chain Data |--*
    IPolygonZkEVMBridgeV2 public polygonZkEVMBridge;
    // Destination chain (L2)
    uint32 public destNetworkId;
    string public destChainName;
    uint256 public destChainId;
    address public destZnsPortal;

    // *--| ZNS Data for THIS chain |--*
    IZNSRootRegistrarTrunk public rootRegistrar;
    IZNSSubRegistrar public subRegistrar;
    IZNSTreasury public treasury;
    IZNSChainResolver public chainResolver;
    IZNSRegistry public registry;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        uint32 destNetworkId_,
        string calldata destChainName_,
        uint256 destChainId_,
        IPolygonZkEVMBridgeV2 zkEvmBridge_,
        ZNSContractInput calldata znsContracts
    ) external override initializer {
        _setAccessController(address(znsContracts.accessController));

        if (
            address(zkEvmBridge_) == address(0)
            || address(znsContracts.rootRegistrar) == address(0)
            || address(znsContracts.subRegistrar) == address(0)
            || address(znsContracts.treasury) == address(0)
            || address(znsContracts.chainResolver) == address(0)
            || address(znsContracts.registry) == address(0)
        ) revert ZeroAddressPassed();

        polygonZkEVMBridge = zkEvmBridge_;
        destNetworkId = destNetworkId_;
        destChainName = destChainName_;
        destChainId = destChainId_;
        rootRegistrar = znsContracts.rootRegistrar;
        subRegistrar = znsContracts.subRegistrar;
        treasury = znsContracts.treasury;
        chainResolver = znsContracts.chainResolver;
        registry = znsContracts.registry;
    }

    function registerAndBridgeDomain(
        bytes32 parentHash,
        string calldata label,
        string calldata tokenURI
//      bool forceUpdateGlobalExitRoot  - do we need to pass this ???
    ) external override {
        DistributionConfig memory emptyDistrConfig;
        PaymentConfig memory emptyPaymentConfig;

        _processPayment(label, parentHash);

        // Register domain
        bytes32 domainHash;
        if (parentHash == bytes32(0)) { // 0x0 parent for root domains
            domainHash = rootRegistrar.registerRootDomain(
                label,
                address(0),
                tokenURI,
                emptyDistrConfig,
                emptyPaymentConfig
            );
        } else {
            domainHash = subRegistrar.registerSubdomain(
                parentHash,
                label,
                address(0),
                tokenURI,
                emptyDistrConfig,
                emptyPaymentConfig
            );
        }

        // TODO multi: analyze how to make these strings better !!!
        registry.updateDomainResolver(domainHash, "chain");
        // TODO multi: iron out what should go to ChainResolver data !!!
        chainResolver.setChainData(
            domainHash,
            destChainId,
            destChainName,
            address(0),
            ""
        );

        // Bridge domain
        _bridgeDomain(
            domainHash,
            parentHash,
            label,
            tokenURI
        );
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function setDestZnsPortal(address newAddress) external override onlyAdmin {
        if (newAddress == address(0)) revert ZeroAddressPassed();

        destZnsPortal = newAddress;

        emit DestZnsPortalSet(newAddress);
    }

    function _processPayment(
        string calldata label,
        bytes32 parentHash
    ) internal {
        // TODO multi: do we actually want to stake on BOTH sides? What other payment option can we do ???!!!
        // TODO multi: if we leave this option (stake as Portal address) this needs to be optimized!!!
        // take payment to this contract so it can register

        uint256 price;
        uint256 stakeFee;
        IZNSPricer rootPricer = rootRegistrar.rootPricer();
        if (parentHash == bytes32(0)) { // Root Domains
            price = rootPricer.getPrice(
                parentHash,
                label,
                true
            );
        } else { // Subdomains
            (IZNSPricer pricer, PaymentType paymentType,) = subRegistrar.distrConfigs(parentHash);
            (price, stakeFee) = pricer.getPriceAndFee(
                parentHash,
                label,
                true
            );
            stakeFee = paymentType == PaymentType.STAKE ? stakeFee : 0;
        }

        uint256 protocolFee = rootPricer.getFeeForPrice(bytes32(0), price + stakeFee);
        uint256 totalCost = price + stakeFee + protocolFee;

        ( IERC20 paymentToken, ) = treasury.paymentConfigs(parentHash);
        paymentToken.transferFrom(msg.sender, address(this), totalCost);

        paymentToken.approve(address(treasury), totalCost);
    }

    function _bridgeDomain(
        bytes32 domainHash,
        bytes32 parentHash,
        string calldata label,
        string calldata tokenURI
    ) internal {
        // Create data proof for ZNS on L2
        // we are using msg.sender here because the current caller on L1 will be the owner of the bridged L2 domain
        BridgedDomain memory proof = BridgedDomain({
            domainOwner: msg.sender,
            domainHash: domainHash,
            parentHash: parentHash,
            label: label,
            tokenUri: tokenURI
        });

        bytes memory encodedProof = abi.encode(proof);

        polygonZkEVMBridge.bridgeMessage(
            destNetworkId,
            destZnsPortal,
            // TODO multi: figure out what this is and how to better pass it !!!
            true,
            encodedProof
        );

        emit DomainBridged(
            destNetworkId,
            destZnsPortal,
            domainHash,
            msg.sender
        );
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
