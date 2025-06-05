// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


error ZeroAddressPassed();

error ZeroValuePassed();

error AddressIsNotAContract();

error DomainAlreadyExists(bytes32 domainHash);

error NotAuthorizedForDomain(address caller, bytes32 domainHash);

error NotFullDomainOwner(address caller, bytes32 domainHash);

error AlreadyFullOwner(address owner, bytes32 domainHash);
