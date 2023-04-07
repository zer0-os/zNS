// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IZNSPriceOracle} from "./IZNSPriceOracle.sol";

contract ZNSPriceOracle is IZNSPriceOracle, Initializable {
  /**
   * @notice Base price for root domains
   */
  uint public rootDomainBasePrice;

  /**
   * @notice Base price for subdomains
   */
  uint public subdomainBasePrice;

  /**
   * @notice The price multiplier used in calculation for a given domain name's length
   * Note, 3.9 is an arbitrary choice to use as a multiplier. I used it because it created
   * a reasonable decline in pricing form visually when graphed.
   */
  uint priceMultiplier = 39 * 10 ** 17;

  /**
   * @notice The address of the ZNS Registrar we are using
   */
  address public znsRegistrar;

  /**
   * @notice Track authorized users or contracts
   */
  mapping(address => bool) authorized;

  /**
   * @notice Restrict a function to only be callable by authorized users
   */
  modifier onlyAuthorized() {
    require(authorized[msg.sender], "ZNS: Not authorized");
    _;
  }

  function initialize(
    uint rootDomainBasePrice_,
    uint subdomainBasePrice_,
    address znsRegistrar_
  ) public initializer {
    rootDomainBasePrice = rootDomainBasePrice_;
    subdomainBasePrice = subdomainBasePrice_;

    znsRegistrar = znsRegistrar_;

    authorized[msg.sender] = true;
    authorized[znsRegistrar_] = true;
  }

  /**
   * @notice Get the price of a given domain name length
   * @param length The length of the name to check
   * @param isSubdomain Flag for which base price to use
   */
  function getPrice(
    uint8 length,
    bool isSubdomain
  ) external view returns (uint) {
    // No pricing is set for 0 length domains
    if (length == 0) return 0;

    if (isSubdomain) {
      return _getPrice(length, subdomainBasePrice);
    } else {
      return _getPrice(length, rootDomainBasePrice);
    }
  }

  /**
   * @notice Set the base price for root domains
   * If this value or the `priceMultiplier` value is `0` the price of any domain will also be `0`
   *
   * @param basePrice The price to set in $ZERO
   * @param isSubdomain Flag for if the price is to be set for a root or subdomain
   */
  function setBasePrice(
    uint basePrice,
    bool isSubdomain
  ) external onlyAuthorized {
    if (isSubdomain) {
      subdomainBasePrice = basePrice;
    } else {
      rootDomainBasePrice = basePrice;
    }

    emit BasePriceSet(basePrice, isSubdomain);
  }

  /**
   * @notice In price calculation we use a `multiplier` to adjust how steep the
   * price curve is after the base price. This allows that value to be changed.
   * If this value or the `basePrice` is `0` the price of any domain will also be `0`
   *
   * @param multiplier The new price multiplier to set
   */
  function setPriceMultipler(uint multiplier) external onlyAuthorized {
    priceMultiplier = multiplier;

    emit PriceMultiplierSet(multiplier);
  }

  /**
   * @notice Return true if a user is authorized, otherwise false
   * @param user The user to check
   */
  function isAuthorized(address user) external view returns (bool) {
    return authorized[user];
  }

  /**
   * @notice Internal function to get price abstract of the base price being for
   * a root domain or a subdomain.
   *
   * @param length The length of the domain name
   * @param basePrice The base price to calculate with
   */
  function _getPrice(
    uint8 length,
    uint basePrice
  ) internal view returns (uint) {
    if (length <= 3) return basePrice;

    // TODO truncate to everything after the decimal, we don't want fractional prices

    // The price function is `price = (basePrice * 3.9) / length`
    // This creates an asymptotic curve that decreases in pricing base on length
    return (basePrice * priceMultiplier) / length;
  }
}
