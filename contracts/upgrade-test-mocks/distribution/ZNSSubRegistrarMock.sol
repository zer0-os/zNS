// SPDX-License-Identifier: MIT
/* solhint-disable */
pragma solidity 0.8.26;

// solhint-disable
import { ZNSSubRegistrar } from "../../registrar/ZNSSubRegistrar.sol";
import { IZNSSubRegistrar } from "../../registrar/IZNSSubRegistrar.sol";
import { UpgradeMock } from "../UpgradeMock.sol";
import { IZNSPricer } from "../../types/IZNSPricer.sol";
import { IZNSRootRegistrar, CoreRegisterArgs } from "../../registrar/IZNSRootRegistrar.sol";
import { AAccessControlled } from "../../access/AAccessControlled.sol";
import { ARegistryWired } from "../../registry/ARegistryWired.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { StringUtils } from "../../utils/StringUtils.sol";
import { PaymentConfig } from "../../treasury/IZNSTreasury.sol";
import { NotAuthorizedForDomain, ZeroAddressPassed, DomainAlreadyExists } from "../../utils/CommonErrors.sol";


enum AccessType {
    LOCKED,
    OPEN,
    MINTLIST
}

enum PaymentType {
    DIRECT,
    STAKE
}

struct DistributionConfig {
    IZNSPricer pricerContract;
    PaymentType paymentType;
    AccessType accessType;
    address pricer;
    bytes priceConfig;
    bool isSet; // todo instead of isSet in individual priceconfig, need for mock?
    address newAddress;
    uint256 newUint;
}


contract ZNSSubRegistrarMainState {
    IZNSRootRegistrar public rootRegistrar;

    mapping(bytes32 domainHash => DistributionConfig config) public distrConfigs;

    struct Mintlist {
        mapping(uint256 idx => mapping(address candidate => bool allowed)) list;
        uint256 ownerIndex;
    }

    mapping(bytes32 domainHash => Mintlist mintStruct) public mintlist;
}


