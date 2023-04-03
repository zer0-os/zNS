// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "./IZNSAddressResolver.sol";

contract ZNSAddressResolver is IZNSAddressResolver{
    bytes4 internal constant RESOLVER_INTERFACE_ID = 0xe25f0a33;
    address public registry;
    mapping(bytes32 => address) public addressOf;

    modifier onlyRegistry(){
        require(msg.sender == registry, "ZNSR: Sender isnt registry");
        _;
    }

    constructor(address _registry){
        registry = _registry;
    }

    /**
     * @dev Resolves address given domain name hash
     * @param domainNameHash The identifying hash of a domain's name
     */
    function getAddress(bytes32 domainNameHash) external view returns(address){
        return addressOf[domainNameHash];
    }

    /**
     * @dev Sets the address of a domain name hash, only registry
     * @param domainNameHash The identifying hash of a domain's name
     * @param newAddress The new domain owner
     */
    function setAddress(bytes32 domainNameHash, address newAddress) external onlyRegistry{
        addressOf[domainNameHash] = newAddress;

        emit AddressSet(domainNameHash, newAddress);
    }

    function supportsInterface(bytes4 interfaceId)external view returns (bool){
        return interfaceId == RESOLVER_INTERFACE_ID; //pre-calculated interface ID
    }
}