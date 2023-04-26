// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IZNSDomainToken } from "./IZNSDomainToken.sol";
import "hardhat/console.sol";

/**
 * @title A contract for tokenizing domains under the ZNS Architecture
*/
contract ZNSDomainToken is ERC721, IZNSDomainToken {
  // TODO: change for proper name !
  // solhint-disable-next-line no-empty-blocks
  constructor() ERC721("ZNSDomainToken", "ZDT") {
    authorized[msg.sender] = true;
  }
  
  /**
  * @notice Track authorized users or contracts
  * TODO access control for the entire system
  */
  mapping(address user => bool isAuthorized) public authorized;

  /**
  * @notice Restrict a function to only be callable by authorized users
  */
  modifier onlyAuthorized() {
    console.log("Domain Token Authorized Check: %s, Sender: %s", authorized[msg.sender], msg.sender);
    require(authorized[msg.sender], "ZNS: Not authorized");
    _;
  }

  /**
   * @notice Authorize an address for this contract
   * @param account The registrar to set
   */
  function authorize(address account) external onlyAuthorized {
    console.log("Authorized: %s, Sender: %s", account);
    require(account != address(0), "ZNS: Zero address for authorized account");

    // Modify the access control for the given address
    authorized[account] = true;

    emit SetAuthorization(account);
  }

  /**
   * @notice Mints a token with a specified tokenId, using _safeMint, and sends it to the given address
   * @dev TODO: Add Access Control
   * @param to The address that will recieve the newly minted domain token
   * @param tokenId The TokenId that the caller wishes to mint/register
   */
  function register(address to, uint256 tokenId) external {
    _safeMint(to, tokenId);
  }

  /**
   * @notice Burns the token with the specified tokenId
   * @dev TODO: Add Access Control, replace require to also other specific contracts to revoke
   * @param tokenId The tokenId that the caller wishes to burn/revoke
   */
  function revoke(uint256 tokenId) external onlyAuthorized{
    _burn(tokenId);
  }
}
