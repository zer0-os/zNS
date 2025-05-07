
export interface ICurvePriceConfig {
  maxPrice : bigint;
  curveMultiplier : bigint;
  maxLength : bigint;
  baseLength : bigint;
  precisionMultiplier : bigint;
  feePercentage : bigint;
  // isSet : boolean;
}

export enum ICurvePriceConfigIndices {
  MaxPrice = 0,
  CurveMultiplier = 1,
  MaxLength = 2,
  BaseLength = 3,
  PrecisionMultiplier = 4,
  FeePercentage = 5,
  // IsSet = 6
}