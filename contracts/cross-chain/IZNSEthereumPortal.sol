// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IDistributionConfig } from "../types/IDistributionConfig.sol";
import { IBridgeMessageReceiver } from "@zero-tech/zkevm-contracts/contracts/interfaces/IBridgeMessageReceiver.sol";
import { IPolygonZkEVMBridgeV2Ext } from "./IPolygonZkEVMBridgeV2Ext.sol";
import { IZNSRootRegistrar } from "../registrar/IZNSRootRegistrar.sol";
import { IZNSSubRegistrar } from "../registrar/IZNSSubRegistrar.sol";
import { IZNSRegistry } from "../registry/IZNSRegistry.sol";
import { IZNSDomainToken } from "../token/IZNSDomainToken.sol";


interface IZNSEthereumPortal is IDistributionConfig, IBridgeMessageReceiver {
    event DomainClaimed(
        uint32 indexed srcNetworkId,
        address srcPortalAddress,
        bytes32 indexed domainHash,
        address indexed domainOwner
    );
    event SrcZnsPortalSet(address newAddress);

    error InvalidCaller(address caller);
    error InvalidOriginAddress(address originAddress);
    error DomainHashDoesNotMatchBridged(bytes32 bridgedHashL1, bytes32 generatedHashL2);

    function polygonZkEVMBridge() external view returns (IPolygonZkEVMBridgeV2Ext);

    function networkId() external view returns (uint32);

    function srcZnsPortal() external view returns (address);

    function rootRegistrar() external view returns (IZNSRootRegistrar);

    function subRegistrar() external view returns (IZNSSubRegistrar);

    function domainToken() external view returns (IZNSDomainToken);

    function registry() external view returns (IZNSRegistry);

    function initialize(
        address accessController_,
        IPolygonZkEVMBridgeV2Ext zkEvmBridge_,
        address srcZnsPortal_,
        IZNSRegistry registry_,
        IZNSDomainToken domainToken_,
        IZNSRootRegistrar rootRegistrar_,
        IZNSSubRegistrar subRegistrar_
    ) external;

    function setSrcZnsPortal(address newAddress) external;

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4);
}
