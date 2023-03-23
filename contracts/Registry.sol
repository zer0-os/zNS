// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract Registry {
  uint public number;
  bytes32 public baseNode; // The namehash of the TLD (eg, wilder.)
  mapping(bytes32 => address) public addressOf;
  
  ///@notice A placeholder registration function for an example of the namehash process
  ///@notice This function is not complete, it doesnt perform all the necessary safety checks and logic it should eventually perform
  ///@param namehash The namehash of the human-readable name
  ///@param registrant The address to give ownership of the domain
  function register(string memory namehash, address registrant) external {
    bytes32 node = keccak256(bytes(namehash));
    bytes32 nodeHash = keccak256(abi.encodePacked(baseNode, node));

    require(addressOf[nodeHash] == address(0));

    addressOf[nodeHash] = registrant;
  }

  function getAddressByNamehash(string memory namehash) public view returns(address){
    bytes32 node = keccak256(bytes(namehash));
    bytes32 nodeHash = keccak256(abi.encodePacked(baseNode, node));
    return addressOf[nodeHash];
  }
}
