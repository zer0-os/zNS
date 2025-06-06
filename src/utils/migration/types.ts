import { Addressable } from "ethers";
import { IDistributionConfig, IPaymentConfig } from "../../../test/helpers/types";


// TODO do we need all these types?

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
  components: Array<SafeTxArgType>;
}
// For Gnosis Safe batch transaction creation
export interface SafeTxContractMethod {
  inputs: Array<SafeTxArgType | SafeTxComponentsArg>;
  name: string;
  payable: boolean;
}

export interface SafeTx {
  to: string | Addressable;
  value: string;
  data: string | null;
  contractMethod: SafeTxContractMethod;
  contractInputValues: { 
    // The names and values of the input params
    // e.g. for call to approve, "spender" : "0x...", "value" : "100000..."
    [key: string]: any;
  }
}

export interface SafeBatch {
  version: string; // 1.0
  chainId: string; // 9369
  createdAt: number; // timestamp
  meta ?: {
    name: string;
    description: string;
    txBuilderVersion: string; // 1.18.0
    createdFromSafeAddress: string; // 0x...
    createdFromOwnerAddress: string; // 0x
    checksum: string;
  }
  transactions : SafeTx[];
}
