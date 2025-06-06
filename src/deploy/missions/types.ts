import { ICurvePriceConfig } from "../../../typechain/contracts/price/ZNSCurvePricer";
import { IZNSFixedPricer } from "../../../typechain/contracts/price/ZNSFixedPricer";


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

// TODO dom: refactor the types above to use these types below instead in all of the code !
export type CurvePriceConfig = Partial<Pick<ICurvePriceConfig.CurvePriceConfigStruct, "isSet">>;
export type FixedPriceConfig = Partial<Pick<IZNSFixedPricer.PriceConfigStruct, "isSet">>;
