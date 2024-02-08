// SPDX-License-Identifier: MIT
/* solhint-disable */
pragma solidity 0.8.18;

// solhint-disable
import { ZNSSubRegistrar } from "../../registrar/ZNSSubRegistrar.sol";
import { UpgradeMock } from "../UpgradeMock.sol";
import { IZNSPricer } from "../../types/IZNSPricer.sol";
import { IZNSRootRegistrar, CoreRegisterArgs } from "../../registrar/IZNSRootRegistrar.sol";
import { AAccessControlled } from "../../access/AAccessControlled.sol";
import { ARegistryWired } from "../../registry/ARegistryWired.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { StringUtils } from "../../utils/StringUtils.sol";
import { PaymentConfig } from "../../treasury/IZNSTreasury.sol";
import { IEIP712Helper } from "../../registrar/IEIP712Helper.sol";
import { EIP712Helper } from "../../registrar/EIP712Helper.sol";


enum AccessType {
    LOCKED,
    OPEN,
    MINTLIST
}

enum PaymentType {
    DIRECT,
    STAKE
}

struct RegistrationArgs {
    bytes32 parentHash;
    string label;
    string tokenURI;
    address domainAddress;
}

struct DistributionConfig {
    IZNSPricer pricerContract;
    PaymentType paymentType;
    AccessType accessType;
    address newAddress;
    uint256 newUint;
}


contract ZNSSubRegistrarMainState {

    IZNSRootRegistrar public rootRegistrar;

    mapping(bytes32 domainHash => DistributionConfig config) public distrConfigs;

    IEIP712Helper public eip712Helper;
}


contract ZNSSubRegistrarUpgradeMock is
    AAccessControlled,
    ARegistryWired,
    UUPSUpgradeable,
    ZNSSubRegistrarMainState,
    UpgradeMock {

    using StringUtils for string;

    modifier onlyOwnerOperatorOrRegistrar(bytes32 domainHash) {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender)
            || accessController.isRegistrar(msg.sender),
            "ZNSSubRegistrar: Not authorized"
        );
        _;
    }

    function initialize(
        address _accessController,
        address _registry,
        address _rootRegistrar
    ) external initializer {
        _setAccessController(_accessController);
        eip712Helper = new EIP712Helper("ZNS", "1");
        setRegistry(_registry);
        setRootRegistrar(_rootRegistrar);
    }

    function registerSubdomain(
        RegistrationArgs calldata args,
        DistributionConfig calldata distrConfig,
        PaymentConfig calldata paymentConfig,
        bytes memory signature
    ) external returns (bytes32) { // TODO replace override again
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

    function hashWithParent(
        bytes32 parentHash,
        string calldata label
    ) public pure returns (bytes32) {
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
    ) public view returns (address) {
        return eip712Helper.recoverSigner(coupon, signature);
    }

    // // TODO temporary while the fixes for zdc haven't been added
    function getEIP712AHelperAddress() public view returns (address) {
        return address(eip712Helper);
    }

    function setDistributionConfigForDomain(
        bytes32 domainHash,
        DistributionConfig calldata config
    ) public onlyOwnerOperatorOrRegistrar(domainHash) {
        require(
            address(config.pricerContract) != address(0),
            "ZNSSubRegistrar: pricerContract can not be 0x0 address"
        );

        distrConfigs[domainHash] = config;
    }

    function setPricerContractForDomain(
        bytes32 domainHash,
        IZNSPricer pricerContract
    ) public {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender),
            "ZNSSubRegistrar: Not authorized"
        );

        require(
            address(pricerContract) != address(0),
            "ZNSSubRegistrar: pricerContract can not be 0x0 address"
        );

        distrConfigs[domainHash].pricerContract = pricerContract;
    }

    function setPaymentTypeForDomain(
        bytes32 domainHash,
        PaymentType paymentType
    ) public {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender),
            "ZNSSubRegistrar: Not authorized"
        );

        distrConfigs[domainHash].paymentType = paymentType;
    }

    function _setAccessTypeForDomain(
        bytes32 domainHash,
        AccessType accessType
    ) internal {
        distrConfigs[domainHash].accessType = accessType;
    }

    function setAccessTypeForDomain(
        bytes32 domainHash,
        AccessType accessType
    ) external onlyOwnerOperatorOrRegistrar(domainHash) {
        _setAccessTypeForDomain(domainHash, accessType);
    }

    function setRegistry(address registry_) public override onlyAdmin {
        _setRegistry(registry_);
    }

    function setEIP712Helper(address helper) public onlyAdmin {
        require(helper != address(0), "ZNSSubRegistrar: EIP712Helper can not be 0x0 address");
        eip712Helper = IEIP712Helper(helper);
    }

    function setRootRegistrar(address registrar_) public onlyAdmin {
        require(registrar_ != address(0), "ZNSSubRegistrar: _registrar can not be 0x0 address");
        rootRegistrar = IZNSRootRegistrar(registrar_);
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
