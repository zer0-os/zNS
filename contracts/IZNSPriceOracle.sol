// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IZNSPriceOracle {
  event BasePriceSet(uint price, bool isSubdomain);
  event PriceMultiplierSet(uint multiplier);
  event BaseLengthSet(uint8 length);

  /**
   * @notice Get the price of a given domain name length
   * @param length The length of the name to check
   * @param isRootDomain Flag for which base price to use. True for subdomain, false for root.
   */
  function getPrice(
    uint8 length,
    bool isRootDomain
  ) external view returns (uint);

  /**
   * @notice Set the base price for root domains
   * If this value or the `priceMultiplier` value is `0` the price of any domain will also be `0`
   *
   * @param basePrice The price to set in $ZERO
   * @param isRootDomain Flag for if the price is to be set for a root or subdomain
   */
  function setBasePrice(
    uint basePrice,
    bool isRootDomain
  ) external;

  /**
   * @notice In price calculation we use a `multiplier` to adjust how steep the
   * price curve is after the base price. This allows that value to be changed.
   * If this value or the `basePrice` is `0` the price of any domain will also be `0`
   *
   * @param multiplier The new price multiplier to set
   */
  function setPriceMultiplier(uint16 multiplier) external;

  /**
   * @notice Set the value of the domain name length boundary where the default price applies
   * e.g. A value of '5' means all domains <= 5 in length cost the default price
   * @param length Boundary to set
   */
  function setBaseLength(uint8 length) external;

  /**
   * @notice Set the ZNSRegistrar for this contract
   * @param registrar The registrar to set
   */
  function setZNSRegistrar(address registrar) external;

  /**
   * @notice Return true if a user is authorized, otherwise false
   * @param user The user to check
   */
  function isAuthorized(address user) external view returns (bool);
}
