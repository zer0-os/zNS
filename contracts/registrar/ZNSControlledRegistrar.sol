// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ARegistryWired } from "../registry/ARegistryWired.sol";
import { IZNSRootRegistrar, CoreRegisterArgs } from "./IZNSRootRegistrar.sol";
import { PaymentConfig } from "../treasury/IZNSTreasury.sol";
import { ZeroAddressPassed } from "../utils/CommonErrors.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


// TODO 15: delete this if not required
contract ZNSControlledRegistrar is ARegistryWired {
    IZNSRootRegistrar public rootRegistrar;

    bytes32 public immutable parentDomainHash;

    error DomainDoesntExist(bytes32 domainHash);

    constructor(
        address _rootRegistrar,
        address _registry,
        bytes32 _parentDomainHash
    ) {
        _setRegistry(_registry);

        if (_rootRegistrar == address(0))
            revert ZeroAddressPassed();
        rootRegistrar = IZNSRootRegistrar(_rootRegistrar);

        if (!registry.exists(parentDomainHash))
            revert DomainDoesntExist(parentDomainHash);
        parentDomainHash = _parentDomainHash;
    }

    function registerSubdomain(
        string calldata label,
        address owner,
        address domainAddress,
        string calldata tokenURI
    // TODO 15: should we use contract specific AC here or just keep using Registry?
    ) external onlyOwnerOrOperator(parentDomainHash) {
        // TODO 15: refactor this! see SubRegistrar.hashWithParent()
        bytes32 domainHash = keccak256(
            abi.encodePacked(
                parentDomainHash,
                keccak256(bytes(label))
            )
        );

        CoreRegisterArgs memory args = CoreRegisterArgs({
            parentHash: parentDomainHash,
            domainHash: domainHash,
            label: label,
            domainOwner: msg.sender,
            tokenOwner: owner,
            domainAddress: domainAddress,
            price: 0,
            stakeFee: 0,
            tokenURI: tokenURI,
            isStakePayment: false,
            paymentConfig: PaymentConfig({
                token: IERC20(address(0)),
                beneficiary: address(0)
            })
        });

        rootRegistrar.coreRegister(args);
    }

    // TODO 15: add revoke() !

    function setRegistry(
        address registry_
    // TODO 15: should we use contract specific AC here or just keep using Registry?
    ) external onlyOwnerOrOperator(parentDomainHash) override {
        _setRegistry(registry_);
    }
}
