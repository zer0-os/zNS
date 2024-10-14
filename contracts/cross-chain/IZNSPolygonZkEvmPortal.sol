// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IPolygonZkEVMBridgeV2 } from "@zero-tech/zkevm-contracts/contracts/v2/interfaces/IPolygonZkEVMBridgeV2.sol";
import { IDistributionConfig } from "../types/IDistributionConfig.sol";
import { IZNSRootRegistrar } from "../registrar/IZNSRootRegistrar.sol";
import { IZNSSubRegistrar } from "../registrar/IZNSSubRegistrar.sol";
import { IZNSRegistry } from "../registry/IZNSRegistry.sol";
import { IZNSTreasury } from "../treasury/IZNSTreasury.sol";
import { IZNSChainResolver } from "../resolver/IZNSChainResolver.sol";
import { IZNSAccessController } from "../access/IZNSAccessController.sol";


interface IZNSPolygonZkEvmPortal is IDistributionConfig {

    struct ZNSContractInput {
        IZNSAccessController accessController;
        IZNSRootRegistrar rootRegistrar;
        IZNSSubRegistrar subRegistrar;
        IZNSTreasury treasury;
        IZNSChainResolver chainResolver;
        IZNSRegistry registry;
    }

    event DomainBridged(
        uint32 indexed destNetworkId,
        address destPortalAddress,
        bytes32 indexed domainHash,
        address indexed domainOwner
    );
    event DestZnsPortalSet(address newAddress);

    function polygonZkEVMBridge() external view returns (IPolygonZkEVMBridgeV2);

    function destNetworkId() external view returns (uint32);

    function destChainName() external view returns (string memory);

    function destChainId() external view returns (uint256);

    function destZnsPortal() external view returns (address);

    function rootRegistrar() external view returns (IZNSRootRegistrar);

    function subRegistrar() external view returns (IZNSSubRegistrar);

    function treasury() external view returns (IZNSTreasury);

    function chainResolver() external view returns (IZNSChainResolver);

    function registry() external view returns (IZNSRegistry);

    function initialize(
        uint32 destNetworkId_,
        string calldata destChainName_,
        uint256 destChainId_,
        IPolygonZkEVMBridgeV2 zkEvmBridge_,
        ZNSContractInput calldata znsContracts
    ) external;

    function registerAndBridgeDomain(
        bytes32 parentHash,
        string calldata label,
        string calldata tokenURI
//      bool forceUpdateGlobalExitRoot  - do we need to pass this ???
    ) external;

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4);

    function setDestZnsPortal(address newAddress) external;
}
