// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

// TODO change for the actual ZeroToken when ready
// TODO adapt ZeroToken Interface
import ".\mocks\IZeroTokenMock.sol";


contract ZNSEthRegistrar {

    // TODO possibly move these constants to PriceOracle. make the fees state vars??
    uint256 public constant PERCENTAGE_BASIS = 10000;
    uint256 public constant FEE_PERCENTAGE = 222; // 2.22% in basis points (parts per 10,000)

    IZeroTokenMock public zeroToken;

    // TODO change logic related to the 2 below mappings
    //  to work with actual contracts when they are ready
    mapping(bytes32 => address) public registry__records__owner;

    mapping(uint256 => uint256) public priceOracle__prices;

    mapping(bytes32 => uint256) private stakes;

    mapping(bytes32 => address) private subdomainApprovals;

    modifier onlyOwner(bytes32 hash) {
        require(msg.sender == registry__records__owner[hash]);
        _;
    }

    constructor(address _zeroToken, uint256 _length, uint256 _price) {
        // TODO consider removing require messsages altogether. what would we have instead?
        require(_zeroToken != address(0), "ZNSEthRegistrar: Zero address passed as _zeroToken");
        // set up mock of zeroToken
        zeroToken = IZeroTokenMock(_zeroToken);
        // add one price for one string length to test with
        priceOracle__prices[_length] = _price;
    }

    function registerRootDomain(string label) external {
        // TODO are we doing commit-reveal here? if so, split this function
        uint256 pricePerDomain = priceOracle__prices[label.length];
        uint256 deflationFee = pricePerDomain * FEE_PERCENTAGE / PERCENTAGE_BASIS;

        zeroToken.transferFrom(
            msg.sender,
            address(this),
            pricePerDomain + deflationFee
        );

        zeroToken.burn(address(this), deflationFee);

        // TODO change this for the finalized hashing function
        bytes32 namehash = keccak256(bytes(label));

        stakes[namehash] = pricePerDomain;

        registry__records__owner[namehash] = msg.sender;
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
