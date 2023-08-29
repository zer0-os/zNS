// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { AZNSPayment } from "./abstractions/AZNSPayment.sol";
import { AZNSPricing } from "./abstractions/AZNSPricing.sol";
import { AZNSPricingWithFee } from "./abstractions/AZNSPricingWithFee.sol";
import { AZNSRefundablePayment } from "./abstractions/AZNSRefundablePayment.sol";
import { IZNSRegistry } from "../../registry/IZNSRegistry.sol";
import { IZNSRegistrar, CoreRegisterArgs } from "../IZNSRegistrar.sol";
import { IZNSSubdomainRegistrar } from "./IZNSSubdomainRegistrar.sol";
import { AAccessControlled } from "../../access/AAccessControlled.sol";
import { ARegistryWired } from "../../abstractions/ARegistryWired.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract ZNSSubdomainRegistrar is AAccessControlled, ARegistryWired, IZNSSubdomainRegistrar {
    // TODO sub: change name of Registrar contract
    IZNSRegistrar public rootRegistrar;

    // TODO sub: make better name AND for the setter function !
    mapping(bytes32 domainHash => DistributionConfig config) public distrConfigs;

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
        address _rootRegistrar
    ) {
        _setAccessController(_accessController);
        setRegistry(_registry);
        setRootRegistrar(_rootRegistrar);
    }

    function registerSubdomain(
        bytes32 parentHash,
        string calldata label,
        address domainAddress,
        DistributionConfig calldata distrConfig
    ) external override returns (bytes32) {
        // TODO sub: make the order of ops better
        DistributionConfig memory parentConfig = distrConfigs[parentHash];

        bool isOwnerOrOperator = registry.isOwnerOrOperator(parentHash, msg.sender);
        require(
            parentConfig.accessType != AccessType.LOCKED || isOwnerOrOperator,
            "ZNSSubdomainRegistrar: Parent domain's distribution is locked"
        );

        if (parentConfig.accessType == AccessType.WHITELIST) {
            require(
                distributionWhitelist[parentHash][msg.sender],
                "ZNSSubdomainRegistrar: Sender is not whitelisted"
            );
        }

        CoreRegisterArgs memory coreRegisterArgs = CoreRegisterArgs({
            parentHash: parentHash,
            domainHash: hashWithParent(parentHash, label),
            label: label,
            registrant: msg.sender,
            beneficiary: address(0),
            paymentToken: IERC20(address(0)),
            price: 0,
            stakeFee: 0,
            domainAddress: domainAddress,
            isStakePayment: parentConfig.paymentConfig.paymentType == PaymentType.STAKE
        });

        require(
            !registry.exists(coreRegisterArgs.domainHash),
            "ZNSSubdomainRegistrar: Subdomain already exists"
        );

        if (!isOwnerOrOperator) {
            // TODO sub: can we make this abstract switching better ??
            // TODO sub: should we eliminate Pricing with not fee abstract at all??
            //  what are the downsides of this?? We can just make fees 0 in any contract
            //  would that make us pay more gas for txes with no fees?
            if (parentConfig.paymentConfig.paymentType == PaymentType.STAKE) {
                (coreRegisterArgs.price, coreRegisterArgs.stakeFee) = AZNSPricingWithFee(address(parentConfig.pricingContract))
                    .getPriceAndFee(
                        parentHash,
                        label
                    );
            } else {
                //  stakeFee is not taken into account for direct payment even if set on pricing contract
                coreRegisterArgs.price = parentConfig.pricingContract.getPrice(parentHash, label);
            }

            (
                coreRegisterArgs.paymentToken,
                coreRegisterArgs.beneficiary
            ) = (
                parentConfig.paymentConfig.paymentToken,
                parentConfig.paymentConfig.beneficiary
            );
        }

        rootRegistrar.coreRegister(coreRegisterArgs);

        if (address(distrConfig.pricingContract) != address(0)) {
            setDistributionConfigForDomain(coreRegisterArgs.domainHash, distrConfig);
        }

        return coreRegisterArgs.domainHash;
    }

    function revokeSubdomain(bytes32 parentHash, bytes32 domainHash) external override {
        // TODO sub: can this be combined with the same check in the Main Registrar ??
        require(
            rootRegistrar.isOwnerOf(domainHash, msg.sender, IZNSRegistrar.OwnerOf.BOTH),
            "ZNSSubdomainRegistrar: Not the owner of both Name and Token"
        );

        _setAccessTypeForDomain(domainHash, AccessType.LOCKED);
        rootRegistrar.coreRevoke(domainHash, msg.sender);

        // TODO sub: should we clear the data from all other contracts (configs, etc.) ??
        //  can we even do this?
    }

    function hashWithParent(
        bytes32 parentHash,
        string calldata label
    ) public pure override returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                parentHash,
                keccak256(bytes(label))
            )
        );
    }

    function setDistributionConfigForDomain(
        bytes32 domainHash,
        DistributionConfig calldata config
    ) public override {
        setPricingContractForDomain(domainHash, config.pricingContract);
        setPaymentConfigForDomain(domainHash, config.paymentConfig);
        _setAccessTypeForDomain(domainHash, config.accessType);
    }

    function setPricingContractForDomain(
        bytes32 domainHash,
        // TODO sub: is this a problem that we expect the simplest interface
        //  but can set any of the derived ones ??
        AZNSPricing pricingContract
    ) public override onlyOwnerOperatorOrRegistrar(domainHash) {
        require(
            address(pricingContract) != address(0),
            "ZNSSubdomainRegistrar: pricingContract can not be 0x0 address"
        );

        distrConfigs[domainHash].pricingContract = pricingContract;

        emit PricingContractSet(domainHash, address(pricingContract));
    }

    // TODO sub fee: add individual methods to set internal config values !!!
    function setPaymentConfigForDomain(
        bytes32 domainHash,
        PaymentConfig calldata config
    ) public override onlyOwnerOperatorOrRegistrar(domainHash) {
        require(
            address(config.paymentToken) != address(0),
            "ZNSSubdomainRegistrar: paymentToken can not be 0x0 address"
        );
        require(
            config.beneficiary != address(0),
            "ZNSSubdomainRegistrar: beneficiary can not be 0x0 address"
        );

        distrConfigs[domainHash].paymentConfig = config;
        // TODO sub fee: fix this event or create new ones for every field !!!
        // this is incorrect now !! fix !!
        emit PaymentContractSet(domainHash, address(config.paymentToken));
    }

    function _setAccessTypeForDomain(
        bytes32 domainHash,
        // TODO sub: test that we can not set the value larger
        //  than possible values for the enum
        AccessType accessType
    ) internal {
        distrConfigs[domainHash].accessType = accessType;
        emit AccessTypeSet(domainHash, accessType);
    }

    function setAccessTypeForDomain(
        bytes32 domainHash,
        AccessType accessType
    ) external override onlyOwnerOperatorOrRegistrar(domainHash) {
        _setAccessTypeForDomain(domainHash, accessType);
    }

    // TODO sub: iron this out !!
    function setWhitelistForDomain(
        bytes32 domainHash,
        address registrant,
        bool allowed
        // TODO sub: should we allow Registrar role to call this ??
        //  if so - why ?? what can we call from there ??
        //  should we cut Registrar out of this ??
    ) external override onlyOwnerOperatorOrRegistrar(domainHash) {
        distributionWhitelist[domainHash][registrant] = allowed;

        emit WhitelistUpdated(domainHash, registrant, allowed);
    }

    function setRegistry(address registry_) public override(ARegistryWired, IZNSSubdomainRegistrar) onlyAdmin {
        _setRegistry(registry_);
    }

    function setRootRegistrar(address registrar_) public override onlyAdmin {
        require(registrar_ != address(0), "ZNSSubdomainRegistrar: _registrar can not be 0x0 address");
        rootRegistrar = IZNSRegistrar(registrar_);

        emit RootRegistrarSet(registrar_);
    }

    // TODO sub fee: do we need these getters ???
    function getPricingContractForDomain(bytes32 domainHash) external view returns (AZNSPricing) {
        return distrConfigs[domainHash].pricingContract;
    }

    function getAccessTypeForDomain(bytes32 domainHash) external view returns (AccessType) {
        return distrConfigs[domainHash].accessType;
    }

    function getAccessController() external view override(AAccessControlled, IZNSSubdomainRegistrar) returns (address) {
        return address(accessController);
    }

    function setAccessController(address accessController_)
    external
    override(AAccessControlled, IZNSSubdomainRegistrar)
    onlyAdmin {
        _setAccessController(accessController_);
    }
}
