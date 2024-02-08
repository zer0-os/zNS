// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import { IZNSPricer } from "../types/IZNSPricer.sol";
import { IZNSRootRegistrar, CoreRegisterArgs } from "./IZNSRootRegistrar.sol";
import { IZNSSubRegistrar } from "./IZNSSubRegistrar.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";
import { ARegistryWired } from "../registry/ARegistryWired.sol";
import { StringUtils } from "../utils/StringUtils.sol";
import { PaymentConfig } from "../treasury/IZNSTreasury.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IEIP712Helper } from "./IEIP712Helper.sol";

/**
 * @title ZNSSubRegistrar.sol - The contract for registering and revoking subdomains of zNS.
 * @dev This contract has the entry point for registering subdomains, but calls
 * the ZNSRootRegistrar back to finalize registration. Common logic for domains
 * of any level is in the `ZNSRootRegistrar.coreRegister()`.
*/
contract ZNSSubRegistrar is AAccessControlled, ARegistryWired, UUPSUpgradeable, IZNSSubRegistrar {
    using StringUtils for string;

    /**
     * @notice State var for the ZNSRootRegistrar contract that finalizes registration of subdomains.
    */
    IZNSRootRegistrar public rootRegistrar;

    /**
     * @notice Mapping of domainHash to distribution config set by the domain owner/operator.
     * These configs are used to determine how subdomains are distributed for every parent.
     * @dev Note that the rules outlined in the DistributionConfig are only applied to direct children!
    */
    mapping(bytes32 domainHash => DistributionConfig config) public override distrConfigs;

    /**
     * @notice Helper for mintlist coupon creation
     */
    IEIP712Helper public eip712Helper;

    modifier onlyOwnerOperatorOrRegistrar(bytes32 domainHash) {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender)
            || accessController.isRegistrar(msg.sender),
            "ZNSSubRegistrar: Not authorized"
        );
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _accessController,
        address _registry,
        address _rootRegistrar,
        address _eip712Helper
    ) external override initializer {
        _setAccessController(_accessController);
        setRegistry(_registry);
        setRootRegistrar(_rootRegistrar);
        setEIP712Helper(_eip712Helper);
    }

    /**
     * @notice Entry point to register a subdomain under a parent domain specified.
     * @dev Reads the `DistributionConfig` for the parent domain to determine how to distribute,
     * checks if the sender is allowed to register, check if subdomain is available,
     * acquires the price and other data needed to finalize the registration
     * and calls the `ZNSRootRegistrar.coreRegister()` to finalize.
     * @ args parentHash The hash of the parent domain to register the subdomain under
     * @ args label The label of the subdomain to register (e.g. in 0://zero.child the label would be "child").
     * @ args domainAddress (optional) The address to which the subdomain will be resolved to
     * @ args tokenURI (required) The tokenURI for the subdomain to be registered
     * @param args The above args packed into a struct
     * @param distrConfig (optional) The distribution config to be set for the subdomain to set rules for children
     * @param paymentConfig (optional) Payment config for the domain to set on ZNSTreasury in the same tx
     * @param signature (optional) The signed message to validate the mintlist claim, if needed
     *  > `paymentConfig` has to be fully filled or all zeros. It is optional as a whole,
     *  but all the parameters inside are required.
    */
    function registerSubdomain(
        RegistrationArgs calldata args,
        DistributionConfig calldata distrConfig,
        PaymentConfig calldata paymentConfig,
        bytes memory signature
    ) external override returns (bytes32) {
        // Confirms string values are only [a-z0-9-]
        args.label.validate();

        bytes32 domainHash = hashWithParent(args.parentHash, args.label);
        require(
            !registry.exists(domainHash),
            "ZNSSubRegistrar: Subdomain already exists"
        );

        DistributionConfig memory parentConfig = distrConfigs[args.parentHash];

        bool isOwnerOrOperator = registry.isOwnerOrOperator(args.parentHash, msg.sender);
        require(
            parentConfig.accessType != AccessType.LOCKED || isOwnerOrOperator,
            "ZNSSubRegistrar: Parent domain's distribution is locked or parent does not exist"
        );

        // Not possible to spoof coupons meant for other users if we form data here with msg.sender
        if (parentConfig.accessType == AccessType.MINTLIST) {
            IEIP712Helper.Coupon memory coupon = IEIP712Helper.Coupon({
                parentHash: args.parentHash,
                registrantAddress: msg.sender,
                domainLabel: args.label
            });

            // If the generated coupon data is incorrect in any way, the wrong address is recovered
            // and this will fail the registration here.
            require(
                rootRegistrar.isOwnerOf(args.parentHash, msg.sender, IZNSRootRegistrar.OwnerOf.BOTH)
                ||
                eip712Helper.isCouponSigner(coupon, signature),
                "ZNSSubRegistrar: Invalid claim for mintlist"
            );
        }

        CoreRegisterArgs memory coreRegisterArgs = CoreRegisterArgs({
            parentHash: args.parentHash,
            domainHash: domainHash,
            label: args.label,
            registrant: msg.sender,
            price: 0,
            stakeFee: 0,
            domainAddress: args.domainAddress,
            tokenURI: args.tokenURI,
            isStakePayment: parentConfig.paymentType == PaymentType.STAKE,
            paymentConfig: paymentConfig
        });

        if (!isOwnerOrOperator) {
            if (coreRegisterArgs.isStakePayment) {
                (coreRegisterArgs.price, coreRegisterArgs.stakeFee) = IZNSPricer(address(parentConfig.pricerContract))
                    .getPriceAndFee(
                        args.parentHash,
                        args.label,
                        true
                    );
            } else {
                coreRegisterArgs.price = IZNSPricer(address(parentConfig.pricerContract))
                    .getPrice(
                        args.parentHash,
                        args.label,
                        true
                    );
            }
        }

        rootRegistrar.coreRegister(coreRegisterArgs);

        // ! note that the config is set ONLY if ALL values in it are set, specifically,
        // without pricerContract being specified, the config will NOT be set
        if (address(distrConfig.pricerContract) != address(0)) {
            setDistributionConfigForDomain(coreRegisterArgs.domainHash, distrConfig);
        }

        return domainHash;
    }

    /**
     * @notice Helper function to hash a child label with a parent domain hash.
    */
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

    // Receive the coupon already formed
    function recoverSigner(
        IEIP712Helper.Coupon memory coupon,
        bytes memory signature
    ) public view override returns (address) {
        return eip712Helper.recoverSigner(coupon, signature);
    }

    /**
     * @notice Setter for `distrConfigs[domainHash]`.
     * Only domain owner/operator or ZNSRootRegistrar can call this function.
     * @dev This config can be changed by the domain owner/operator at any time or be set
     * after registration if the config was not provided during the registration.
     * Fires `DistributionConfigSet` event.
     * @param domainHash The domain hash to set the distribution config for
     * @param config The new distribution config to set (for config fields see `IDistributionConfig.sol`)
    */
    function setDistributionConfigForDomain(
        bytes32 domainHash,
        DistributionConfig calldata config
    ) public override onlyOwnerOperatorOrRegistrar(domainHash) {
        require(
            address(config.pricerContract) != address(0),
            "ZNSSubRegistrar: pricerContract can not be 0x0 address"
        );

        distrConfigs[domainHash] = config;

        emit DistributionConfigSet(
            domainHash,
            config.pricerContract,
            config.paymentType,
            config.accessType
        );
    }

    /**
     * @notice One of the individual setters for `distrConfigs[domainHash]`. Sets `pricerContract` field of the struct.
     * Made to be able to set the pricer contract for a domain without setting the whole config.
     * Only domain owner/operator can call this function.
     * Fires `PricerContractSet` event.
     * @param domainHash The domain hash to set the pricer contract for
     * @param pricerContract The new pricer contract to set
    */
    function setPricerContractForDomain(
        bytes32 domainHash,
        IZNSPricer pricerContract
    ) public override {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender),
            "ZNSSubRegistrar: Not authorized"
        );

        require(
            address(pricerContract) != address(0),
            "ZNSSubRegistrar: pricerContract can not be 0x0 address"
        );

        distrConfigs[domainHash].pricerContract = pricerContract;

        emit PricerContractSet(domainHash, address(pricerContract));
    }

    /**
     * @notice One of the individual setters for `distrConfigs[domainHash]`. Sets `paymentType` field of the struct.
     * Made to be able to set the payment type for a domain without setting the whole config.
     * Only domain owner/operator can call this function.
     * Fires `PaymentTypeSet` event.
     * @param domainHash The domain hash to set the payment type for
     * @param paymentType The new payment type to set
    */
    function setPaymentTypeForDomain(
        bytes32 domainHash,
        PaymentType paymentType
    ) public override {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender),
            "ZNSSubRegistrar: Not authorized"
        );

        distrConfigs[domainHash].paymentType = paymentType;

        emit PaymentTypeSet(domainHash, paymentType);
    }

    /**
     * @notice One of the individual setters for `distrConfigs[domainHash]`. Sets `accessType` field of the struct.
     * Made to be able to set the access type for a domain without setting the whole config.
     * Only domain owner/operator or ZNSRootRegistrar can call this function.
     * Fires `AccessTypeSet` event.
     * @param domainHash The domain hash to set the access type for
     * @param accessType The new access type to set
    */
    function setAccessTypeForDomain(
        bytes32 domainHash,
        AccessType accessType
    ) public override onlyOwnerOperatorOrRegistrar(domainHash) {
        distrConfigs[domainHash].accessType = accessType;
        emit AccessTypeSet(domainHash, accessType);
    }

    /**
     * @notice Sets the registry address in state.
     * @dev This function is required for all contracts inheriting `ARegistryWired`.
    */
    function setRegistry(address registry) public override(ARegistryWired, IZNSSubRegistrar) onlyAdmin {
        _setRegistry(registry);
    }

    /**
     * @notice Set the helper used in cryptographic signing of mintlist data
     * @param helper The address of the EIP712 helper to set
     */
    function setEIP712Helper(address helper) public override onlyAdmin {
        require(helper != address(0), "ZNSSubRegistrar: EIP712Helper can not be 0x0 address");
        eip712Helper = IEIP712Helper(helper);
    }

    /**
     * @notice Setter for `rootRegistrar`. Only admin can call this function.
     * Fires `RootRegistrarSet` event.
     * @param registrar The new address of the ZNSRootRegistrar contract
    */
    function setRootRegistrar(address registrar) public override onlyAdmin {
        require(registrar != address(0), "ZNSSubRegistrar: _registrar can not be 0x0 address");
        rootRegistrar = IZNSRootRegistrar(registrar);

        emit RootRegistrarSet(registrar);
    }

    /**
     * @notice To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized
     * @param newImplementation The implementation contract to upgrade to
     */
    // solhint-disable-next-line
    function _authorizeUpgrade(address newImplementation) internal view override {
        accessController.checkGovernor(msg.sender);
    }
}
