## ICurvePriceConfig





**`CurvePriceConfig` struct properties:**

- `maxPrice` (uint256): Maximum price for a domain returned at <= `baseLength`
- `minPrice` (uint256): Minimum price for a domain returned at > `maxLength`
- `maxLength` (uint256): Maximum length of a domain name. If the name is longer - we return the `minPrice`
- `baseLength` (uint256): Base length of a domain name. If the name is shorter or equal - we return the `maxPrice`
- `precisionMultiplier` (uint256): The precision multiplier of the price. This multiplier
should be picked based on the number of token decimals to calculate properly.
e.g. if we use a token with 18 decimals, and want precision of 2,
our precision multiplier will be equal 10^18 - 10^2 = 10^16



### CurvePriceConfig








```solidity
struct CurvePriceConfig {
  uint256 maxPrice;
  uint256 minPrice;
  uint256 maxLength;
  uint256 baseLength;
  uint256 precisionMultiplier;
  uint256 feePercentage;
}
```


