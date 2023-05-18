// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IZNSEthRegistrar} from "./IZNSEthRegistrar.sol";
import {IZNSRegistry} from "../registry/IZNSRegistry.sol";
import {IZNSTreasury} from "./IZNSTreasury.sol";
import {IZNSDomainToken} from "../token/IZNSDomainToken.sol";
import {IZNSAddressResolver} from "../resolver/IZNSAddressResolver.sol";
import {IZNSPriceOracle} from "./IZNSPriceOracle.sol";
// import {StringUtils} from "../utils/StringUtils.sol";

contract ZNSEthRegistrar is IZNSEthRegistrar {
    IZNSRegistry public znsRegistry;
    IZNSTreasury public znsTreasury;
    IZNSDomainToken public znsDomainToken;
    IZNSAddressResolver public znsAddressResolver;
    IZNSPriceOracle public znsPriceOracle;

    // To account for unicode strings, we need a custom length library
    // using StringUtils for string;

    mapping(bytes32 parentdomainHash => mapping(address user => bool status))
        public subdomainApprovals;

    modifier onlyOwner(bytes32 domainHash) {
        require(
            msg.sender == znsRegistry.getDomainOwner(domainHash),
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
     * @param resolverContent Address for the resolver to return when requested (optional, send 0x0 if not needed)
     */
    function registerDomain(
        string calldata name,
        address resolverContent
    ) external returns (bytes32) {
        require(
            bytes(name).length != 0,
            "ZNSEthRegistrar: Domain Name not provided"
        );

        // Create hash for given domain name
        bytes32 domainHash = keccak256(bytes(name));

        require(
            !znsRegistry.exists(domainHash),
            "ZNSEthRegistrar: Domain already exists"
        );

        // Staking logic
        znsTreasury.stakeForDomain(domainHash, name, msg.sender, true);

        // Get tokenId for the new token to be minted for the new domain
        uint256 tokenId = uint256(domainHash);
        znsDomainToken.register(msg.sender, tokenId);

        _setDomainData(domainHash, msg.sender, resolverContent);

        emit DomainRegistered(domainHash, tokenId, name, msg.sender, address(znsAddressResolver));

        return domainHash;
    }

    function revokeDomain(
        bytes32 domainHash
    ) external onlyOwner(domainHash) {
        uint256 tokenId = uint256(domainHash);
        znsDomainToken.revoke(tokenId);
        znsTreasury.unstakeForDomain(domainHash, msg.sender);
        znsRegistry.deleteRecord(domainHash);

        emit DomainRevoked(domainHash, msg.sender);

        // TODO: what are we missing here?
    }

    //TODO: Access Control
    function reclaimDomain(bytes32 domainHash) external {
        uint256 tokenId = uint256(domainHash);
        require(
            znsDomainToken.ownerOf(tokenId) == msg.sender,
            "ZNSEthRegistrar: Not owner of Token"
        );
        znsRegistry.updateDomainOwner(domainHash, msg.sender);

        emit DomainReclaimed(domainHash, msg.sender);
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
            znsRegistry.createDomainRecord(domainHash, owner, address(znsAddressResolver));
            znsAddressResolver.setAddress(domainHash, resolverContent);
        } else {
            znsRegistry.createDomainRecord(domainHash, owner, address(0));
        }
    }
}
