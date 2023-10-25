// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IZNSPricer } from "../types/IZNSPricer.sol";
import { IZNSRootRegistrar, CoreRegisterArgs } from "./IZNSRootRegistrar.sol";
import { IZNSSubRegistrar } from "./IZNSSubRegistrar.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";
import { ARegistryWired } from "../registry/ARegistryWired.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";


/**
 * @title ZNSSubRegistrar.sol - The contract for registering and revoking subdomains of zNS.
 * @dev This contract has the entry point for registering subdomains, but calls
 * the ZNSRootRegistrar back to finalize registration. Common logic for domains
 * of any level is in the `ZNSRootRegistrar.coreRegister()`.
*/
contract ZNSSubRegistrar is AAccessControlled, ARegistryWired, UUPSUpgradeable, IZNSSubRegistrar {

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
     * @notice Mapping of domainHash to mintlist set by the domain owner/operator.
     * These configs are used to determine who can register subdomains for every parent
     * in the case where parent's DistributionConfig.AccessType is set to AccessType.MINTLIST.
    */
    mapping(bytes32 domainHash => mapping(address candidate => bool allowed)) public override mintlist;

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
        address _rootRegistrar
    ) external override initializer {
        _setAccessController(_accessController);
        setRegistry(_registry);
        setRootRegistrar(_rootRegistrar);
    }

    /**
     * @notice Entry point to register a subdomain under a parent domain specified.
     * @dev Reads the `DistributionConfig` for the parent domain to determine how to distribute,
     * checks if the sender is allowed to register, check if subdomain is available,
     * acquires the price and other data needed to finalize the registration
     * and calls the `ZNSRootRegistrar.coreRegister()` to finalize.
     * @param parentHash The hash of the parent domain to register the subdomain under
     * @param label The label of the subdomain to register (e.g. in 0://zero.child the label would be "child").
     * @param domainAddress (optional) The address to which the subdomain will be resolved to
     * @param tokenURI (required) The tokenURI for the subdomain to be registered
     * @param distrConfig (optional) The distribution config to be set for the subdomain to set rules for children
    */
    function registerSubdomain(
        bytes32 parentHash,
        string calldata label,
        address domainAddress,
        string calldata tokenURI,
        DistributionConfig calldata distrConfig
    ) external override returns (bytes32) {
        bytes32 domainHash = hashWithParent(parentHash, label);
        require(
            !registry.exists(domainHash),
            "ZNSSubRegistrar: Subdomain already exists"
        );

        DistributionConfig memory parentConfig = distrConfigs[parentHash];

        bool isOwnerOrOperator = registry.isOwnerOrOperator(parentHash, msg.sender);
        require(
            parentConfig.accessType != AccessType.LOCKED || isOwnerOrOperator,
            "ZNSSubRegistrar: Parent domain's distribution is locked or parent does not exist"
        );

        if (parentConfig.accessType == AccessType.MINTLIST) {
            require(
                mintlist[parentHash][msg.sender],
                "ZNSSubRegistrar: Sender is not approved for purchase"
            );
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
            isStakePayment: parentConfig.paymentType == PaymentType.STAKE
        });

        if (!isOwnerOrOperator) {
            if (coreRegisterArgs.isStakePayment) {
                (coreRegisterArgs.price, coreRegisterArgs.stakeFee) = IZNSPricer(address(parentConfig.pricerContract))
                    .getPriceAndFee(
                        parentHash,
                        label
                    );
            } else {
                coreRegisterArgs.price = IZNSPricer(address(parentConfig.pricerContract))
                    .getPrice(
                        parentHash,
                        label
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
        // TODO audit question: is this a problem that we expect the simplest interface
        //  but are able set any of the derived ones ??
        //  Can someone by setting their own contract here introduce a vulnerability ??
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
    ) external override onlyOwnerOperatorOrRegistrar(domainHash) {
        _setAccessTypeForDomain(domainHash, accessType);
    }

    /**
     * @notice Setter for `mintlist[domainHash][candidate]`. Only domain owner/operator can call this function.
     * Adds or removes candidates from the mintlist for a domain. Should only be used when the domain's owner
     * wants to limit subdomain registration to a specific set of addresses.
     * Can be used to add/remove multiple candidates at once. Can only be called by the domain owner/operator.
     * Fires `MintlistUpdated` event.
     * @param domainHash The domain hash to set the mintlist for
     * @param candidates The array of candidates to add/remove
     * @param allowed The array of booleans indicating whether to add or remove the candidate
    */
    function updateMintlistForDomain(
        bytes32 domainHash,
        address[] calldata candidates,
        bool[] calldata allowed
    ) external override {
        require(
            registry.isOwnerOrOperator(domainHash, msg.sender),
            "ZNSSubRegistrar: Not authorized"
        );

        for (uint256 i; i < candidates.length; i++) {
            mintlist[domainHash][candidates[i]] = allowed[i];
        }

        emit MintlistUpdated(domainHash, candidates, allowed);
    }

    /**
     * @notice Sets the registry address in state.
     * @dev This function is required for all contracts inheriting `ARegistryWired`.
    */
    function setRegistry(address registry_) public override(ARegistryWired, IZNSSubRegistrar) onlyAdmin {
        _setRegistry(registry_);
    }

    /**
     * @notice Setter for `rootRegistrar`. Only admin can call this function.
     * Fires `RootRegistrarSet` event.
     * @param registrar_ The new address of the ZNSRootRegistrar contract
    */
    function setRootRegistrar(address registrar_) public override onlyAdmin {
        require(registrar_ != address(0), "ZNSSubRegistrar: _registrar can not be 0x0 address");
        rootRegistrar = IZNSRootRegistrar(registrar_);

        emit RootRegistrarSet(registrar_);
    }

    /**
     * @dev Internal function used by this contract to set the access type for a subdomain
     * during revocation process.
    */
    function _setAccessTypeForDomain(
        bytes32 domainHash,
        AccessType accessType
    ) internal {
        distrConfigs[domainHash].accessType = accessType;
        emit AccessTypeSet(domainHash, accessType);
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
