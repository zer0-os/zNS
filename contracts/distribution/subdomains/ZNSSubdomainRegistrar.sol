// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AZNSPayment } from "./abstractions/AZNSPayment.sol";
import { AZNSPricing } from "./abstractions/AZNSPricing.sol";
import { AZNSPricingWithFee } from "./abstractions/AZNSPricingWithFee.sol";
import { AZNSRefundablePayment } from "./abstractions/AZNSRefundablePayment.sol";
import { IZNSRegistry } from "../../registry/IZNSRegistry.sol";
import { IZNSRegistrar } from "../IZNSRegistrar.sol";
import { IZNSSubdomainRegistrar } from "./IZNSSubdomainRegistrar.sol";
import { AccessControlled } from "../../access/AccessControlled.sol";


contract ZNSSubdomainRegistrar is AccessControlled, IZNSSubdomainRegistrar {

    IZNSRegistry public registry;
    // TODO sub: change name of Registrar var and the contract also
    IZNSRegistrar public mainRegistrar;

    // TODO sub: make better name AND for the setter function !
    mapping(bytes32 domainHash => DistributionConfig) public distrConfigs;

    mapping(bytes32 domainHash =>
        mapping(address registrant => bool allowed)
    ) public distributionWhitelist;

    modifier onlyOwnerOperatorOrRegistrar(bytes32 domainHash) {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender)
            || accessController.isRegistrar(msg.sender),
            "ZNSSubdomainRegistrar: Not authorized"
        );
        _;
    }

    // TODO sub: proxy ??
    constructor(
        address _accessController,
        address _registry,
        address _registrar
    ) {
        _setAccessController(_accessController);
        // TODO sub: switch below to functions ??
        require(
            _registry != address(0),
            "ZNSSubdomainRegistrar: _registry can not be 0x0 address"
        );
        require(
            _registrar != address(0),
            "ZNSSubdomainRegistrar: _registrar can not be 0x0 address"
        );

        registry = IZNSRegistry(_registry);
        mainRegistrar = IZNSRegistrar(_registrar);
    }

    function registerSubdomain(
        bytes32 parentHash,
        string calldata label,
        address domainAddress,
        DistributionConfig calldata distrConfig
    ) external override {
        // TODO sub: make the order of ops better
        DistributionConfig memory parentConfig = distrConfigs[parentHash];
        require(
            parentConfig.accessType != AccessType.LOCKED
                || registry.isOwnerOrOperator(parentHash, msg.sender),
            "ZNSSubdomainRegistrar: Parent domain's distribution is locked"
        );

        if (parentConfig.accessType == AccessType.WHITELIST) {
            require(
                distributionWhitelist[parentHash][msg.sender],
                "ZNSSubdomainRegistrar: Sender is not whitelisted"
            );
        }

        bytes32 subdomainHash = hashWithParent(parentHash, label);

        require(
            !registry.exists(subdomainHash),
            "ZNSSubdomainRegistrar: Domain already exists"
        );

        uint256 price;
        uint256 fee;
        // TODO sub: can we make these abstract switching better ??
        if (parentConfig.pricingContract.feeEnforced()) {
            (price, fee) = AZNSPricingWithFee(address(parentConfig.pricingContract)).getPriceAndFee(
                parentHash,
                label
            );
        } else {
            price = parentConfig.pricingContract.getPrice(parentHash, label);
        }

        parentConfig.paymentContract.processPayment(
            parentHash,
            subdomainHash,
            msg.sender,
            price,
            fee
        );

        mainRegistrar.coreRegister(
            parentHash,
            subdomainHash,
            label,
            msg.sender,
            domainAddress
        );

        if (address(distrConfig.pricingContract) != address(0)
            && address(distrConfig.paymentContract) != address(0)) {
            // TODO sub: what is the best way to do this ??
            //      so that it can be done for root domain also
            setDistributionConfigForDomain(subdomainHash, distrConfig);
        }
    }

    function revokeSubdomain(bytes32 parentHash, bytes32 domainHash) external override {
        // TODO sub: optimize casting domainHash to uint256 !!!
        //  that is being done so many times here and in the main Registrar
        //  for a single operation

        // TODO sub: can this be combined with the same check in the Main Registrar ??
        require(
            mainRegistrar.isOwnerOf(domainHash, msg.sender, IZNSRegistrar.OwnerOf.BOTH),
            "ZNSSubdomainRegistrar: Not the owner of both Token and Name"
        );

        mainRegistrar.coreRevoke(domainHash);

        // TODO sub: do we store these as addresses or interfaces in the struct ??
        address paymentContract = address(distrConfigs[parentHash].paymentContract);

        if (AZNSPayment(paymentContract).refundsOnRevoke()) {
            // TODO sub: add solution with refund !!
            AZNSRefundablePayment(paymentContract).refund(
                parentHash,
                domainHash,
                msg.sender
            );
        }

        // TODO sub: should we clear the data from all other contracts (configs, etc.) ??
        //  can we even do this?
    }

    function hashWithParent(
        bytes32 parentHash,
        string calldata name
    ) public pure override returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                parentHash,
                keccak256(bytes(name))
            )
        );
    }

    function setDistributionConfigForDomain(
        bytes32 domainHash,
        DistributionConfig calldata config
    ) public override {
        setPricingContractForDomain(domainHash, config.pricingContract);
        setPaymentContractForDomain(domainHash, config.paymentContract);
        setAccessTypeForDomain(domainHash, config.accessType);
    }

    function setPricingContractForDomain(
        bytes32 domainHash,
        AZNSPricing pricingContract
    ) public override onlyOwnerOperatorOrRegistrar(domainHash) {
        require(
            address(pricingContract) != address(0),
            "ZNSSubdomainRegistrar: pricingContract can not be 0x0 address"
        );

        distrConfigs[domainHash].pricingContract = pricingContract;
        // TODO sub: emit event
    }

    function setPaymentContractForDomain(
        bytes32 domainHash,
        AZNSPayment paymentContract
    ) public override onlyOwnerOperatorOrRegistrar(domainHash) {
        require(
            address(paymentContract) != address(0),
            "ZNSSubdomainRegistrar: paymentContract can not be 0x0 address"
        );

        distrConfigs[domainHash].paymentContract = AZNSPayment(paymentContract);
        // TODO sub: emit event
    }

    function setAccessTypeForDomain(
        bytes32 domainHash,
        AccessType accessType
    ) public override onlyOwnerOperatorOrRegistrar(domainHash) {
        distrConfigs[domainHash].accessType = accessType;
        // TODO sub: emit event
    }

    // TODO sub: iron this out !!
    function setWhitelistForDomain(
        bytes32 domainHash,
        address registrant,
        bool allowed
    ) external override onlyOwnerOperatorOrRegistrar(domainHash) {
        distributionWhitelist[domainHash][registrant] = allowed;
        // TODO sub: emit event ??
    }

    function getAccessController() external view override(AccessControlled, IZNSSubdomainRegistrar) returns (address) {
        return address(accessController);
    }

    function setAccessController(address accessController_)
    external
    override(AccessControlled, IZNSSubdomainRegistrar)
    onlyAdmin {
        _setAccessController(accessController_);
    }
}
