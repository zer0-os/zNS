import { BigNumber } from "ethers";
import { PERCENTAGE_BASIS, priceConfigDefault } from "./constants";
import { ICurvePriceConfig, IFixedPriceConfig } from "./types";


/**
 * Get the domain name price base on its length when given
 * an already deployed contract
 *
 * @param name Length of the domain name
 * @param priceConfig Object with all the pricing props
 * @returns The expected price for that domain
 */
export const calcAsymptoticPrice = (
  name : string,
  priceConfig = priceConfigDefault,
) : BigNumber => {
  // Get price configuration for contract
  const {
    maxPrice,
    minPrice,
    baseLength,
    maxLength,
    precisionMultiplier,
  } = priceConfig;

  if (baseLength.eq(0)) return maxPrice;

  if (BigNumber.from(name.length).lte(baseLength)) {
    return maxPrice;
  }

  if (BigNumber.from(name.length).gt(maxLength)) {
    return minPrice;
  }

  const base = baseLength.mul(maxPrice).div(name.length);

  return base.div(precisionMultiplier).mul(precisionMultiplier);
};

export const getStakingOrProtocolFee = (
  forAmount : BigNumber,
  feePercentage : BigNumber = priceConfigDefault.feePercentage,
) => forAmount
  .mul(feePercentage)
  .div(PERCENTAGE_BASIS);

/**
 * Get the domain name price, the registration fee and the total
 * based on name length when given an already deployed contract
 *
 * @param name Length of the domain name
 * @param priceConfig Object with all the pricing props
 * @returns The full expected price object for that domain
 */
export const getPriceObject = (
  name : string,
  priceConfig : ICurvePriceConfig | IFixedPriceConfig = priceConfigDefault,
) : {
  totalPrice : BigNumber;
  expectedPrice : BigNumber;
  stakeFee : BigNumber;
} => {
  let expectedPrice;
  if (Object.keys(priceConfig).length === 6) {
    expectedPrice = calcAsymptoticPrice(name, priceConfig as ICurvePriceConfig);
  } else if (Object.keys(priceConfig).length === 2) {
    ({ price: expectedPrice } = priceConfig as IFixedPriceConfig);
  } else {
    throw new Error("Invalid price config");
  }

  const { feePercentage } = priceConfig;

  const stakeFee = getStakingOrProtocolFee(expectedPrice, feePercentage);

  const totalPrice = expectedPrice.add(stakeFee);

  return {
    totalPrice,
    expectedPrice,
    stakeFee,
  };
};