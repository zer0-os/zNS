// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


error ZeroAddressPassed();

error DomainAlreadyExists(bytes32 domainHash);

error NotAuthorizedForDomain(address caller, bytes32 domainHash);

error WrongAccessControlAddress(address accessController);
