
export interface ICurvePriceConfig {
  maxPrice : bigint;
  minPrice : bigint;
  maxLength : bigint;
  baseLength : bigint;
  precisionMultiplier : bigint;
  feePercentage : bigint;
  isSet : boolean;
}

export interface IZTokenConfig {
  initialAdminDelay : bigint;
  initialSupplyBase : bigint;
  inflationRates : Array<bigint>;
  finalInflationRate : bigint;
}