// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

// TODO: change for the actual ZeroToken when ready
// TODO: adapt ZeroToken Interface
import "./mocks/IZeroTokenMock.sol";
import "./IZNSRegistry.sol";
import "./IZNSDomainToken.sol";
import "./IZNSEthRegistrar.sol";


contract ZNSEthRegistrar is IZNSEthRegistrar {

    // TODO:    this is here temporarily,
    //          figure out where this should be and how to set it up !
    bytes32 public constant ETH_ROOT_HASH = keccak256(bytes("0xETH://"));

    IZNSRegistry public znsRegistry;
    IZNSTreasury public znsTreasury;
    IZNSDomainToken public znsDomainToken; // TODO: add token here when ready along with import

    mapping(bytes32 => uint256) private stakes;

    mapping(bytes32 => address) private subdomainApprovals;

    // TODO: add events

    modifier onlyOwner(bytes32 hash) {
        require(msg.sender == znsRegistry.getDomainOwner(hash));
        _;
    }

    constructor(
        address _znsRegistry,
        address _znsTreasury,
        address _znsDomainToken,
        uint256 _length,
        uint256 _price
    ) {
        // TODO: consider removing require messsages altogether. what would we have instead?
        require(_znsRegistry != address(0), "ZNSEthRegistrar: Zero address passed as _znsRegistry");
        require(_znsDomainToken != address(0), "ZNSEthRegistrar: Zero address passed as _znsDomainToken");
        require(_znsTreasury != address(0), "ZNSEthRegistrar: Zero address passed as _znsTreasury");

        znsRegistry = IZNSRegistry(_znsRegistry);
        znsTreasury = IZNSTreasury(_znsTreasury);
        znsDomainToken = IZNSDomainToken(_znsDomainToken);
    }

    function hashWithParent(bytes32 parentHash, string name) public pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                parentHash,
                keccak256(bytes(name))
            )
        );
    }

    // TODO:    Do we only allow address type of content here? How do we set other types here?
    //          Would we need to do separate calls from a wallet to a certain Resolver after we've registered a domain?
    function registerRootDomain(string name, address resolver, address domainContent) external returns (bytes32) {
        // TODO:    are we doing commit-reveal here? if so, split this function

        // generate hashes for the new domain
        bytes32 domainHash = hashWithParent(ETH_ROOT_HASH, name);

        // do all the staking logic
        znsTreasury.stakeForDomain(domainHash, name, msg.sender, true);

        // get tokenId for the new token to be minted for the new domain
        uint256 tokenId = uint256(domainHash);

        // TODO:    add call to ZNSDomainToken to mint a new domain token with tokenId = uint256(namehash)
        //          do we want to change attack surface here
        //          by outsourcing the ZNSRegistry call to the DomainToken?
        //          will it actually help?..

         znsDomainToken.mint(msg.sender, tokenId);

        // set data on Registry and Resolver storage
        _setDomainData(domainHash, msg.sender, resolver, domainAddress);

        emit RootDomainRegistered(domainHash, name, msg.sender);

        return domainHash;
    }

    function approveSubdomain(bytes32 parentHash, address subdomainOwner) external onlyOwner(parentHash) {
        subdomainApprovals[parentHash] = subdomainOwner;
    }

    function registerSubdomain(
        bytes32 parentHash,
        string name,
        address registrant,
        address resolver,
        address domainAddress
    ) external returns (bytes32) {
        // TODO:    Should we add interface check here that every Registrar should implement
        //          to only run the below require if an EOA is calling this?
        //          We do not need a subdomain approval if it's a Registrar
        //          contract calling this since the call from it already
        //          serves as an "approval".

        address registerFor = registrant;
        // Here if the caller is an owner or an operator
        // (where a Registrar contract can be any of those),
        // we do not need to check the approval.
        if (!znsRegistry.isOwnerOrOperator(parentHash, msg.sender)) {
            require(
                subdomainApprovals[parentHash] == msg.sender,
                "ZNSEthRegistrar: Subdomain purchase is not authorized for this account"
            );

            registerFor = msg.sender;
        }

        bytes32 domainHash = hashWithParent(parentHash, name);

        // TODO: do we have burning here or just for Root Domains?
        // we are always charging the caller here
        // RDO Registrar if present or direct buyer/caller if no RDO Registrar
        znsTreasury.stakeForDomain(domainHash, name, msg.sender, false);

        _setDomainData(domainHash, registerFor, resolver, domainAddress);

        emit SubdomainRegistered(domainHash, parentHash, name, registerFor);

        return domainHash;
    }

    function revokeDomain(bytes32 domainHash) external onlyOwner(domainHash) {
        // TODO: is this necessary?
        require(
            znsRegistry.exists(domainHash),
            "ZNSEthRegistrar: Domain does not exist"
        );

        uint256 tokenId = uint256(domainHash);

        znsDomainToken.revoke(tokenId);

        znsRegistry.deleteDomainRecord(domainHash);

        znsTreasury.unstakeForDomain(domainHash, msg.sender);

        emit DomainRevoked(domainHash, msg.sender);

        // TODO: what are we missing here?
    }

    function _setDomainData(bytes32 domainHash, address owner, address resolver, address domainAddress) internal {
        if (resolver == address(0)) {
            require(
                domainAddress == address(0),
                "ZNSEthRegistrar: Domain content provided without a valid resolver address"
            );

            // TODO: fix these calls once Registry is merged
            znsRegistry.setDomainOwner(domainHash, owner);
        } else {
            // TODO: fix these calls once Registry is merged
            znsRegistry.setDomainRecord(domainHash, owner, resolver);

            // TODO: fix this once Resolvers are finalized
            if (domainAddress != address(0)) Resolver(resolver).setAddress(domainHash, domainAddress);
        }
    }
}
