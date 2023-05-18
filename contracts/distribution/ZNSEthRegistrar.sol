// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IZNSEthRegistrar} from "./IZNSEthRegistrar.sol";
import {IZNSRegistry} from "../registry/IZNSRegistry.sol";
import {IZNSTreasury} from "./IZNSTreasury.sol";
import {IZNSDomainToken} from "../token/IZNSDomainToken.sol";
import {IZNSAddressResolver} from "../resolver/IZNSAddressResolver.sol";
import {IZNSPriceOracle} from "./IZNSPriceOracle.sol";
import {StringUtils} from "../utils/StringUtils.sol";

contract ZNSEthRegistrar is IZNSEthRegistrar {
    IZNSRegistry public znsRegistry;
    IZNSTreasury public znsTreasury;
    IZNSDomainToken public znsDomainToken;
    IZNSAddressResolver public znsAddressResolver;
    IZNSPriceOracle public znsPriceOracle;

    // To account for unicode strings, we need a custom length library
    using StringUtils for string;

    mapping(bytes32 parentdomainNameHash => mapping(address user => bool status))
        public subdomainApprovals;

    modifier onlyOwner(bytes32 domainNameHash) {
        require(
            msg.sender == znsRegistry.getDomainOwner(domainNameHash),
            "ZNSEthRegistrar: Not the Domain Owner"
        );
        _;
    }

    /**
     * @notice Create an instance of the ZNSEthRegistrar
     * for registering ZNS domains and subdomains
     */
    constructor(
        IZNSRegistry znsRegistry_,
        IZNSTreasury znsTreasury_,
        IZNSDomainToken znsDomainToken_,
        IZNSAddressResolver znsAddressResolver_,
        IZNSPriceOracle znsPriceOracle_
    ) {
        znsRegistry = znsRegistry_;
        znsTreasury = znsTreasury_;
        znsDomainToken = znsDomainToken_;
        znsAddressResolver = znsAddressResolver_;
        znsPriceOracle = znsPriceOracle_;
    }

    /**
     * @notice Register a new domain such as `0://wilder`
     *
     * @param name Name of the domain to register
     * @param resolver Address of the resolver for that domain (optional, send 0x0 if not needed)
     * @param resolverContent Address for the resolver to return when requested (optional, send 0x0 if not needed)
     */
    function registerDomain(
        string calldata name,
        address resolver,
        address resolverContent
    ) external returns (bytes32) {
        require(
            name.strlen() != 0,
            "ZNSEthRegistrar: Domain Name not provided"
        );

        // Create hash for given domain name
        bytes32 domainNameHash = keccak256(bytes(name));

        require(
            !znsRegistry.exists(domainNameHash),
            "ZNSEthRegistrar: Domain already exists"
        );

        // Staking logic
        znsTreasury.stakeForDomain(domainNameHash, name, msg.sender, true);

        // Get tokenId for the new token to be minted for the new domain
        uint256 tokenId = uint256(domainNameHash);
        znsDomainToken.register(msg.sender, tokenId);

        _setDomainData(domainNameHash, msg.sender, resolver, resolverContent);

        emit DomainRegistered(domainNameHash, tokenId, name, msg.sender, resolver);

        return domainNameHash;
    }

    // TODO Functions for updating the domain already exist in ZNSRegistry
    // We can have the dApp call those functions directly?
    // Should we add an `updateDomain` function here instead?

    function revokeDomain(
        bytes32 domainNameHash
    ) external onlyOwner(domainNameHash) {
        uint256 tokenId = uint256(domainNameHash);
        znsDomainToken.revoke(tokenId);
        znsTreasury.unstakeForDomain(domainNameHash, msg.sender);
        znsRegistry.deleteRecord(domainNameHash);

        emit DomainRevoked(domainNameHash, msg.sender);

        // TODO: what are we missing here?
    }

    //TODO: Access Control
    function reclaimDomain(bytes32 domainNameHash) external {
        uint256 tokenId = uint256(domainNameHash);
        require(
            znsDomainToken.ownerOf(tokenId) == msg.sender,
            "ZNSEthRegistrar: Not owner of Token"
        );
        znsRegistry.setDomainOwner(domainNameHash, msg.sender);

        emit DomainReclaimed(domainNameHash, msg.sender);
    }

    /**
     * @notice Set domain data appropriately for a newly registered domain
     *
     * @param domainNameHash The domain name hash
     * @param owner The owner of that domain
     * @param resolver The address of the resolver
     * @param resolverContent The content it resolves to
     */
    function _setDomainData(
        bytes32 domainNameHash,
        address owner,
        address resolver,
        address resolverContent
    ) internal {
        // If no resolver is given, require no domain data exists either
        if (resolver == address(0)) {
            require(
                resolverContent == address(0),
                "ZNSEthRegistrar: Domain content provided without a valid resolver address"
            );
            // Set only the domain owner
            znsRegistry.createDomainRecord(domainNameHash, owner, address(0));
        } else {
            // If a valid resolver is given, require domain data as well
            require(
                resolverContent != address(0),
                "ZNSEthRegistrar: No domain content provided"
            );

            // TODO: what is the given Resolver already exists?
            //  we do not want to re-set it again in Registry storage
            //  iron this out!
            znsRegistry.createDomainRecord(domainNameHash, owner, resolver);

            // TODO error: we are using a different Resolver here than the one passed!
            //  and the one in the call above. This is an error that can cause undiscoverable domains
            //  If we only have one AddressResolver, we should not take it as an argument
            //  to the register function at all and assume the one in this storage is being used

            // On the above comment, if we only use this function for newly registered domains
            // it is always going to be the AddressResolver contract we deployed.
            // If we create a function to update an existing domain, then we should modify
            // how this is used, or create a different `updateDomainData` function
            znsAddressResolver.setAddress(domainNameHash, resolverContent);
        }
    }
}
