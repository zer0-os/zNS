import { ContractTransactionReceipt } from "ethers";
import { IDistributionConfig, IPaymentConfig } from "../../../test/helpers/types";

export interface Domain {
  id : string;
  minter : User;
  owner : User;
  domainToken : DomainToken;
  depth : number;
  label : string;
  isReclaimable : boolean;
  reclaimableAddress : string;
  isWorld : boolean;
  address : string;
  parentHash : string;
  parent : Domain | null;
  accessType : string;
  paymentType : string;
  pricerContract : string;
  curvePriceConfig : CurvePriceConfig;
  fixedPriceConfig : FixedPriceConfig;
  subdomainCount : number;
  tokenId : string;
  tokenURI : string;
  treasury : Treasury;
  creationBlock : number;
}

interface CurvePriceConfig {
  id : string;
  baseLength : string;
  feePercentage : string;
  maxLength : string;
  maxPrice : string;
  minPrice : string;
  precisionMultiplier : string;
}

interface FixedPriceConfig {
  id : string;
  feePercentage : string;
  price : string;
}

interface PaymentToken {
  id : string;
  name : string;
  symbol : string;
  decimals : string;
}

interface Treasury {
  id : string;
  beneficiaryAddress : string;
  domain : Domain; // cyclic?
}

interface DomainToken {
  baseURI : string;
  defaultRoyalty : string;
  owner : User;
  royalty : string;
  tokenId : string;
  tokenName : string;
  tokenSymbol : string;
  tokenURI : string;
}

export interface SubgraphError {
  label : string;
  hash : string;
  parentHash : string;
  parent : Domain | null;
  error : string;
}

export interface DomainData {
  parentHash : string;
  label : string;
  domainAddress : string;
  tokenUri : string;
  distrConfig : IDistributionConfig;
  paymentConfig : IPaymentConfig;
}

export interface RegisteredDomains {
  domainHashes : Array<string>;
  txHash : string;
}

export interface User { id : string; domains : Array<Domain>; }
export interface InvalidDomain { message : string; domain : Domain; }
export interface ValidatedUser { address : string; validDomains : Array<Domain>; invalidDomains : Array<InvalidDomain>; }
