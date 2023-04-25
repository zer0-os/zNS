import {
  ZeroTokenMock,
  ZeroTokenMock__factory,
  ZNSAddressResolver,
  ZNSAddressResolver__factory,
  ZNSDomainToken,
  ZNSDomainToken__factory,
  ZNSEthRegistrar,
  ZNSEthRegistrar__factory,
  ZNSPriceOracle,
  ZNSPriceOracle__factory,
  ZNSRegistry,
  ZNSRegistry__factory,
  ZNSTreasury,
  ZNSTreasury__factory,
} from "../../typechain";
import { ethers } from "hardhat";
import { PriceParams, RegistrarConfig, ZNSContracts } from "./types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export const deployRegistry = async (
  deployer : SignerWithAddress
) : Promise<ZNSRegistry> => {
  const registryFactory = new ZNSRegistry__factory(deployer);
  const registry = await registryFactory.deploy();

  // To set the owner of the zero domain to the deployer
  await registry.connect(deployer).initialize(deployer.address);

  return registry;
};

export const deployAddressResolver = async (
  deployer : SignerWithAddress,
  registryAddress : string
) : Promise<ZNSAddressResolver> => {
  const addressResolverFactory = new ZNSAddressResolver__factory(deployer);
  const addressResolver = await addressResolverFactory.deploy(registryAddress);

  return addressResolver;
};

export const deployPriceOracle = async (
  deployer : SignerWithAddress,
  registrarAddress : string,
  params : PriceParams
) : Promise<ZNSPriceOracle> => {
  const priceOracleFactory = new ZNSPriceOracle__factory(deployer);
  const priceOracle = await priceOracleFactory.deploy();

  // The Registrar may not be deployed yet because of the cyclic dependency
  // between it and the ZNSPriceOracle. Use an empty string if so
  const registrar = !registrarAddress ? "" : registrarAddress;

  await priceOracle.initialize(
    params,
    registrar
  );

  return priceOracle;
};

export const deployDomainToken = async (
  deployer : SignerWithAddress
) : Promise<ZNSDomainToken> => {
  const domainTokenFactory = new ZNSDomainToken__factory(deployer);
  return domainTokenFactory.deploy();
};

export const deployZeroTokenMock = async (
  deployer : SignerWithAddress
) : Promise<ZeroTokenMock> => {
  const zTokenMockMockFactory = new ZeroTokenMock__factory(deployer);
  return zTokenMockMockFactory.deploy(deployer.address);
};

export const deployTreasury = async (
  deployer : SignerWithAddress,
  znsPriceOracleAddress : string,
  zTokenMockMockAddress : string,
  znsRegistrarAddress : string
) : Promise<ZNSTreasury> => {
  const treasuryFactory = new ZNSTreasury__factory(deployer);
  const treasury = await treasuryFactory.deploy(
    znsPriceOracleAddress,
    zTokenMockMockAddress,
    znsRegistrarAddress,
    deployer.address
  );
  return treasury;
};

export const deployRegistrar = async (
  deployer : SignerWithAddress,
  config : RegistrarConfig
) : Promise<ZNSEthRegistrar> => {
  const registrarFactory = new ZNSEthRegistrar__factory(deployer);
  const registrar = await registrarFactory.deploy(
    config.registryAddress,
    config.treasury.address,
    config.domainTokenAddress,
    config.addressResolverAddress,
    config.priceOracleAddress,
    config.burnAddress
  );

  await config.treasury.connect(deployer).setZNSRegistrar(registrar.address);

  return registrar;
};

export const deployZNS = async (deployer : SignerWithAddress, burnAddress : string) : Promise<ZNSContracts> => {
  const registry = await deployRegistry(deployer);

  const domainToken = await deployDomainToken(deployer);

  const zeroTokenMock = await deployZeroTokenMock(deployer);

  const addressResolver = await deployAddressResolver(deployer, registry.address);

  // TODO parameterize these numbers
  // Set "registrarAddress" after the registrar is deployed
  const params : PriceParams = {
    maxRootDomainPrice: ethers.utils.parseEther("1"),
    minRootDomainPrice: ethers.utils.parseEther("0.001"),
    maxSubdomainPrice: ethers.utils.parseEther("0.2"),
    minSubdomainPrice: ethers.utils.parseEther("0.0002"),
    maxRootDomainLength: 100,
    baseRootDomainLength: 3,
    maxSubdomainLength: 100,
    baseSubdomainLength: 3,
    priceMultiplier: ethers.BigNumber.from("390"),
  };

  const priceOracle = await deployPriceOracle(
    deployer,
    ethers.constants.AddressZero, // set to ZNSRegistrar later
    params
  );

  const treasury = await deployTreasury(
    deployer,
    priceOracle.address,
    zeroTokenMock.address,
    ethers.constants.AddressZero // set to ZNSRegistrar later
  );

  const config : RegistrarConfig = {
    treasury,
    registryAddress: registry.address,
    domainTokenAddress: domainToken.address,
    addressResolverAddress: addressResolver.address,
    priceOracleAddress: priceOracle.address,
    burnAddress,
  };

  const registrar = await deployRegistrar(deployer, config);

  const znsContracts : ZNSContracts = {
    addressResolver,
    registry,
    domainToken,
    zeroToken: zeroTokenMock,
    treasury,
    priceOracle,
    registrar,
  };

  // Final configuration steps
  await priceOracle.connect(deployer).setZNSRegistrar(registrar.address);
  await treasury.connect(deployer).setZNSRegistrar(registrar.address);
  await registry.connect(deployer).setOwnerOperator(registrar.address, true);

  // Give 15 ZERO to the deployer and allowance to the treasury
  await zeroTokenMock.connect(deployer).approve(treasury.address, ethers.constants.MaxUint256);
  await zeroTokenMock.transfer(deployer.address, ethers.utils.parseEther("15"));

  return znsContracts;
};
