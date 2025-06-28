import { Addressable } from "ethers";
import { IDistributionConfig, IPaymentConfig, IZNSContractsLocal } from "../../../test/helpers/types";
import { SafeTransactionOptionalProps } from "@safe-global/protocol-kit";
import { SafeTransaction } from "@safe-global/types-kit";
import { ProposeTransactionProps } from "@safe-global/api-kit";
import { Db } from "mongodb";

export interface Domain {
  id : string;
  minter : User;
  owner : User;
  domainToken : DomainToken;
  depth : number;
  label : string; // Subgraph uses `label`, contracts use both `name` and `label` for roots and subs, respectively
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

export type RootRegistrarArgs = Pick<Domain, "label" |  "owner" | "tokenURI" | "treasury">;
export type SubRegistrarArgs = RootRegistrarArgs & Pick<Domain, "parentHash">;

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

interface Treasury {
  id : string;
  beneficiaryAddress : string;
  paymentToken : string;
  domain : Domain;
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

export interface RootDomainData {
  name : string;
  domainAddress : string;
  tokenUri : string;
  distrConfig : IDistributionConfig;
  paymentConfig : IPaymentConfig;
}

export interface SubdomainData extends Pick<RootDomainData, "domainAddress" | "tokenUri" | "distrConfig" | "paymentConfig"> {
  parentHash : string;
  label : string;
}

export interface RegisteredDomains {
  domainHashes : Array<string>;
  txHash : string;
}

export interface User { id : string; domains : Array<Domain>; }
export interface InvalidDomain { message : string; domain : Domain; }
export interface ValidatedUser {
  address : string;
  validDomains : Array<Domain>;
  invalidDomains : Array<InvalidDomain>;
}

// Singular variables
export interface SafeTxArgType {
  internalType ?: string;
  name ?: string;
  type ?: string;
  components ?: Array<SafeTxArgType>;
}

// Structs or arrays
export interface SafeTxComponentsArg {
  components : Array<SafeTxArgType>;
}
// For Gnosis Safe batch transaction creation
export interface SafeTxContractMethod {
  inputs : Array<SafeTxArgType | SafeTxComponentsArg>;
  name : string;
  payable : boolean;
}

export interface SafeTx {
  to : string | Addressable;
  value : string;
  data : string | null;
  contractMethod : SafeTxContractMethod;
  contractInputsValues : {
    // The names and values of the input params
    // e.g. for call to approve, "spender" : "0x...", "value" : "100000..."
    [key : string] : any;
  };
}

export interface SafeBatch {
  version : string; // 1.0
  chainId : string; // 9369
  createdAt : number; // timestamp
  meta ?: {
    name : string;
    description : string;
    txBuilderVersion : string; // 1.18.0
    createdFromSafeAddress : string; // 0x...
    createdFromOwnerAddress : string; // 0x
    checksum : string;
  };
  transactions : Array<SafeTx>;
}

export interface IRootDomainRegistrationArgs {
  name : string;
  domainAddress : string;
  tokenOwner : string;
  tokenURI : string;
  distrConfig : IDistributionConfig;
  paymentConfig : IPaymentConfig;
}

export interface ISubdomainRegisterArgs extends Omit<IRootDomainRegistrationArgs, "name"> {
  parentHash : string;
  label : string;
}

/**
 * The configuration to specify a SafeKit instance
 */
export interface SafeKitConfig {
  network : string;
  chainId : bigint;
  rpcUrl : string;
  safeAddress : string;
  safeOwnerAddress : string;
  delay : number;
  retryAttempts : number;
  txServiceUrl ?: string; // Optional when using a supported network
  db ?: Db;
}

export interface SafeRetryOptions {
  attempts : number;
  delayMs : number;
  exponential ?: boolean;
}

export type SafeTransactionOptionsExtended = SafeTransactionOptionalProps & { execute ?: boolean; numPendingTxs ?: number; };
export type ProposeTransactionPropsExtended = ProposeTransactionProps & { safeTx : SafeTransaction; };

// Batch registerations are simply a string array,
// but batch transfers aren't possible on the contract
// so we group single transactions into a second array
export type CreateBatchesResponse = [ Array<string>, Array<Array<string>> ];