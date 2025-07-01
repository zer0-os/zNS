// eslint-disable-next-line no-redeclare
export interface ICurvePriceConfig {
  maxPrice : bigint;
  curveMultiplier : bigint;
  maxLength : bigint;
  baseLength : bigint;
  precisionMultiplier : bigint;
  feePercentage : bigint;
}

export interface IFixedPriceConfig {
  price : bigint;
  feePercentage : bigint;
}

