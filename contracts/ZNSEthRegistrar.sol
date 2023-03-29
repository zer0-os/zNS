// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

// TODO change for the actual ZeroToken when ready
// TODO adapt ZeroToken Interface
import ".\mocks\IZeroTokenMock.sol";
import ".\IZNSRegistry.sol";


contract ZNSEthRegistrar {

    // TODO possibly move these constants to PriceOracle. make the fee percentages state vars??
    uint256 public constant PERCENTAGE_BASIS = 10000;
    uint256 public constant FEE_PERCENTAGE = 222; // 2.22% in basis points (parts per 10,000)

    // TODO this is here temporarily,
    // figure out where this should be and how to set it up !
    bytes32 public constant ETH_ROOT_HASH = keccak256(bytes("0xETH://"));

    IZeroTokenMock public zeroToken;
    IZNSRegistry public znsRegistry;
    ZNSDomainToken public znsDomainToken; // TODO add token here when ready along with import

    // TODO change logic related to the 2 below mappings
    //  to work with actual contracts when they are ready
    mapping(bytes32 => address) public registry__records__owner;

    mapping(uint256 => uint256) public priceOracle__prices;

    mapping(bytes32 => uint256) private stakes;

    mapping(bytes32 => address) private subdomainApprovals;

    // TODO add events

    modifier onlyOwner(bytes32 hash) {
        require(msg.sender == znsRegistry.getDomainOwner(hash));
        _;
    }

    constructor(
        address _zeroToken,
        address _znsRegistry,
        uint256 _length,
        uint256 _price
    ) {
        // TODO consider removing require messsages altogether. what would we have instead?
        require(_zeroToken != address(0), "ZNSEthRegistrar: Zero address passed as _zeroToken");
        require(_znsRegistry != address(0), "ZNSEthRegistrar: Zero address passed as _znsRegistry");

        // TODO change from mock
        zeroToken = IZeroTokenMock(_zeroToken);
        znsRegistry = IZNSRegistry(_znsRegistry);
        // TODO switch to ZNSPriceOracle call
        priceOracle__prices[_length] = _price;
    }

    function hashWithParent(bytes32 parentHash, string name) public pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                parentHash,
                keccak256(bytes(name))
            )
        );
    }

    // TODO do we only allow address type of content here? How do we set other types here?
    //  Would we need to do separate calls from a wallet to a certain Resolver after we've registered a domain?
    function registerRootDomain(string name, address resolver, address domainContent) external returns (bytes32) {
        // TODO are we doing commit-reveal here? if so, split this function
        // get prices and fees
        uint256 pricePerDomain = priceOracle__prices[name.length];
        uint256 deflationFee = pricePerDomain * FEE_PERCENTAGE / PERCENTAGE_BASIS;

        // take the payment as a staking deposit
        zeroToken.transferFrom(
            msg.sender,
            address(this),
            pricePerDomain + deflationFee
        );

        // TODO is this how we want to burn?
        // burn the deflation fee
        zeroToken.burn(address(this), deflationFee);

        // generate hashes for the new domain
        bytes32 domainHash = hashWithParent(ETH_ROOT_HASH, name);

        // add stake data on the contract (this will possibly migrate to separate staking module)
        stakes[domainHash] = pricePerDomain;

        // get tokenId for the new token to be minted for the new domain
        uint256 tokenId = uint256(domainHash);

        // TODO add call to ZNSDomainToken to mint a new domain token with tokenId = uint256(namehash)
        //  do we want to change attack surface here
        //  by outsourcing the ZNSRegistry call to the DomainToken?
        //  will it actually help?..

         znsDomainToken.mint(msg.sender, tokenId);

        // set data on Registry and Resolver storage
        _setDomainData(domainHash, msg.sender, resolver, domainAddress);

        return domainHash;
    }

    function approveSubdomain(bytes32 parentHash, address subdomainOwner) external onlyOwner(parentHash) {
        subdomainApprovals[parentHash] = subdomainOwner;
    }

    function registerSubdomain(
        bytes32 parentHash,
        string name,
        address beneficiary,
        address resolver,
        address domainAddress
    ) external returns (bytes32) {
        // Should we add interface check here that every Registrar should implement
        // to only run the below require if an EOA is calling this?
        // We do not need a subdomain approval if it's a Registrar
        // contract calling this since the call from it already
        // serves as an "approval".

        address registerFor = beneficiary;
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

        // there should probably be storage structure on PriceOracle for subdomain prices
        // that is separate from root domains
        uint256 pricePerSubdomain = priceOracle__prices[name.length];

        // we are always charging the caller here
        // RDO Registrar if present or direct buyer/caller if no RDO Registrar
        zeroToken.transferFrom(
            msg.sender,
            address(this),
            pricePerSubdomain
        );

        // TODO do we have burning here or just for Root Domains?

        bytes32 domainHash = hashWithParent(parentHash, name);

        stakes[domainHash] = pricePerSubdomain;

        _setDomainData(domainHash, registerFor, resolver, domainAddress);

        return domainHash;
    }

    function revokeDomain(bytes32 domainHash) external {
        require(
            znsRegistry.getDomainOwner(domainHash) == msg.sender,
            "ZNSEthRegistrar: Not an owner of the current domain name"
        );

        // TODO is this necessary?
        require(
            znsRegistry.exists(domainHash),
            "ZNSEthRegistrar: Domain does not exist"
        );

        uint256 tokenId = uint256(domainHash);

        znsDomainToken.revoke(tokenId);

        znsRegistry.deleteDomainRecord(domainHash);

        uint256 stakeAmount = stakes[domainHash];
        delete stakes[domainHash];

        zeroToken.transfer(msg.sender, stakeAmount);

        // TODO what are we missing here?
    }

    function _setDomainData(bytes32 domainHash, address owner, address resolver, address domainAddress) internal {
        if (resolver == address(0)) {
            require(
                domainAddress == address(0),
                "ZNSEthRegistrar: Domain content provided without a valid resolver address"
            );

            // TODO fix these calls once Registry is merged
            znsRegistry.setDomainOwner(domainHash, owner);
        } else {
            // TODO fix these calls once Registry is merged
            znsRegistry.setDomainRecord(domainHash, owner, resolver);

            // TODO fix this once Resolvers are finalized
            if (domainAddress != address(0)) Resolver(resolver).setAddress(domainHash, domainAddress);
        }
    }
}
