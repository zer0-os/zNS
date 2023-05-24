import {
  ZeroTokenMock,
  ZeroTokenMock__factory, ZNSAccessController,
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
import { priceConfigDefault, registrationFeePercDefault } from "./constants";
import { deployAccessController, REGISTRAR_ROLE } from "./access";
import { BigNumber } from "ethers";


export const deployRegistry = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string
) : Promise<ZNSRegistry> => {
  const registryFactory = new ZNSRegistry__factory(deployer);
  const registry = await registryFactory.deploy();

  // To set the owner of the zero domain to the deployer
  await registry.connect(deployer).initialize(accessControllerAddress);

  return registry;
};

export const deployAddressResolver = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string,
  registryAddress : string
) : Promise<ZNSAddressResolver> => {
  const addressResolverFactory = new ZNSAddressResolver__factory(deployer);
  const addressResolver = await addressResolverFactory.deploy(
    accessControllerAddress,
    registryAddress
  );

  return addressResolver;
};

export const deployPriceOracle = async ({
  deployer,
  accessControllerAddress,
  priceConfig,
  registrationFee,
} : {
  deployer : SignerWithAddress;
  accessControllerAddress : string;
  priceConfig : PriceParams;
  registrationFee : BigNumber;
}) : Promise<ZNSPriceOracle> => {
  const priceOracleFactory = new ZNSPriceOracle__factory(deployer);
  const priceOracle = await priceOracleFactory.deploy();

  await priceOracle.initialize(
    accessControllerAddress,
    priceConfig,
    registrationFee
  );

  return priceOracle;
};

export const deployDomainToken = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string
) : Promise<ZNSDomainToken> => {
  const domainTokenFactory = new ZNSDomainToken__factory(deployer);
  return domainTokenFactory.deploy(
    "ZNSDomainToken",
    "ZDT",
    accessControllerAddress
  );
};

export const deployZeroTokenMock = async (
  deployer : SignerWithAddress
) : Promise<ZeroTokenMock> => {
  const zTokenMockMockFactory = new ZeroTokenMock__factory(deployer);
  return zTokenMockMockFactory.deploy(deployer.address);
};

export const deployTreasury = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string,
  znsPriceOracleAddress : string,
  zTokenMockMockAddress : string,
  zeroVaultAddress : string
) : Promise<ZNSTreasury> => {
  const treasuryFactory = new ZNSTreasury__factory(deployer);
  const treasury = await treasuryFactory.deploy(
    accessControllerAddress,
    znsPriceOracleAddress,
    zTokenMockMockAddress,
    zeroVaultAddress
  );
  return treasury;
};

export const deployRegistrar = async (
  deployer : SignerWithAddress,
  accessController : ZNSAccessController,
  config : RegistrarConfig
) : Promise<ZNSEthRegistrar> => {
  const registrarFactory = new ZNSEthRegistrar__factory(deployer);
  const registrar = await registrarFactory.deploy(
    accessController.address,
    config.registryAddress,
    config.treasury.address,
    config.domainTokenAddress,
    config.addressResolverAddress
  );

  await accessController.connect(deployer).grantRole(REGISTRAR_ROLE, registrar.address);

  return registrar;
};

export const deployZNS = async ({
  deployer,
  governorAddresses,
  adminAddresses,
  priceConfig = priceConfigDefault,
  registrationFeePerc = registrationFeePercDefault,
  zeroVaultAddress = deployer.address,
} : {
  deployer : SignerWithAddress;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  priceConfig ?: PriceParams;
  registrationFeePerc ?: BigNumber;
  zeroVaultAddress ?: string;
}) : Promise<ZNSContracts> => {
  const accessController = await deployAccessController({
    deployer,
    governorAddresses: [deployer.address, ...governorAddresses],
    adminAddresses: [deployer.address, ...adminAddresses],
  });

  const registry = await deployRegistry(deployer, accessController.address);

  const domainToken = await deployDomainToken(deployer, accessController.address);

  const zeroTokenMock = await deployZeroTokenMock(deployer);

  const addressResolver = await deployAddressResolver(
    deployer,
    accessController.address,
    registry.address
  );

  const priceOracle = await deployPriceOracle({
    deployer,
    accessControllerAddress: accessController.address,
    priceConfig,
    registrationFee: registrationFeePerc,
  });

  const treasury = await deployTreasury(
    deployer,
    accessController.address,
    priceOracle.address,
    zeroTokenMock.address,
    zeroVaultAddress
  );

  const config : RegistrarConfig = {
    treasury,
    registryAddress: registry.address,
    domainTokenAddress: domainToken.address,
    addressResolverAddress: addressResolver.address,
  };

  const registrar = await deployRegistrar(deployer, accessController, config);

  const znsContracts : ZNSContracts = {
    accessController,
    addressResolver,
    registry,
    domainToken,
    zeroToken: zeroTokenMock,
    treasury,
    priceOracle,
    registrar,
  };

  // Give 15 ZERO to the deployer and allowance to the treasury
  await zeroTokenMock.connect(deployer).approve(treasury.address, ethers.constants.MaxUint256);
  await zeroTokenMock.transfer(deployer.address, ethers.utils.parseEther("15"));

  return znsContracts;
};
