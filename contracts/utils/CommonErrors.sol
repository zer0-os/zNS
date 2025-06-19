// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


/**
 * @notice Revert when passing zero address.
 */
error ZeroAddressPassed();
/**
 * @notice Revert when passing zero value.
 */
error ZeroValuePassed();
/**
 * @notice This error is used to indicate that the provided address does not point to a contract,
 * which is often required for certain operations in smart contracts.
 */
error AddressIsNotAContract();
/**
 * @notice Revert when the domain is already registered.
 */
error DomainAlreadyExists(bytes32 domainHash);
/**
 * @notice Revert when caller is not authorized for the domain (not owner or operator or registrar).
 */
error NotAuthorizedForDomain(address caller, bytes32 domainHash);
/**
 * @notice Revert when the caller is not the true canonical owner of the domain - owner of hash in Registry
 * and owner of the tokenID in DomainToken.
 */
error NotFullDomainOwner(address caller, bytes32 domainHash);
/**
 * @notice Revert when the caller is already the full owner of the domain - owner of hash in Registry
 * and owner of the tokenID in DomainToken.
 */
error AlreadyFullOwner(address owner, bytes32 domainHash);
