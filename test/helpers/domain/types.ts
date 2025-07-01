import { IDistributionConfig, IPaymentConfig } from "../types";
import { ICurvePriceConfig, IFixedPriceConfig } from "../../../src/deploy/missions/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


export interface IFullDomainConfig {
  owner : SignerWithAddress;
  label : string;
  tokenOwner ?: string;
  parentHash ?: string;
  distrConfig ?: IDistributionConfig;
  priceConfig ?: ICurvePriceConfig | IFixedPriceConfig;
  paymentConfig ?: IPaymentConfig;
  domainAddress ?: string;
  tokenURI ?: string;
}
