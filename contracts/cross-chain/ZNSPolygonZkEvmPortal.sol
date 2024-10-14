// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IPolygonZkEVMBridgeV2 } from "@zero-tech/zkevm-contracts/contracts/v2/interfaces/IPolygonZkEVMBridgeV2.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";
import { IZNSPolygonZkEvmPortal } from "./IZNSPolygonZkEvmPortal.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IZNSChainResolver } from "../resolver/IZNSChainResolver.sol";
import { IZNSPricer } from "../types/IZNSPricer.sol";
import { IZNSRegistry } from "../registry/IZNSRegistry.sol";
import { IZNSRootRegistrar } from "../registrar/IZNSRootRegistrar.sol";
import { IZNSSubRegistrar } from "../registrar/IZNSSubRegistrar.sol";
import { IZNSTreasury } from "../treasury/IZNSTreasury.sol";
import { PaymentConfig } from "../treasury/IZNSTreasury.sol";
import { BridgedDomain } from "../types/CrossChainTypes.sol";
import { ZeroAddressPassed } from "../utils/CommonErrors.sol";


// TODO multi: should this be ZChainPortal as in chain specific contract?
//  it should ideally work with any ZkEVM chain. why not? we should add networkId and other
//  chain specific data to as parameters to some functions ???
contract ZNSPolygonZkEvmPortal is UUPSUpgradeable, AAccessControlled, IZNSPolygonZkEvmPortal {
    // *--| Cross-chain Data |--*
    IPolygonZkEVMBridgeV2 public polygonZkEVMBridge;
    // Destination chain (L2)
    uint32 public networkIdL2;
    // TODO multi: change to interface type (possibly!)
    address public znsEthPortalL2;

    // *--| ZNS Data for THIS chain |--*
    IZNSRootRegistrar public rootRegistrar;
    IZNSSubRegistrar public subRegistrar;
    IZNSTreasury public treasury;
    IZNSChainResolver public chainResolver;
    IZNSRegistry public registry;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address accessController_,
        uint32 networkIdL2_,
        IPolygonZkEVMBridgeV2 zkEvmBridge_,
        IZNSRootRegistrar rootRegistrar_,
        IZNSSubRegistrar subRegistrar_,
        IZNSTreasury treasury_,
        IZNSChainResolver chainResolver_,
        IZNSRegistry registry_
    ) external override initializer {
        _setAccessController(accessController_);

        if (
            address(zkEvmBridge_) == address(0)
            || address(rootRegistrar_) == address(0)
            || address(subRegistrar_) == address(0)
            || address(treasury_) == address(0)
            || address(chainResolver_) == address(0)
            || address(registry_) == address(0)
        ) revert ZeroAddressPassed();

        polygonZkEVMBridge = zkEvmBridge_;
        networkIdL2 = networkIdL2_;
        rootRegistrar = rootRegistrar_;
        subRegistrar = subRegistrar_;
        treasury = treasury_;
        chainResolver = chainResolver_;
        registry = registry_;
    }

    function registerAndBridgeDomain(
        bytes32 parentHash,
        string calldata label,
        string calldata tokenURI,
        uint32 destinationChainId,
        // TODO multi: do we actually have to pass it here ?? do we support 1 chain in this portal only ???
        string calldata destinationChainName
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
            destinationChainId,
            destinationChainName,
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

    function setL1PortalAddress(address newAddress) external override onlyAdmin {
        if (newAddress == address(0)) revert ZeroAddressPassed();

        znsEthPortalL2 = newAddress;

        emit L1PortalAddressSet(newAddress);
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
        // TODO multi: should this be a parameter to the registerAndBridgeDomain function to work on any chain ???
            networkIdL2,
            znsEthPortalL2,
            // TODO multi: figure out what this is and how to better pass it !!!
            true,
            encodedProof
        );

        emit DomainBridged(
            networkIdL2,
            znsEthPortalL2,
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
