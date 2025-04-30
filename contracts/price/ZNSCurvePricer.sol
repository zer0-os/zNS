// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IZNSCurvePricer } from "./IZNSCurvePricer.sol";
import { StringUtils } from "../utils/StringUtils.sol";
import { AAccessControlled } from "../access/AAccessControlled.sol";
import { ARegistryWired } from "../registry/ARegistryWired.sol";


/**
 * @title Implementation of the Curve Pricing, module that calculates the price of a domain
 * based on its length and the rules set by Zero ADMIN.
 * This module uses an hyperbolic curve that starts at (`baseLength`; `maxPrice`)
 * for all domains <= `baseLength`.
 * Then the price is reduced using the price calculation function below.
 * The price after `maxLength` is fixed and equals the price on the hyperbola graph at the point `maxLength`
 * and is determined using the formula where `length` = `maxLength`.
 */
contract ZNSCurvePricer is AAccessControlled, ARegistryWired, UUPSUpgradeable, IZNSCurvePricer {

    using StringUtils for string;

    /**
     * @notice Value used as a basis for percentage calculations,
     * since Solidity does not support fractions.
     */
    uint256 public constant PERCENTAGE_BASIS = 10000;

    /**
     * @notice Multiply the entire hyperbola formula by this number to be able to reduce the `curveMultiplier`
     * by 3 digits, which gives us more flexibility in defining the hyperbola function.
     * @dev > Canot be "0".
     */
    uint256 public constant FACTOR_SCALE = 1000;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Proxy initializer to set the initial state of the contract after deployment.
     * Only Owner of the 0x0 hash (Zero owned address) can call this function.
     * @dev > Note the for PriceConfig we set each value individually and calling
     * 2 important functions that validate all of the config's values against the formula:
     * - `setPrecisionMultiplier()` to validate precision multiplier
     * @param accessController_ the address of the ZNSAccessController contract.
     * @param registry_ the address of the ZNSRegistry contract.
     */
    function initialize(
        address accessController_,
        address registry_
        // CurvePriceConfig calldata zeroPriceConfig_
    ) external override initializer {
        _setAccessController(accessController_);
        _setRegistry(registry_);

        // TODO how / where do we set the 0x0 price config?
        // in root registrar init?
        // setPriceConfig(0x0, zeroPriceConfig_);
    }

    /**
     * @notice Real encoding happens off chain, but we keep this here as a
     * helper function for users to ensure that their data is correct
     * 
     * @param config The price config to encode
     */
    function encodeConfig(
        CurvePriceConfig calldata config
    ) external pure returns(bytes memory) {
        bytes32 maxPrice = bytes32(config.maxPrice);
        bytes32 curveMultiplier = bytes32(config.curveMultiplier);
        bytes32 maxLength = bytes32(config.maxLength);
        bytes32 baseLength = bytes32(config.baseLength);
        bytes32 precisionMultiplier = bytes32(config.precisionMultiplier);
        bytes32 feePercentage = bytes32(config.feePercentage);
        bytes32 isSet = bytes32(abi.encode(config.isSet)); // maybe dont need

        return
            abi.encodePacked(
                maxPrice,
                curveMultiplier,
                maxLength,
                baseLength,
                precisionMultiplier,
                feePercentage,
                isSet
            );
    }

    // todo move internal func when finished
    function _decodePriceConfig(
        bytes memory priceConfig
    ) internal pure returns(CurvePriceConfig memory) {
        (
            uint256 maxPrice,
            uint256 curveMultiplier,
            uint256 maxLength,
            uint256 baseLength,
            uint256 precisionMultiplier,
            uint256 feePercentage,
            bool isSet
        ) = abi.decode(
            priceConfig,
            (
                uint256,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256,
                bool
            )
        );

        CurvePriceConfig memory config = CurvePriceConfig(
            maxPrice,
            curveMultiplier,
            maxLength,
            baseLength,
            precisionMultiplier,
            feePercentage,
            isSet
        );

        return config;
    }

    function validatePriceConfig(
        bytes memory priceConfig
    ) external pure {
        CurvePriceConfig memory localConfig = _decodePriceConfig(priceConfig);

        _validatePrecisionMultiplier(localConfig.precisionMultiplier);
        _validateBaseLength(localConfig.baseLength, localConfig);
        _validateCurveMultiplier(localConfig.curveMultiplier, localConfig);
        _validateMaxLength(localConfig.maxLength, localConfig);
        _validateFeePercentage(localConfig.feePercentage);
    }

    /**
     * @notice Get the price of a given domain name
     * @dev `skipValidityCheck` param is added to provide proper revert when the user is
     * calling this to find out the price of a domain that is not valid. But in Registrar contracts
     * we want to do this explicitly and before we get the price to have lower tx cost for reverted tx.
     * So Registrars will pass this bool as "true" to not repeat the validity check.
     * Note that if calling this function directly to find out the price, a user should always pass "false"
     * as `skipValidityCheck` param, otherwise, the price will be returned for an invalid label that is not
     * possible to register.
     * @param parentPriceConfig The hash of the parent domain under which price is determined
     * @param label The label of the subdomain candidate to get the price for before/during registration
     * @param skipValidityCheck If true, skips the validity check for the label
     */
    function getPrice(
        bytes memory parentPriceConfig,
        string calldata label,
        bool skipValidityCheck
    ) public view override returns (uint256) {
        CurvePriceConfig memory config = _decodePriceConfig(parentPriceConfig);

        // TODO if still want/need isset leave this, otherwise delete
        // and just pass bytes to internal func to decode there
        // ideally if always set at the same time as pricerContract then shouldnt need
        // but need to be sure they cant be set separately first
        if (!config.isSet) revert ParentPriceConfigNotSet();

        if (!skipValidityCheck) {
            // Confirms string values are only [a-z0-9-]
            label.validate();
        }

        uint256 length = label.strlen();
        // No pricing is set for 0 length domains
        if (length == 0) return 0;

        return _getPrice(parentPriceConfig, length);
    }

    /**
     * @notice Part of the IZNSPricer interface - one of the functions required
     * for any pricing contracts used with ZNS. It returns fee for a given price
     * based on the value set by the owner of the parent domain.
     * @param parentHash The hash of the parent domain under which fee is determined
     * @param price The price to get the fee for
    */
    function getFeeForPrice(
        bytes32 parentHash,
        uint256 price
    ) public view override returns (uint256) {
        // todo
        // return (price * priceConfigs[parentHash].feePercentage) / PERCENTAGE_BASIS;
    }

    /**
     * @notice Part of the IZNSPricer interface - one of the functions required
     * for any pricing contracts used with ZNS. Returns both price and fee for a given label
     * under the given parent.
     * @param parentHash The hash of the parent domain under which price and fee are determined
     * @param label The label of the subdomain candidate to get the price and fee for before/during registration
    */
    function getPriceAndFee(
        bytes32 parentHash,
        string calldata label,
        bool skipValidityCheck
    ) external view override returns (uint256 price, uint256 stakeFee) {
        // TODO
        // price = getPrice(parentHash, label, skipValidityCheck);
        // stakeFee = getFeeForPrice(parentHash, price);
        // return (price, stakeFee);
    }

    // /**
    //  * @notice Setter for `priceConfigs[domainHash]`. Only domain owner/operator can call this function.
    //  * @dev Validates the value of the `precisionMultiplier`.
    //  * fires `PriceConfigSet` event.
    //  * Only the owner of the domain or an allowed operator can call this function.
    //  * > This function should ALWAYS be used to set the config, since it's the only place where `isSet` is set to true.
    //  * > Use the other individual setters to modify only, since they do not set this variable!
    //  * @param domainHash The domain hash to set the price config for
    //  * @param priceConfig The new price config to set
    //  */
    // function setPriceConfig(
    //     bytes32 domainHash,
    //     CurvePriceConfig calldata priceConfig
    // ) public override {

    //     // call to individual validations
    //     _validateSetPrecisionMultiplier(domainHash, priceConfig.precisionMultiplier);
    //     _validateSetBaseLength(domainHash, priceConfig.baseLength, priceConfig);
    //     priceConfigs[domainHash].maxPrice = priceConfig.maxPrice;
    //     _validateSetCurveMultiplier(domainHash, priceConfig.curveMultiplier, priceConfig);
    //     _validateSetMaxLength(domainHash, priceConfig.maxLength, priceConfig);
    //     _validateSetFeePercentage(domainHash, priceConfig.feePercentage);
    //     priceConfigs[domainHash].isSet = true;

    //     emit PriceConfigSet( // have this emit in registrar
    //         domainHash,
    //         priceConfig.maxPrice,
    //         priceConfig.curveMultiplier,
    //         priceConfig.maxLength,
    //         priceConfig.baseLength,
    //         priceConfig.precisionMultiplier,
    //         priceConfig.feePercentage
    //     );
    // }

    function _validateCurveMultiplier(
        uint256 curveMultiplier,
        CurvePriceConfig memory config
    ) internal pure {
        if (curveMultiplier == 0 && config.baseLength == 0)
            revert DivisionByZero();
    }

    function _validateBaseLength(
        uint256 baseLength,
        CurvePriceConfig memory config
    ) internal pure {
        if (config.maxLength < baseLength)
            revert MaxLengthSmallerThanBaseLength();

        if (baseLength == 0 && config.curveMultiplier == 0)
            revert DivisionByZero();
    }

    function _validateMaxLength(
        uint256 maxLength,
        CurvePriceConfig memory config
    ) internal pure {
        if (
            (maxLength < config.baseLength) ||
            maxLength == 0
        ) revert MaxLengthSmallerThanBaseLength();
    }

    function _validatePrecisionMultiplier(
        uint256 multiplier
    ) internal pure {
        if (multiplier == 0 || multiplier > 10**18) revert InvalidPrecisionMultiplierPassed();
    }

    function _validateFeePercentage(
        uint256 feePercentage
    ) internal pure {
        if (feePercentage > PERCENTAGE_BASIS)
            revert FeePercentageValueTooLarge(
                feePercentage,
                PERCENTAGE_BASIS
            );
    }

    /**
     * @notice Sets the registry address in state.
     * @dev This function is required for all contracts inheriting `ARegistryWired`.
    */
    function setRegistry(address registry_) external override(ARegistryWired, IZNSCurvePricer) onlyAdmin {
        _setRegistry(registry_);
    }

    /**
     * @notice Internal function to calculate price based on the config set,
     * and the length of the domain label.
     * @dev Before we calculate the price, 6 different cases are possible:
     * 1. `maxPrice` is 0, which means all subdomains under this parent are free
     * 2. `baseLength` is 0, which means prices for all domains = 0 (free).
     * 3. `length` is less or equal to `baseLength`, which means a domain will cost `maxPrice`
     * 4. `length` is greater than `maxLength`, which means a domain will cost price by fomula at `maxLength`
     * 5. The numerator can be less than the denominator, which is achieved by setting a huge value
     * for `curveMultiplier` or by decreasing the `baseLength` and `maxPrice`, which means all domains
     * which are longer than `baseLength` will be free.
     * 6. `curveMultiplier` is 0, which means all domains will cost `maxPrice`.
     *
     * The formula itself creates an hyperbolic curve that decreases in pricing based on domain name length,
     * base length, max price and curve multiplier.
     * `FACTOR_SCALE` allows to perceive `curveMultiplier` as fraction number in regular formula,
     * which helps to bend a curve of price chart.
     * The result is divided by the precision multiplier to remove numbers beyond
     * what we care about, then multiplied by the same precision multiplier to get the actual value
     * with truncated values past precision. So having a value of `15.235234324234512365 * 10^18`
     * with precision `2` would give us `15.230000000000000000 * 10^18`
     * @param priceConfig The parent price config
     * @param length The length of the domain name
     */
    function _getPrice(
        bytes memory priceConfig,
        uint256 length
    ) internal view returns (uint256) {
        // todo if we keep isset then this func takes in config struct itself
        CurvePriceConfig memory config = _decodePriceConfig(priceConfig);

        // We use `maxPrice` as 0 to indicate free domains
        if (config.maxPrice == 0) return 0;

        // Setting baseLength to 0 indicates to the system that we are
        // currently in a special phase where we define an exact price for all domains
        // e.g. promotions or sales
        if (length <= config.baseLength) return config.maxPrice;

        if (length > config.maxLength) length = config.maxLength;

        return ((config.baseLength * config.maxPrice * FACTOR_SCALE) /
        (config.baseLength * FACTOR_SCALE + config.curveMultiplier * (length - config.baseLength))) /
        config.precisionMultiplier * config.precisionMultiplier;
    }

    /**
     * @notice To use UUPS proxy we override this function and revert if `msg.sender` isn't authorized
     * @param newImplementation The new implementation contract to upgrade to.
     */
    // solhint-disable-next-line
    function _authorizeUpgrade(address newImplementation) internal view override {
        accessController.checkGovernor(msg.sender);
    }
}
