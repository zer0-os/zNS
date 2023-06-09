import {
  ZeroTokenMock,
  ZeroTokenMock__factory,
  ZNSAccessController,
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
import { DeployZNSParams, PriceParams, RegistrarConfig, ZNSContracts } from "./types";
import { ethers, upgrades } from "hardhat";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  priceConfigDefault,
  registrationFeePercDefault,
  ZNS_DOMAIN_TOKEN_NAME,
  ZNS_DOMAIN_TOKEN_SYMBOL,
} from "./constants";
import { deployAccessController, REGISTRAR_ROLE } from "./access";
import { BigNumber } from "ethers";

export const deployRegistry = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string
) : Promise<ZNSRegistry> => {
  const registryFactory = new ZNSRegistry__factory(deployer);
  const registry = await hre.upgrades.deployProxy(
    registryFactory,
    [
      accessControllerAddress,
    ],
    {
      kind: "uups",
    }) as ZNSRegistry;

  return registry;
};

export const deployAddressResolver = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string,
  registryAddress : string
) : Promise<ZNSAddressResolver> => {
  const addressResolverFactory = new ZNSAddressResolver__factory(deployer);

  const resolver = await upgrades.deployProxy(
    addressResolverFactory,
    [
      accessControllerAddress,
      registryAddress,
    ],
    {
      kind: "uups",
    }
  ) as ZNSAddressResolver;

  return resolver;
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

  const priceOracle = await upgrades.deployProxy(
    priceOracleFactory,
    [
      accessControllerAddress,
      priceConfig,
      registrationFee,
    ],
    {
      kind: "uups",
    }
  ) as ZNSPriceOracle;

  return priceOracle;
};

export const deployDomainToken = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string
) : Promise<ZNSDomainToken> => {
  const domainTokenFactory = new ZNSDomainToken__factory(deployer);
  const domainToken = await upgrades.deployProxy(
    domainTokenFactory,
    [
      accessControllerAddress,
      ZNS_DOMAIN_TOKEN_NAME,
      ZNS_DOMAIN_TOKEN_SYMBOL,
    ],
    {
      kind: "uups",
    }
  ) as ZNSDomainToken;

  return domainToken;
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
  priceOracleAddress : string,
  zTokenMockAddress : string,
  zeroVaultAddress : string
) : Promise<ZNSTreasury> => {
  const treasuryFactory = new ZNSTreasury__factory(deployer);
  const treasury : ZNSTreasury = await upgrades.deployProxy(treasuryFactory,
    [
      accessControllerAddress,
      priceOracleAddress,
      zTokenMockAddress,
      zeroVaultAddress,
    ],
    {
      kind: "uups",
    }
  ) as ZNSTreasury;

  return treasury;
};

export const deployRegistrar = async (
  deployer : SignerWithAddress,
  accessController : ZNSAccessController,
  config : RegistrarConfig
) : Promise<ZNSEthRegistrar> => {
  const registrarFactory = new ZNSEthRegistrar__factory(deployer);

  const registrar = await upgrades.deployProxy(
    registrarFactory,
    [
      accessController.address,
      config.registryAddress,
      config.treasury.address,
      config.domainTokenAddress,
      config.addressResolverAddress,
    ],
    {
      kind: "uups",
    }
  ) as ZNSEthRegistrar;

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
} : DeployZNSParams) : Promise<ZNSContracts> => {
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
    registry,
    domainToken,
    zeroToken: zeroTokenMock,
    addressResolver,
    priceOracle,
    treasury,
    registrar,
  };

  // Final configuration steps
  // TODO AC: remove all redundant calls here! and delete hashing of the root and the need
  // for Registrar to be owner/operator of the root

  // TODO verify tests are fine without this line
  // await registry.connect(deployer).setOwnerOperator(registrar.address, true);

  // Give 15 ZERO to the deployer and allowance to the treasury
  await zeroTokenMock.connect(deployer).approve(treasury.address, ethers.constants.MaxUint256);
  await zeroTokenMock.transfer(deployer.address, ethers.utils.parseEther("15"));

  return znsContracts;
};
