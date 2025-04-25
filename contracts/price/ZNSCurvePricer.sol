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

    /**
     * @notice Mapping of domainHash to the price config for that domain set by the parent domain owner.
     * @dev Zero, for pricing root domains, uses this mapping as well under 0x0 hash.
    */
    mapping(bytes32 domainHash => CurvePriceConfig config) public priceConfigs;

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
     * @param zeroPriceConfig_ a number of variables that participate in the price calculation for subdomains.
     */
    function initialize(
        address accessController_,
        address registry_,
        CurvePriceConfig calldata zeroPriceConfig_
    ) external override initializer {
        _setAccessController(accessController_);
        _setRegistry(registry_);

        setPriceConfig(0x0, zeroPriceConfig_);
    }

    bytes public data;
    function encodeConfig(
        CurvePriceConfig calldata config
    ) external {
        bytes32 maxPrice = bytes32(config.maxPrice);
        bytes32 curveMultiplier = bytes32(config.curveMultiplier);
        bytes32 maxLength = bytes32(config.maxLength);
        bytes32 baseLength = bytes32(config.baseLength);
        bytes32 precisionMultiplier = bytes32(config.precisionMultiplier);
        bytes32 feePercentage = bytes32(config.feePercentage);
        bytes32 isSet = bytes32(abi.encode(config.isSet));


        // TODO hash with salt? then can unhash when decode?
        data =
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

    function decodeConfig(
        bytes calldata inData
    ) external pure returns (CurvePriceConfig memory config) {
        (
            uint256 maxPrice,
            uint256 curveMultiplier,
            uint256 maxLength,
            uint256 baseLength,
            uint256 precisionMultiplier,
            uint256 feePercentage,
            bool isSet
        ) = abi.decode(
            inData,
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

        CurvePriceConfig memory localConfig = CurvePriceConfig(
            maxPrice,
            curveMultiplier,
            maxLength,
            baseLength,
            precisionMultiplier,
            feePercentage,
            isSet
        );

        return localConfig;
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
     * @param parentHash The hash of the parent domain under which price is determined
     * @param label The label of the subdomain candidate to get the price for before/during registration
     * @param skipValidityCheck If true, skips the validity check for the label
     */
    function getPrice(
        bytes32 parentHash,
        string calldata label,
        bool skipValidityCheck
    ) public view override returns (uint256) {
        if (!priceConfigs[parentHash].isSet) revert ParentPriceConfigNotSet(parentHash);

        if (!skipValidityCheck) {
            // Confirms string values are only [a-z0-9-]
            label.validate();
        }

        uint256 length = label.strlen();
        // No pricing is set for 0 length domains
        if (length == 0) return 0;

        return _getPrice(parentHash, length);
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
        return (price * priceConfigs[parentHash].feePercentage) / PERCENTAGE_BASIS;
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
        price = getPrice(parentHash, label, skipValidityCheck);
        stakeFee = getFeeForPrice(parentHash, price);
        return (price, stakeFee);
    }

    /**
     * @notice Setter for `priceConfigs[domainHash]`. Only domain owner/operator can call this function.
     * @dev Validates the value of the `precisionMultiplier`.
     * fires `PriceConfigSet` event.
     * Only the owner of the domain or an allowed operator can call this function.
     * > This function should ALWAYS be used to set the config, since it's the only place where `isSet` is set to true.
     * > Use the other individual setters to modify only, since they do not set this variable!
     * @param domainHash The domain hash to set the price config for
     * @param priceConfig The new price config to set
     */
    function setPriceConfig(
        bytes32 domainHash,
        CurvePriceConfig calldata priceConfig
    ) public override {
        _validateSetPrecisionMultiplier(domainHash, priceConfig.precisionMultiplier);
        _validateSetBaseLength(domainHash, priceConfig.baseLength, priceConfig);
        priceConfigs[domainHash].maxPrice = priceConfig.maxPrice;
        _validateSetCurveMultiplier(domainHash, priceConfig.curveMultiplier, priceConfig);
        _validateSetMaxLength(domainHash, priceConfig.maxLength, priceConfig);
        _validateSetFeePercentage(domainHash, priceConfig.feePercentage);
        priceConfigs[domainHash].isSet = true;

        emit PriceConfigSet(
            domainHash,
            priceConfig.maxPrice,
            priceConfig.curveMultiplier,
            priceConfig.maxLength,
            priceConfig.baseLength,
            priceConfig.precisionMultiplier,
            priceConfig.feePercentage
        );
    }

    /**
     * @notice Sets the max price for domains. Validates the config with the new price.
     * Fires `MaxPriceSet` event.
     * Only domain owner can call this function.
     * > `maxPrice` can be set to 0 along with `baseLength` to make all domains free!
     * > `maxPrice` cannot be 0 when:
     *   - `maxLength` is 0;
     *   - `baseLength` AND `curveMultiplier` are 0;
     * @dev In the case of 0 we do not validate, since setting it to 0 will make all subdomains free.
     * @param domainHash The domain hash to set the `maxPrice` for it
     * @param maxPrice The maximum price to set
     */
    function setMaxPrice(
        bytes32 domainHash,
        uint256 maxPrice
    ) external override onlyOwnerOrOperator(domainHash) {
        priceConfigs[domainHash].maxPrice = maxPrice;
        emit MaxPriceSet(domainHash, maxPrice);
    }

    /**
     * @notice Sets the multiplier for domains calculations
     * to allow the hyperbolic price curve to be bent all the way to a straight line.
     * Validates the config with the new multiplier in case where `baseLength` is 0 too.
     * Fires `CurveMultiplier` event.
     * Only domain owner can call this function.
     * - If `curveMultiplier` = 1.000 - default. Makes a canonical hyperbola fucntion.
     * - It can be "0", which makes all domain prices max.
     * - If it is less than 1.000, then it pulls the bend towards the straight line.
     * - If it is bigger than 1.000, then it makes bigger slope on the chart.
     * @param domainHash The domain hash to set the price config for
     * @param curveMultiplier Multiplier for bending the price function (graph)
     */
    function setCurveMultiplier(
        bytes32 domainHash,
        uint256 curveMultiplier
    ) external override onlyOwnerOrOperator(domainHash) {
        CurvePriceConfig memory config = priceConfigs[domainHash];
        _validateSetCurveMultiplier(domainHash, curveMultiplier, config);
        emit CurveMultiplierSet(domainHash, curveMultiplier);
    }

    function _validateSetCurveMultiplier(
        bytes32 domainHash,
        uint256 curveMultiplier,
        CurvePriceConfig memory config
    ) internal onlyOwnerOrOperator(domainHash) {
        if (curveMultiplier == 0 && config.baseLength == 0)
            revert DivisionByZero(domainHash);

        priceConfigs[domainHash].curveMultiplier = curveMultiplier;
    }

    /**
     * @notice Set the value of the domain name length boundary where the `maxPrice` applies
     * e.g. A value of '5' means all domains <= 5 in length cost the `maxPrice` price
     * Validates the config with the new length. Fires `BaseLengthSet` event.
     * Only domain owner/operator can call this function.
     * > `baseLength` can be set to 0 to make all domains free.
     * > `baseLength` can be = `maxLength` to make all domain prices max.
     * > This indicates to the system that we are
     * > currently in a special phase where we define an exact price for all domains
     * > e.g. promotions or sales
     * @param domainHash The domain hash to set the `baseLength` for
     * @param baseLength Boundary to set
     */
    function setBaseLength(
        bytes32 domainHash,
        uint256 baseLength
    ) external override onlyOwnerOrOperator(domainHash) {
        CurvePriceConfig memory config = priceConfigs[domainHash];
        _validateSetBaseLength(domainHash, baseLength, config);
        emit BaseLengthSet(domainHash, baseLength);
    }

    function _validateSetBaseLength(
        bytes32 domainHash,
        uint256 baseLength,
        CurvePriceConfig memory config
    ) internal onlyOwnerOrOperator(domainHash) {

        if (config.maxLength < baseLength)
            revert MaxLengthSmallerThanBaseLength(domainHash);

        if (baseLength == 0 && config.curveMultiplier == 0)
            revert DivisionByZero(domainHash);

        priceConfigs[domainHash].baseLength = baseLength;
    }

    /**
     * @notice Set the maximum length of a domain name to which price formula applies.
     * All domain names (labels) that are longer than this value will cost the lowest price at maxLength.
     * Validates the config with the new length.
     * Fires `MaxLengthSet` event.
     * Only domain owner/operator can call this function.
     * > `maxLength` can't be set to 0 or less than `baseLength`!
     * > If `maxLength` = `baseLength` it makes all domain prices max.
     * @param domainHash The domain hash to set the `maxLength` for
     * @param maxLength The maximum length to set
     */
    function setMaxLength(
        bytes32 domainHash,
        uint256 maxLength
    ) external override onlyOwnerOrOperator(domainHash) {
        CurvePriceConfig memory config = priceConfigs[domainHash];
        _validateSetMaxLength(domainHash, maxLength, config);
        emit MaxLengthSet(domainHash, maxLength);
    }

    function _validateSetMaxLength(
        bytes32 domainHash,
        uint256 maxLength,
        CurvePriceConfig memory config
    ) internal onlyOwnerOrOperator(domainHash) {
        if (
            (maxLength < config.baseLength) ||
            maxLength == 0
        ) revert MaxLengthSmallerThanBaseLength(domainHash);

        priceConfigs[domainHash].maxLength = maxLength;
    }

    /**
     * @notice Sets the precision multiplier for the price calculation.
     * Multiplier This should be picked based on the number of token decimals
     * to calculate properly.
     * e.g. if we use a token with 18 decimals, and want precision of 2,
     * our precision multiplier will be equal to `10^(18 - 2) = 10^16`
     * Fires `PrecisionMultiplierSet` event.
     * Only domain owner/operator can call this function.
     * > Multiplier should be less or equal to 10^18 and greater than 0!
     * @param domainHash The domain hash to set `PrecisionMultiplier`
     * @param multiplier The multiplier to set
     */
    function setPrecisionMultiplier(
        bytes32 domainHash,
        uint256 multiplier
    ) public override onlyOwnerOrOperator(domainHash) {
        _validateSetPrecisionMultiplier(domainHash, multiplier);
        emit PrecisionMultiplierSet(domainHash, multiplier);
    }

    function _validateSetPrecisionMultiplier(
        bytes32 domainHash,
        uint256 multiplier
    ) internal {
        if (multiplier == 0 || multiplier > 10**18) revert InvalidPrecisionMultiplierPassed(domainHash);

        priceConfigs[domainHash].precisionMultiplier = multiplier;
    }

    /**
     * @notice Sets the fee percentage for domain registration.
     * @dev Fee percentage is set according to the basis of 10000, outlined in `PERCENTAGE_BASIS`.
     * Fires `FeePercentageSet` event.
     * Only domain owner/operator can call this function.
     * @param domainHash The domain hash to set the fee percentage for
     * @param feePercentage The fee percentage to set
     */
    function setFeePercentage(
        bytes32 domainHash,
        uint256 feePercentage
    ) public override onlyOwnerOrOperator(domainHash) {
        _validateSetFeePercentage(domainHash, feePercentage);
        emit FeePercentageSet(domainHash, feePercentage);
    }

    function _validateSetFeePercentage(
        bytes32 domainHash,
        uint256 feePercentage
    ) internal onlyOwnerOrOperator(domainHash) {
        if (feePercentage > PERCENTAGE_BASIS)
            revert FeePercentageValueTooLarge(
                feePercentage,
                PERCENTAGE_BASIS
            );

        priceConfigs[domainHash].feePercentage = feePercentage;
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
     * @param parentHash The parent hash
     * @param length The length of the domain name
     */
    function _getPrice(
        bytes32 parentHash,
        uint256 length
    ) internal view returns (uint256) {
        CurvePriceConfig memory config = priceConfigs[parentHash];

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
