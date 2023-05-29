// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSEthRegistrar } from "./IZNSEthRegistrar.sol";
import { IZNSRegistry } from "../registry/IZNSRegistry.sol";
import { IZNSTreasury } from "./IZNSTreasury.sol";
import { IZNSDomainToken } from "../token/IZNSDomainToken.sol";
import { IZNSAddressResolver } from "../resolver/IZNSAddressResolver.sol";
import { AccessControlled } from "../access/AccessControlled.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";


contract ZNSEthRegistrar is AccessControlled, UUPSUpgradeable, IZNSEthRegistrar {
    IZNSRegistry public registry;
    IZNSTreasury public treasury;
    IZNSDomainToken public domainToken;
    IZNSAddressResolver public addressResolver;

    modifier onlyNameOwner(bytes32 domainHash) {
        require(
            msg.sender == registry.getDomainOwner(domainHash),
            "ZNSEthRegistrar: Not the owner of the Name"
        );
        _;
    }

    modifier onlyTokenOwner(bytes32 domainHash) {
        require(
            msg.sender == domainToken.ownerOf(uint256(domainHash)),
            "ZNSEthRegistrar: Not the owner of the Token"
        );
        _;
    }

    /**
     * @notice Create an instance of the ZNSEthRegistrar
     * for registering ZNS domains and subdomains
     */
    function initialize(
        address accessController_,
        address registry_,
        address treasury_,
        address domainToken_,
        address addressResolver_
    ) public override initializer {
        _setAccessController(accessController_);
        setRegistry(registry_);
        setTreasury(treasury_);
        setDomainToken(domainToken_);
        setAddressResolver(addressResolver_);
    }

    /**
     * @notice Register a new domain such as `0://wilder`
     *
     * @param name Name of the domain to register
     * @param resolverContent Address for the resolver to return when requested (optional, send 0x0 if not needed)
     */
    function registerDomain(
        string calldata name,
        address resolverContent
    ) external override returns (bytes32) {
        require(
            bytes(name).length != 0,
            "ZNSEthRegistrar: Domain Name not provided"
        );

        // Create hash for given domain name
        bytes32 domainHash = keccak256(bytes(name));

        require(
            !registry.exists(domainHash),
            "ZNSEthRegistrar: Domain already exists"
        );

        // Staking logic
        treasury.stakeForDomain(domainHash, name, msg.sender, true);

        // Get tokenId for the new token to be minted for the new domain
        uint256 tokenId = uint256(domainHash);
        domainToken.register(msg.sender, tokenId);

        _setDomainData(domainHash, msg.sender, resolverContent);

        emit DomainRegistered(
            domainHash,
            tokenId,
            name,
            msg.sender,
            address(addressResolver)
        );

        return domainHash;
    }

    // TODO: figure out how to guard this so people can stake tokens
    //  without the risk of staking contract or wallet to call reclaim+revoke
    //  from underneath them
    function revokeDomain(bytes32 domainHash) external override 
    onlyNameOwner(domainHash)
    onlyTokenOwner(domainHash) 
    {
        uint256 tokenId = uint256(domainHash);
        domainToken.revoke(tokenId);
        treasury.unstakeForDomain(domainHash, msg.sender);
        registry.deleteRecord(domainHash);

        emit DomainRevoked(domainHash, msg.sender);
    }

    function reclaimDomain(bytes32 domainHash) external override
    onlyTokenOwner(domainHash)
    {
        registry.updateDomainOwner(domainHash, msg.sender);

        emit DomainReclaimed(domainHash, msg.sender);
    }

    function setRegistry(address registry_) public override onlyAdmin {
        require(
            registry_ != address(0),
            "ZNSEthRegistrar: registry_ is 0x0 address"
        );
        registry = IZNSRegistry(registry_);

        emit RegistrySet(registry_);
    }

    function setTreasury(address treasury_) public override onlyAdmin {
        require(
            treasury_ != address(0),
            "ZNSEthRegistrar: treasury_ is 0x0 address"
        );
        treasury = IZNSTreasury(treasury_);

        emit TreasurySet(treasury_);
    }

    function setDomainToken(address domainToken_) public override onlyAdmin {
        require(
            domainToken_ != address(0),
            "ZNSEthRegistrar: domainToken_ is 0x0 address"
        );
        domainToken = IZNSDomainToken(domainToken_);

        emit DomainTokenSet(domainToken_);
    }

    function setAddressResolver(address addressResolver_) public override onlyAdmin {
        require(
            addressResolver_ != address(0),
            "ZNSEthRegistrar: addressResolver_ is 0x0 address"
        );
        addressResolver = IZNSAddressResolver(addressResolver_);

        emit AddressResolverSet(addressResolver_);
    }

    function setAccessController(address accessController_) external override(AccessControlled, IZNSEthRegistrar) 
        onlyAdmin
    {
        _setAccessController(accessController_);
    }

    function getAccessController() external view override(AccessControlled, IZNSEthRegistrar) returns (address) {
        return address(accessController);
    }

    /**
     * @notice Set domain data appropriately for a newly registered domain
     *
     * @param domainHash The domain name hash
     * @param owner The owner of that domain
     * @param resolverContent The content it resolves to
     */
    function _setDomainData(
        bytes32 domainHash,
        address owner,
        address resolverContent
    ) internal {
        // Set only the domain owner if no resolver content is given
        if (resolverContent != address(0)) {
            registry.createDomainRecord(domainHash, owner, address(addressResolver));
            addressResolver.setAddress(domainHash, resolverContent);
        } else {
            registry.createDomainRecord(domainHash, owner, address(0));
        }
    }

    /**
     * @notice The required override by UUPS
     * @param newImplementation The implementation contract to upgrade to
     */
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyGovernor {
        
    }
}
