// SPDX-License-Identifier: MIT
/* solhint-disable */
pragma solidity 0.8.26;

// solhint-disable
import { ZNSSubRegistrar } from "../../registrar/ZNSSubRegistrar.sol";
import { IZNSSubRegistrar } from "../../registrar/IZNSSubRegistrar.sol";
import { UpgradeMock } from "../UpgradeMock.sol";
import { IZNSPricer } from "../../price/IZNSPricer.sol";
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
    bytes priceConfig;
    PaymentType paymentType;
    AccessType accessType;
    address newAddress;
    uint256 newUint;
}

struct SubdomainRegisterArgs {
    bytes32 parentHash;
    string label;
    address domainAddress;
    address tokenOwner;
    string tokenURI;
    DistributionConfig distrConfig;
    PaymentConfig paymentConfig;
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

    function registerSubdomain(SubdomainRegisterArgs calldata regArgs) external returns (bytes32) {
        address domainRecordOwner = msg.sender;
        address parentOwner = registry.getDomainOwner(regArgs.parentHash);
        bool isOwner = msg.sender == parentOwner;
        bool isOperator = registry.isOperatorFor(msg.sender, parentOwner);

        DistributionConfig storage parentConfig = distrConfigs[regArgs.parentHash];

        if (parentConfig.accessType == AccessType.LOCKED) {
            if (!isOwner && !isOperator) {
                revert ParentLockedOrDoesntExist(regArgs.parentHash);
            } else if (isOperator) {
                domainRecordOwner = parentOwner;
            }
        } else if (parentConfig.accessType == AccessType.MINTLIST) {
            if (
                !mintlist[regArgs.parentHash]
            .list
            [mintlist[regArgs.parentHash].ownerIndex]
            [msg.sender]
            ) revert SenderNotApprovedForPurchase(regArgs.parentHash, msg.sender);
        }

        bytes32 domainHash = hashWithParent(regArgs.parentHash, regArgs.label);

        CoreRegisterArgs memory coreRegisterArgs = CoreRegisterArgs({
            parentHash: regArgs.parentHash,
            domainHash: domainHash,
            label: regArgs.label,
            domainOwner: domainRecordOwner,
            tokenOwner: regArgs.tokenOwner == address(0) ? domainRecordOwner : regArgs.tokenOwner,
            price: 0,
            stakeFee: 0,
            domainAddress: regArgs.domainAddress,
            tokenURI: regArgs.tokenURI,
            isStakePayment: parentConfig.paymentType == PaymentType.STAKE,
            paymentConfig: regArgs.paymentConfig
        });

        if (!isOwner && !isOperator) {
            if (coreRegisterArgs.isStakePayment) {
                (coreRegisterArgs.price, coreRegisterArgs.stakeFee) = IZNSPricer(address(parentConfig.pricerContract))
                .getPriceAndFee(
                    parentConfig.priceConfig,
                    regArgs.label,
                    true
                );
            } else {
                coreRegisterArgs.price = IZNSPricer(address(parentConfig.pricerContract))
                    .getPrice(
                    parentConfig.priceConfig,
                    regArgs.label,
                    true
                );
            }
        }

        rootRegistrar.coreRegister(coreRegisterArgs);

        // ! note that the config is set ONLY if ALL values in it are set, specifically,
        // without pricerContract being specified, the config will NOT be set
        if (address(regArgs.distrConfig.pricerContract) != address(0)) {
            setDistributionConfigForDomain(coreRegisterArgs.domainHash, regArgs.distrConfig);
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

    function setPricerDataForDomain(
        bytes32 domainHash,
        bytes memory config,
        IZNSPricer pricerContract
    ) public {
        if (!registry.isOwnerOrOperator(domainHash, msg.sender))
            revert NotAuthorizedForDomain(msg.sender, domainHash);

        if (address(pricerContract) == address(0))
            revert ZeroAddressPassed();

        IZNSPricer(pricerContract).validatePriceConfig(config);

        distrConfigs[domainHash].pricerContract = pricerContract;
        distrConfigs[domainHash].priceConfig = config;
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
