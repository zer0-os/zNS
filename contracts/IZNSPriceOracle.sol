// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IZNSPriceOracle {
  event BasePriceSet(uint price, bool isSubdomain);
  event PriceMultiplierSet(uint multiplier);
  event BaseLengthSet(uint8 length);
}
