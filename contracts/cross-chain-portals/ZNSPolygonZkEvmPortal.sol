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

    // *--| Cross-chain Data |--*
    IPolygonZkEVMBridgeV2 public polygonZkEVMBridge;
    // Destination chain (L2)
    uint32 public networkIdL2;
    // TODO multi: change to interface type (possibly!)
    address public znsEthPortalL2;

    // *--| ZNS Data for THIS chain |--*
    IZNSRootRegistrar public rootRegistrar;
    IZNSSubRegistrar public subRegistrar;
    IZNSRegistry public registry;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address accessController_,
        uint32 networkIdL2_,
        IPolygonZkEVMBridgeV2 zkEvmBridge_,
        address znsEthPortalL2_,
        IZNSRootRegistrar rootRegistrar_,
        IZNSSubRegistrar subRegistrar_,
        IZNSRegistry registry_
    ) external initializer {
        _setAccessController(accessController_);

        if (
            zkEvmBridge_ == address(0)
            | znsEthPortalL2_ == address(0)
            | address(rootRegistrar_) == address(0)
            | address(subRegistrar_) == address(0)
            | address(registry_) == address(0)
        ) revert ZeroAddressPassed();

        polygonZkEVMBridge = zkEvmBridge_;
        networkIdL2 = networkIdL2_;
        znsEthPortalL2 = znsEthPortalL2_;
        rootRegistrar = rootRegistrar_;
        subRegistrar = subRegistrar_;
        registry = registry_;
    }

    function registerAndBridgeDomain(
        bytes32 parentHash,
        string calldata label,
        string calldata tokenURI
//      bool forceUpdateGlobalExitRoot  - do we need to pass this ???
    ) external {
        DistributionConfig memory emptyDistrConfig = DistributionConfig(
            IZNSPricer(address(0)),
            PaymentType.DIRECT,
            AccessType.LOCKED
        );
        PaymentConfig memory emptyPaymentConfig = PaymentConfig(
            IERC20(address(0)),
            address(0)
        );

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
        registry.updateDomainOwner(domainHash, address(registry));

        // TODO multi: ADD write record to ChainResolver here !!!

        // Bridge domain
        _bridgeDomain(domainHash, tokenURI);
    }

    function _bridgeDomain(bytes32 domainHash, string calldata tokenURI) internal {
        // Create data proof for ZNS on L2
        RegistrationProof memory proof = RegistrationProof(
            // we are using msg.sender here because the current caller on L1 will be the owner of the bridged L2 domain
            msg.sender,
            domainHash,
            tokenURI
        );

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
