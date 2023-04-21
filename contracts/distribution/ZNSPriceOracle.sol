// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IZNSPriceOracle} from "./IZNSPriceOracle.sol";

contract ZNSPriceOracle is IZNSPriceOracle, Initializable {
  /**
   * @notice Base price for root domains
   */
  uint256 public rootDomainBasePrice;

  /**
   * @notice Base price for subdomains
   */
  uint256 public subdomainBasePrice;

  /**
   * @notice The price multiplier used in calculation for a given domain name's length
   * We store this value with two decimals of precision for division later in calculation
   * This means if we use a multiplier of 3.9, it is stored as 390
   * Note that 3.9 is recommended but is an arbitrary choice to use as a multiplier. We use
   * it here because it creates a reasonable decline in pricing visually when graphed.
   */
  uint256 public priceMultiplier;

  /**
   * @notice The base domain name length is used in pricing to identify domains
   * that should recieve the default base price for that type of domain or not.
   * Domains that are `<= baseLength` will receive the default base price.
   */
  uint256 public rootDomainBaseLength;

  uint256 public subdomainBaseLength;

  /**
   * @notice The address of the ZNS Registrar we are using
   */
  address public znsRegistrar;

  /**
   * @notice Track authorized users or contracts
   * TODO access control for the entire system
   */
  mapping(address user => bool isAuthorized) public authorized;

  /**
   * @notice Restrict a function to only be callable by authorized users
   */
  modifier onlyAuthorized() {
    require(authorized[msg.sender], "ZNS: Not authorized");
    _;
  }

  function initialize(
    uint256 rootDomainBasePrice_,
    uint256 subdomainBasePrice_,
    uint256 priceMultiplier_,
    uint256 rootDomainBaseLength_,
    uint256 subdomainBaseLength_,
    address znsRegistrar_
  ) public initializer {
    rootDomainBasePrice = rootDomainBasePrice_;
    subdomainBasePrice = subdomainBasePrice_;
    priceMultiplier = priceMultiplier_;
    rootDomainBaseLength = rootDomainBaseLength_;
    subdomainBaseLength = subdomainBaseLength_;
    znsRegistrar = znsRegistrar_;
    authorized[msg.sender] = true;
    authorized[znsRegistrar_] = true;
  }

  /**
   * @notice Get the price of a given domain name
   * @param name The name of the domain to check
   * @param isRootDomain Flag for which base price to use. True for root, false for subdomains
   */
  function getPrice(
    string calldata name,
    bool isRootDomain
  ) external view returns (uint256) {
    // TODO Getting string length this way may be misleading
    // when considering unicode encoded characters. Find a
    // better solution for this
    uint256 length = bytes(name).length;

    // No pricing is set for 0 length domains
    if (length == 0) return 0;

    if (isRootDomain) {
      return _getPrice(length, rootDomainBaseLength, rootDomainBasePrice);
    } else {
      return _getPrice(length, subdomainBaseLength, subdomainBasePrice);
    }
  }

  /**
   * @notice Set the base price for root domains
   * If this value or the `priceMultiplier` value is `0` the price of any domain will also be `0`
   *
   * @param basePrice The price to set in $ZERO
   * @param isRootDomain Flag for if the price is to be set for a root or subdomain
   */
  function setBasePrice(
    uint256 basePrice,
    bool isRootDomain
  ) external onlyAuthorized {
    if (isRootDomain) {
      rootDomainBasePrice = basePrice;
    } else {
      subdomainBasePrice = basePrice;
    }

    emit BasePriceSet(basePrice, isRootDomain);
  }

  /**
   * @notice In price calculation we use a `multiplier` to adjust how steep the
   * price curve is after the base price. This allows that value to be changed.
   * If this value or the `basePrice` is `0` the price of any domain will also be `0`
   *
   * Valid values for the multiplier range are between 300 - 400 inclusively.
   * These are decimal values with two points of precision, meaning they are really 3.00 - 4.00
   * but we can't store them this way. We divide by 100 in the below internal price function
   * to make up for this.
   * @param multiplier The new price multiplier to set
   */
  function setPriceMultiplier(uint256 multiplier) external onlyAuthorized {
    require(
      multiplier >= 300 && multiplier <= 400,
      "ZNS: Multiplier out of range"
    );
    priceMultiplier = multiplier;

    emit PriceMultiplierSet(multiplier);
  }

  /**
   * @notice Set the value of the domain name length boundary where the default price applies
   * e.g. A value of '5' means all domains <= 5 in length cost the default price
   * @param length Boundary to set
   * @param isRootDomain Flag for if the price is to be set for a root or subdomain
   */
  function setBaseLength(
    uint256 length,
    bool isRootDomain
  ) external onlyAuthorized {
    if (isRootDomain) {
      rootDomainBaseLength = length;
    } else {
      subdomainBaseLength = length;
    }

    emit BaseLengthSet(length, isRootDomain);
  }

  /**
   * @notice Set the value of both base lengt variables
   * @param rootLength The length for root domains
   * @param subdomainLength The length for subdomains
   */
  function setBaseLengths(
    uint256 rootLength,
    uint256 subdomainLength
  ) external onlyAuthorized {
    rootDomainBaseLength = rootLength;
    subdomainBaseLength = subdomainLength;

    emit BaseLengthsSet(rootLength, subdomainLength);
  }

  /**
   * @notice Set the ZNSRegistrar for this contract
   * @param registrar The registrar to set
   */
  function setZNSRegistrar(address registrar) external onlyAuthorized {
    require(registrar != address(0), "ZNS: Zero address for Registrar");

    // Modify the access control for the new registrar
    authorized[znsRegistrar] = false;
    authorized[registrar] = true;
    znsRegistrar = registrar;

    emit ZNSRegistrarSet(registrar);
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
   * @param baseLength The base length to reach before we actually do the calculation
   * @param basePrice The base price to calculate with
   */
  function _getPrice(
    uint256 length,
    uint256 baseLength,
    uint256 basePrice
  ) internal view returns (uint256) {
    if (length <= baseLength) return basePrice;

    // TODO truncate to everything after the decimal, we don't want fractional prices
    // Should this be here vs. in the dApp?

    // This creates an asymptotic curve that decreases in pricing based on domain name length
    // Because there are no decimals in ETH we set the muliplier as 100x higher
    // than it is meant to be, so we divide by 100 to reverse that action here.
    // =(baseLength*basePrice*multiplier)/(length+(3*multiplier)
    return
      (baseLength * priceMultiplier * basePrice) /
      (length + (3 * priceMultiplier)) /
      100;
  }
}