contract ZNSSubRegistrarUpgradeMock is
    AAccessControlled,
    ARegistryWired,
    UUPSUpgradeable,
    ZNSSubRegistrarMainState,
    UpgradeMock {
    using StringUtils for string;

    error ParentLockedOrDoesntExist(bytes32 parentHash);

    error SenderNotApprovedForPurchase(bytes32 parentHash, address sender);

    modifier onlyOwnerOperatorOrRegistrar(bytes32 domainHash) {
        if (
            !registry.isOwnerOrOperator(domainHash, msg.sender)
        && !accessController.isRegistrar(msg.sender)
        ) revert NotAuthorizedForDomain(msg.sender, domainHash);
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _accessController,
        address _registry,
        address _rootRegistrar
    ) external initializer {
        _setAccessController(_accessController);
        setRegistry(_registry);
        setRootRegistrar(_rootRegistrar);
    }

    function registerSubdomain(
        bytes32 parentHash,
        string calldata label,
        address domainAddress,
        string calldata tokenURI,
        DistributionConfig calldata distrConfig,
        PaymentConfig calldata paymentConfig
    ) external returns (bytes32) {
        // Confirms string values are only [a-z0-9-]
        label.validate();

        bytes32 domainHash = hashWithParent(parentHash, label);
        if (registry.exists(domainHash))
            revert DomainAlreadyExists(domainHash);

        DistributionConfig memory parentConfig = distrConfigs[parentHash];

        bool isOwnerOrOperator = registry.isOwnerOrOperator(parentHash, msg.sender);
        if (parentConfig.accessType == AccessType.LOCKED && !isOwnerOrOperator)
            revert ParentLockedOrDoesntExist(parentHash);

        if (parentConfig.accessType == AccessType.MINTLIST) {
            if (
                !mintlist[parentHash]
            .list
            [mintlist[parentHash].ownerIndex]
            [msg.sender]
            ) revert SenderNotApprovedForPurchase(parentHash, msg.sender);
        }

        CoreRegisterArgs memory coreRegisterArgs = CoreRegisterArgs({
            parentHash: parentHash,
            domainHash: domainHash,
            label: label,
            registrant: msg.sender,
            price: 0,
            stakeFee: 0,
            domainAddress: domainAddress,
            tokenURI: tokenURI,
            isStakePayment: parentConfig.paymentType == PaymentType.STAKE,
            paymentConfig: paymentConfig
        });

        if (!isOwnerOrOperator) {
            if (coreRegisterArgs.isStakePayment) {
                (coreRegisterArgs.price, coreRegisterArgs.stakeFee) = IZNSPricer(address(parentConfig.pricerContract))
                .getPriceAndFee(
                    parentHash,
                    label,
                    true
                );
            } else {
                coreRegisterArgs.price = IZNSPricer(address(parentConfig.pricerContract))
                    .getPrice(
                    parentConfig.priceConfig,
                    label,
                    true
                );
            }
        }

        rootRegistrar.coreRegister(coreRegisterArgs);

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

    function setDistributionConfigForDomain(
        bytes32 domainHash,
        DistributionConfig calldata config
    ) public onlyOwnerOperatorOrRegistrar(domainHash) {
        if (address(config.pricerContract) == address(0))
            revert ZeroAddressPassed();

        distrConfigs[domainHash] = config;
    }

    function setPricerContractForDomain(
        bytes32 domainHash,
        IZNSPricer pricerContract
    ) public {
        if (!registry.isOwnerOrOperator(domainHash, msg.sender))
            revert NotAuthorizedForDomain(msg.sender, domainHash);

        if (address(pricerContract) == address(0))
            revert ZeroAddressPassed();

        distrConfigs[domainHash].pricerContract = pricerContract;
    }

    function setPaymentTypeForDomain(
        bytes32 domainHash,
        PaymentType paymentType
    ) public {
        if (!registry.isOwnerOrOperator(domainHash, msg.sender))
            revert NotAuthorizedForDomain(msg.sender, domainHash);

        distrConfigs[domainHash].paymentType = paymentType;
    }

    function setAccessTypeForDomain(
        bytes32 domainHash,
        AccessType accessType
    ) public onlyOwnerOperatorOrRegistrar(domainHash) {
        distrConfigs[domainHash].accessType = accessType;
    }

    function updateMintlistForDomain(
        bytes32 domainHash,
        address[] calldata candidates,
        bool[] calldata allowed
    ) external {
        if (!registry.isOwnerOrOperator(domainHash, msg.sender))
            revert NotAuthorizedForDomain(msg.sender, domainHash);

        Mintlist storage mintlistForDomain = mintlist[domainHash];
        uint256 ownerIndex = mintlistForDomain.ownerIndex;

        for (uint256 i; i < candidates.length; i++) {
            mintlistForDomain.list[ownerIndex][candidates[i]] = allowed[i];
        }
    }

    function isMintlistedForDomain(
        bytes32 domainHash,
        address candidate
    ) external view returns (bool) {
        uint256 ownerIndex = mintlist[domainHash].ownerIndex;
        return mintlist[domainHash].list[ownerIndex][candidate];
    }

    function clearMintlistForDomain(bytes32 domainHash)
    public
    onlyOwnerOperatorOrRegistrar(domainHash) {
        mintlist[domainHash].ownerIndex = mintlist[domainHash].ownerIndex + 1;
    }

    function clearMintlistAndLock(bytes32 domainHash)
    external
    onlyOwnerOperatorOrRegistrar(domainHash) {
        setAccessTypeForDomain(domainHash, AccessType.LOCKED);
        clearMintlistForDomain(domainHash);
    }

    function setRegistry(address registry_) public override onlyAdmin {
        _setRegistry(registry_);
    }

    function setRootRegistrar(address registrar_) public onlyAdmin {
        if (registrar_ == address(0)) revert ZeroAddressPassed();
        rootRegistrar = IZNSRootRegistrar(registrar_);
    }

    // solhint-disable-next-line
    function _authorizeUpgrade(address newImplementation) internal view override {
        accessController.checkGovernor(msg.sender);
    }
}
