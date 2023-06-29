import { BigNumber } from "ethers";
import {
  ZNSAddressResolver,
  ZNSAddressResolverUpgradeMock,
  ZNSAddressResolverUpgradeMock__factory,
  ZNSDomainToken,
  ZNSDomainTokenUpgradeMock,
  ZNSDomainTokenUpgradeMock__factory,
  ZNSPriceOracle,
  ZNSPriceOracleUpgradeMock,
  ZNSPriceOracleUpgradeMock__factory,
  ZNSRegistrar,
  ZNSRegistrarUpgradeMock,
  ZNSRegistrarUpgradeMock__factory,
  ZNSRegistry,
  ZNSRegistryUpgradeMock,
  ZNSRegistryUpgradeMock__factory,
  ZNSTreasury,
  ZNSTreasuryUpgradeMock,
  ZNSTreasuryUpgradeMock__factory,
} from "../../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IPriceParams } from "../../src/deploy/missions/types";

export type Maybe<T> = T | undefined;

export type GetterFunction = Promise<string | boolean | BigNumber | Array<BigNumber>>;

export type ZNSContractMockFactory =
  ZNSRegistrarUpgradeMock__factory |
  ZNSPriceOracleUpgradeMock__factory |
  ZNSTreasuryUpgradeMock__factory |
  ZNSRegistryUpgradeMock__factory |
  ZNSAddressResolverUpgradeMock__factory |
  ZNSDomainTokenUpgradeMock__factory;

export type ZNSContractMock =
  ZNSRegistrarUpgradeMock |
  ZNSPriceOracleUpgradeMock |
  ZNSTreasuryUpgradeMock |
  ZNSRegistryUpgradeMock |
  ZNSAddressResolverUpgradeMock |
  ZNSDomainTokenUpgradeMock;

export type ZNSContract =
  ZNSRegistrar |
  ZNSPriceOracle |
  ZNSTreasury |
  ZNSRegistry |
  ZNSAddressResolver |
  ZNSDomainToken;

export interface RegistrarConfig {
  treasury : ZNSTreasury;
  registryAddress : string;
  domainTokenAddress : string;
  addressResolverAddress : string;
}

export interface DeployZNSParams {
  deployer : SignerWithAddress;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  priceConfig ?: IPriceParams;
  registrationFeePerc ?: BigNumber;
  zeroVaultAddress ?: string;
  logAddresses ?: boolean;
}
