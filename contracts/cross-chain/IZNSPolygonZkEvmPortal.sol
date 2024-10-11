// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IPolygonZkEVMBridgeV2 } from "@zero-tech/zkevm-contracts/contracts/v2/interfaces/IPolygonZkEVMBridgeV2.sol";
import { IDistributionConfig } from "../types/IDistributionConfig.sol";
import { IZNSRootRegistrar } from "../registrar/IZNSRootRegistrar.sol";
import { IZNSSubRegistrar } from "../registrar/IZNSSubRegistrar.sol";
import { IZNSRegistry } from "../registry/IZNSRegistry.sol";
import { IZNSTreasury } from "../treasury/IZNSTreasury.sol";
import { IZNSChainResolver } from "../resolver/IZNSChainResolver.sol";


interface IZNSPolygonZkEvmPortal is IDistributionConfig {

    event DomainBridged(
        uint32 indexed destNetworkId,
        address destPortalAddress,
        bytes32 indexed domainHash,
        address indexed domainOwner
    );
    event L1PortalAddressSet(address newAddress);

    struct DomainData {
        bytes32 domainHash;
        uint256 price;
        uint256 protocolFee;
        uint256 totalCost;
    }

    function polygonZkEVMBridge() external view returns (IPolygonZkEVMBridgeV2);

    function networkIdL2() external view returns (uint32);

    function znsEthPortalL2() external view returns (address);

    function rootRegistrar() external view returns (IZNSRootRegistrar);

    function subRegistrar() external view returns (IZNSSubRegistrar);

    function treasury() external view returns (IZNSTreasury);

    function chainResolver() external view returns (IZNSChainResolver);

    function registry() external view returns (IZNSRegistry);

    function initialize(
        address accessController_,
        uint32 networkIdL2_,
        IPolygonZkEVMBridgeV2 zkEvmBridge_,
        IZNSRootRegistrar rootRegistrar_,
        IZNSSubRegistrar subRegistrar_,
        IZNSTreasury treasury_,
        IZNSChainResolver chainResolver_,
        IZNSRegistry registry_
    ) external;

    function registerAndBridgeDomain(
        bytes32 parentHash,
        string calldata label,
        string calldata tokenURI,
        uint32 destinationChainId,
    // TODO multi: do we actually have to pass it here ?? do we support 1 chain in this portal only ???
        string calldata destinationChainName
//      bool forceUpdateGlobalExitRoot  - do we need to pass this ???
    ) external;

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4);

    function setL1PortalAddress(address newAddress) external;
}
