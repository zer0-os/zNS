export interface Domain {
  id: string;
  minter: User;
  owner: User;
  label: string;
  isReclaimable: boolean;
  reclaimableAddress: string;
  isWorld: boolean;
  address: string;
  parentHash: string;
  parent: Domain | null;
  accessType: string;
  paymentType: string;
  pricerContract: string;
  paymentToken: PaymentToken;
  curvePriceConfig: CurvePriceConfig;
  fixedPriceConfig: FixedPriceConfig;
  subdomainCount: number;
  tokenId: string;
  tokenURI: string;
  treasury: Treasury;
  creationBlock: number;
}

interface User {
  id: string;
  domains: Domain[];
}

interface CurvePriceConfig {
  id: string;
  baseLength: string
	feePercentage: string
	maxLength: string
	maxPrice: string
	minPrice: string
	precisionMultiplier: string
}

interface FixedPriceConfig {
  id: string;
  feePercentage: string
	price: string
}

interface PaymentToken {
  id: string;
  name: string;
	symbol: string;
	decimals: string;
}

interface Treasury {
  id: string;
	beneficiaryAddress: string
  domain: Domain // cyclic?
}

export interface DomainToken {
  baseURI: string
	defaultRoyalty: string
	owner: User
	royalty: string
  tokenId: string
	tokenName: string
	tokenSymbol: String
	tokenURI: string
}