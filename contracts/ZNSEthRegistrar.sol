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
    IZNSRegistry znsRegistry;
//    ZNSDomainToken znsDomainToken; // TODO add token here when ready along with import

    // TODO change logic related to the 2 below mappings
    //  to work with actual contracts when they are ready
    mapping(bytes32 => address) public registry__records__owner;

    mapping(uint256 => uint256) public priceOracle__prices;

    mapping(bytes32 => uint256) private stakes;

    mapping(bytes32 => address) private subdomainApprovals;

    modifier onlyOwner(bytes32 hash) {
        require(msg.sender == znsRegistry.getDomainOwner(hash));
        _;
    }

    constructor(address _zeroToken, address _znsRegistry, uint256 _length, uint256 _price) {
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

        // burn the deflation fee
        zeroToken.burn(address(this), deflationFee);

        // generate hashes for the new domain
        hashWithParent(ETH_ROOT_HASH, name);

        // add stake data on the contract (this will possibly migrate to separate staking module)
        stakes[domainHash] = pricePerDomain;

        // get tokenId for the new token to be minted for the new domain
        uint256 tokenId = uint256(domainHash);

        // TODO add call to ZNSDomainToken to mint a new domain token with tokenId = uint256(namehash)

        // znsDomainToken.mint(msg.sender, tokenId);

        // set data on Registry storage
        if (resolver == address(0)) {
            require(
                domainContent == address(0),
                "ZNSEthRegistrar: Domain content provided without a valid resolver address"
            );
            znsRegistry.setDomainOwner(domainHash, msg.sender);
        } else {
            znsRegistry.setDomainRecord(domainHash, msg.sender, resolver);
        }

        return domainHash;
    }

    function approveSubdomain(bytes32 parentHash, address subdomainOwner) external onlyOwner(parentHash) {
        subdomainApprovals[parentHash] = subdomainOwner;
    }

    function registerSubdomain(bytes32 parentHash, string label) external {
        // Should we add interface check here that every Registrar should implement
        // to only run the below require if an EOA is calling this?
        // We do not need a subdomain approval if it's a Registrar
        // contract calling this since the call from it already
        // serves as an "approval".
        require(
            subdomainApprovals[parentHash] == msg.sender,
            "Subdomain purchase not authorized for this account"
        );

        // there should probably be storage structure for subdomain prices
        // that is separate from root domains
        uint256 pricePerSubdomain = priceOracle__prices[label.length];

        // How inconvenient is it to make a `subdomainOwner`
        // call `approve()` on the ZeroToken, but then make a domain owner
        // to call this in order to register a domain for someone else?
        // What solutions can we make here to avoid this confusing call group?
        // Solutions:
        // 1. Add subdomain approval mapping to allow parent domain owners
        // to add subdomain buyer to the mapping, allowing him to buy a subdomain
        // under his parent domain.
        zeroToken.transferFrom(
            msg.sender,
            address(this),
            pricePerSubdomain
        );

        bytes32 namehash = keccak256(abi.encodePacked(parentHash, bytes(label)));

        stakes[namehash] = pricePerSubdomain;

        registry__records__owner[namehash] = msg.sender;
    }
}
