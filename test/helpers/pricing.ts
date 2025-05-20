import { DEFAULT_PERCENTAGE_BASIS, DEFAULT_CURVE_PRICE_CONFIG, DEFAULT_FIXED_PRICER_CONFIG_BYTES, DEFAULT_FIXED_PRICE_CONFIG } from "./constants";
import { IFixedPriceConfig } from "./types";
import { ICurvePriceConfig } from "../../src/deploy/missions/types";

import { ethers } from "ethers";

/**
 * Get the domain name price base on its length when given
 * an already deployed contract
 *
 * @param name Length of the domain name
 * @param priceConfig Object with all the pricing props
 * @returns The expected price for that domain
 */
export const getCurvePrice = (
  name : string,
  priceConfig = DEFAULT_CURVE_PRICE_CONFIG,
) : bigint => {
  // Get price configuration for contract
  const {
    maxPrice,
    curveMultiplier,
    baseLength,
    maxLength,
    precisionMultiplier,
  } = priceConfig;

  let length = BigInt(name.length);

  if (length <= baseLength) {
    return maxPrice;
  }

  if (length > maxLength) {
    length = maxLength;
  }

  const MULTIPLIER_BASIS = 1000n;

  const base = (baseLength * maxPrice * MULTIPLIER_BASIS)
    / (baseLength * MULTIPLIER_BASIS + curveMultiplier * (length - baseLength));

  return base / precisionMultiplier * precisionMultiplier;
};

export const getStakingOrProtocolFee = (
  forAmount : bigint,
  feePercentage : bigint = DEFAULT_CURVE_PRICE_CONFIG.feePercentage,
) => forAmount * feePercentage / DEFAULT_PERCENTAGE_BASIS;

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
  priceConfig : Partial<ICurvePriceConfig> | Partial<IFixedPriceConfig> = DEFAULT_CURVE_PRICE_CONFIG,
) : {
  totalPrice : bigint;
  expectedPrice : bigint;
  stakeFee : bigint;
} => {
  let expectedPrice;
  const configLen = Object.keys(priceConfig).length;

  if (configLen === 7 || configLen === 6) {
    expectedPrice = getCurvePrice(name, priceConfig as ICurvePriceConfig);
  } else if (configLen === 3 || configLen === 2) {
    ({ price: expectedPrice } = priceConfig as IFixedPriceConfig);
  } else {
    throw new Error("Invalid price config");
  }

  const { feePercentage } = priceConfig;

  const stakeFee = getStakingOrProtocolFee(expectedPrice, feePercentage);

  const totalPrice = expectedPrice + stakeFee;

  return {
    totalPrice,
    expectedPrice,
    stakeFee,
  };
};

// TODO can we make one single fucntion to route for both?
export const createEncodeFixedPriceConfig = (config : Partial<IFixedPriceConfig>) => {
  const createdConfig : IFixedPriceConfig = {
    price: config.price ?? DEFAULT_FIXED_PRICE_CONFIG.price,
    feePercentage: config.feePercentage ?? DEFAULT_CURVE_PRICE_CONFIG.feePercentage,
  }

  return encodeFixedPriceConfig(createdConfig);
}

export const createEncodeCurvePriceConfig = (config : Partial<ICurvePriceConfig>) => {
  const createdConfig : ICurvePriceConfig = {
    maxPrice: config.maxPrice ?? DEFAULT_CURVE_PRICE_CONFIG.maxPrice,
    maxLength: config.maxLength ?? DEFAULT_CURVE_PRICE_CONFIG.maxLength,
    baseLength: config.baseLength ?? DEFAULT_CURVE_PRICE_CONFIG.baseLength,
    curveMultiplier: config.curveMultiplier ?? DEFAULT_CURVE_PRICE_CONFIG.curveMultiplier,
    precisionMultiplier: config.precisionMultiplier ?? DEFAULT_CURVE_PRICE_CONFIG.precisionMultiplier,
    feePercentage: config.feePercentage ?? DEFAULT_CURVE_PRICE_CONFIG.feePercentage,
  }

  return encodeCurvePriceConfig(createdConfig);
}

export const encodePriceConfig = (
  config : ICurvePriceConfig | IFixedPriceConfig,
) => {
  if (Object.keys(config).length > 2) {
    return encodeCurvePriceConfig(config as ICurvePriceConfig);
  } else {
    return encodeFixedPriceConfig(config as IFixedPriceConfig);
  }
}

export const decodePriceConfig = (
  config : string
) => {
  if (config.length > DEFAULT_FIXED_PRICER_CONFIG_BYTES.length) {
    return decodeCurvePriceConfig(config);
  } else {
    return decodeFixedPriceConfig(config);
  }
}


const encodeCurvePriceConfig = (config : ICurvePriceConfig) => {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    [
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint256"
    ],
    [
      config.maxPrice,
      config.curveMultiplier,
      config.maxLength,
      config.baseLength,
      config.precisionMultiplier,
      config.feePercentage
    ]
  )
}

const encodeFixedPriceConfig = (config : IFixedPriceConfig) => {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    [
      "uint256",
      "uint256",
    ],
    [
      config.price,
      config.feePercentage
    ]
  )
}


const decodeCurvePriceConfig = (config : string) => {
  const results = ethers.AbiCoder.defaultAbiCoder().decode(
    [
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
    ],
    config
  )

  const toReturn : ICurvePriceConfig = {
    maxPrice: results[0],
    curveMultiplier: results[1],
    maxLength: results[2],
    baseLength: results[3],
    precisionMultiplier: results[4],
    feePercentage: results[5]
  }

  return toReturn;
}

const decodeFixedPriceConfig = (config : string) => {
  return ethers.AbiCoder.defaultAbiCoder().decode(
    [
      "uint256",
      "uint256",
    ],
    config
  );
}
