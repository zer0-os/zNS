// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IPolygonZkEVMBridgeV2 } from "@zero-tech/zkevm-contracts/contracts/v2/interfaces/IPolygonZkEVMBridgeV2.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";
import { IDistributionConfig } from "../types/IDistributionConfig.sol";
import { ZeroAddressPassed } from "../utils/CommonErrors.sol";
import { IZNSRootRegistrar } from "../registrar/IZNSRootRegistrar.sol";
import { IZNSSubRegistrar } from "../registrar/IZNSSubRegistrar.sol";
import { IZNSRegistry } from "../registry/IZNSRegistry.sol";
import { PaymentConfig } from "../treasury/IZNSTreasury.sol";
import { IZNSPricer } from "../types/IZNSPricer.sol";
import { RegistrationProof } from "../types/CrossChainTypes.sol";


// TODO multi: should this be ZChainPortal as in chain specific contract?
//  it should ideally work with any ZkEVM chain. why not? we should add networkId and other
//  chain specific data to as parameters to some functions ???
contract ZNSPolygonZkEvmPortal is UUPSUpgradeable, AAccessControlled, IDistributionConfig {

    event DomainBridged(
        uint32 indexed destNetworkId,
        address destPortalAddress,
        bytes32 indexed domainHash,
        address indexed domainOwner
    );
    event L1PortalAddressSet(address newAddress);

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
        IZNSRegistry registry_
    ) external initializer {
        _setAccessController(accessController_);

        if (
            address(zkEvmBridge_) == address(0)
            || address(rootRegistrar_) == address(0)
            || address(subRegistrar_) == address(0)
            || address(treasury_) == address(0)
            || address(registry_) == address(0)
        ) revert ZeroAddressPassed();

        polygonZkEVMBridge = zkEvmBridge_;
        networkIdL2 = networkIdL2_;
        rootRegistrar = rootRegistrar_;
        subRegistrar = subRegistrar_;
        treasury = treasury_;
        registry = registry_;
    }

    function registerAndBridgeDomain(
        bytes32 parentHash,
        string calldata label,
        string calldata tokenURI
//      bool forceUpdateGlobalExitRoot  - do we need to pass this ???
    ) external {
        DistributionConfig memory emptyDistrConfig;
        PaymentConfig memory emptyPaymentConfig;

        // TODO multi: do we actually want to stake on BOTH sides? What other payment option can we do ???!!!
        // TODO multi: if we leave this option (stake as Portal address) this needs to be optimized!!!
        // take payment to this contract so it can register
        uint256 domainPrice = rootRegistrar.rootPricer().getPrice(0x0, label, true);
        ( IERC20 paymentToken, ) = treasury.paymentConfigs(0x0);
        paymentToken.transferFrom(msg.sender, address(this), domainPrice);

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

        // TODO multi: should we do that or leave this Agent as the owner ???
        //  DELETER registry from state if this is NOT used !!!
        // set owner as ZNSRegistry on this network
//        registry.updateDomainOwner(domainHash, address(registry));

        // TODO multi: ADD write record to ChainResolver here !!!

        // Bridge domain
        _bridgeDomain(
            domainHash,
            parentHash,
            label,
            tokenURI
        );
    }

    function _bridgeDomain(
        bytes32 domainHash,
        bytes32 parentHash,
        string calldata label,
        string calldata tokenURI
    ) internal {
        // Create data proof for ZNS on L2
        // we are using msg.sender here because the current caller on L1 will be the owner of the bridged L2 domain
        RegistrationProof memory proof = RegistrationProof({
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

    function setL1PortalAddress(address newAddress) external onlyAdmin {
        if (newAddress == address(0)) revert ZeroAddressPassed();

        znsEthPortalL2 = newAddress;

        emit L1PortalAddressSet(newAddress);
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
