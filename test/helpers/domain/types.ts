import { IDistributionConfig, IPaymentConfig } from "../types";
import { CurvePriceConfig, FixedPriceConfig } from "../../../src/deploy/missions/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


export interface IFullDomainConfig {
  owner : SignerWithAddress;
  label : string;
  tokenOwner ?: string;
  parentHash ?: string;
  distrConfig ?: IDistributionConfig;
  priceConfig ?: CurvePriceConfig | FixedPriceConfig;
  paymentConfig ?: IPaymentConfig;
  domainContent ?: string;
  tokenURI ?: string;
}
