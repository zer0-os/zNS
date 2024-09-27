
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
  name : string;
  symbol : string;
  defaultAdmin : string;
  initialAdminDelay : bigint;
  minter : string;
  mintBeneficiary : string;
  initialSupplyBase : bigint;
  inflationRates : Array<bigint>;
  finalInflationRate : bigint;
}