import {
  ZeroToken,
  ZeroToken__factory,
  ZeroTokenMock,
  ZeroTokenMock__factory,
  ZNSAccessController,
  ZNSAccessController__factory,
  ZNSAddressResolver,
  ZNSAddressResolver__factory,
  ZNSDomainToken,
  ZNSDomainToken__factory,
  ZNSPriceOracle,
  ZNSPriceOracle__factory,
  ZNSRegistrar,
  ZNSRegistrar__factory,
  ZNSRegistry,
  ZNSRegistry__factory,
  ZNSTreasury,
  ZNSTreasury__factory,
} from "../../typechain";
import { DeployZNSParams, PriceParams, RegistrarConfig, ZNSContracts } from "./types";
import * as hre from "hardhat";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  accessControllerName,
  addressResolverName,
  domainTokenName,
  erc1967ProxyName,
  priceConfigDefault,
  priceOracleName,
  registrarName,
  registrationFeePercDefault,
  registryName,
  treasuryName,
  zeroTokenMockName,
  ZNS_DOMAIN_TOKEN_NAME,
  ZNS_DOMAIN_TOKEN_SYMBOL,
} from "./constants";
import { REGISTRAR_ROLE } from "./access";
import { BigNumber } from "ethers";
import { getProxyImplAddress } from "./utils";


export const deployAccessController = async ({
  deployer,
  governorAddresses,
  adminAddresses,
  isTenderlyRun,
} : {
  deployer : SignerWithAddress;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  isTenderlyRun : boolean;
}) : Promise<ZNSAccessController> => {
  const accessControllerFactory = new ZNSAccessController__factory(deployer);
  const controller = await accessControllerFactory.deploy();

  await controller.deployed();

  await controller.initialize(governorAddresses, adminAddresses);

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: accessControllerName,
      address: controller.address,
    });

    console.log(`AccessController deployed at: ${controller.address}`);
  }

  return controller;
};

export const deployRegistry = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string,
  isTenderlyRun : boolean
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

  await registry.deployed();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: registry.address,
    });

    const impl = await getProxyImplAddress(registry.address);

    await hre.tenderly.verify({
      name: registryName,
      address: impl,
    });

    console.log(`ZNSRegistry deployed at:
                proxy: ${registry.address}
                implementation: ${impl}`);
  }

  return registry;
};

export const deployDomainToken = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string,
  isTenderlyRun : boolean
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

  await domainToken.deployed();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: domainToken.address,
    });

    const impl = await getProxyImplAddress(domainToken.address);

    await hre.tenderly.verify({
      name: domainTokenName,
      address: impl,
    });

    console.log(`ZNSDomainToken deployed at:
                proxy: ${domainToken.address}
                implementation: ${impl}`);
  }

  return domainToken;
};

export const deployZeroToken = async (
  deployer : SignerWithAddress,
  isTenderlyRun : boolean
) => {
  const factory = new ZeroToken__factory(deployer);

  const zeroToken = await hre.upgrades.deployProxy(
    factory,
    [
      "ZERO",
      "ZERO",
    ],
    {
      kind: "transparent",
    }
  ) as ZeroToken;

  await zeroToken.deployed();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: zeroToken.address,
    });

    const impl = await getProxyImplAddress(zeroToken.address);

    await hre.tenderly.verify({
      name: zeroTokenMockName,
      address: impl,
    });

    console.log(`ZeroToken deployed at:
                proxy: ${zeroToken.address}
                implementation: ${impl}`);
  }

  // Mint 10,000 ZERO for self
  await zeroToken.mint(zeroToken.address, ethers.utils.parseEther("10000"));

  return zeroToken;
};

export const deployAddressResolver = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string,
  registryAddress : string,
  isTenderlyRun : boolean
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

  await resolver.deployed();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: resolver.address,
    });

    const impl = await getProxyImplAddress(resolver.address);

    await hre.tenderly.verify({
      name: addressResolverName,
      address: impl,
    });

    console.log(`ZNSAddressResolver deployed at:
                proxy: ${resolver.address}
                implementation: ${impl}`);
  }

  return resolver;
};

export const deployPriceOracle = async ({
  deployer,
  accessControllerAddress,
  priceConfig,
  registrationFee,
  isTenderlyRun,
} : {
  deployer : SignerWithAddress;
  accessControllerAddress : string;
  priceConfig : PriceParams;
  registrationFee : BigNumber;
  isTenderlyRun : boolean;
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

  await priceOracle.deployed();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: priceOracle.address,
    });

    const impl = await getProxyImplAddress(priceOracle.address);

    await hre.tenderly.verify({
      name: priceOracleName,
      address: impl,
    });

    console.log(`ZNSPriceOracle deployed at:
                proxy: ${priceOracle.address}
                implementation: ${impl}`);
  }

  return priceOracle;
};

export const deployTreasury = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string,
  priceOracleAddress : string,
  zTokenMockAddress : string,
  zeroVaultAddress : string,
  isTenderlyRun : boolean
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

  await treasury.deployed();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: treasury.address,
    });

    const impl = await getProxyImplAddress(treasury.address);

    await hre.tenderly.verify({
      name: treasuryName,
      address: impl,
    });

    console.log(`ZNSTreasury deployed at:
                proxy: ${treasury.address}
                implementation: ${impl}`);
  }

  return treasury;
};

export const deployRegistrar = async (
  deployer : SignerWithAddress,
  accessController : ZNSAccessController,
  config : RegistrarConfig,
  isTenderlyRun : boolean
) : Promise<ZNSRegistrar> => {
  const registrarFactory = new ZNSRegistrar__factory(deployer);

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
  ) as ZNSRegistrar;

  await registrar.deployed();

  await accessController.connect(deployer).grantRole(REGISTRAR_ROLE, registrar.address);

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: registrar.address,
    });

    const impl = await getProxyImplAddress(registrar.address);

    await hre.tenderly.verify({
      name: registrarName,
      address: impl,
    });

    console.log(`ZNSRegistrar deployed at:
                proxy: ${registrar.address}
                implementation: ${impl}`);
  }

  return registrar;
};

export const deployZeroTokenMock = async (
  deployer : SignerWithAddress,
  isTenderlyRun : boolean
) : Promise<ZeroTokenMock> => {
  const zTokenMockMockFactory = new ZeroTokenMock__factory(deployer);
  const token = await zTokenMockMockFactory.deploy(deployer.address);

  await token.deployed();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: "ZeroTokenMock",
      address: token.address,
    });

    console.log(`ZeroTokenMock deployed at: ${token.address}`);
  }

  return token;
};

/**
 * We use this script to aid in testing, NOT for anything more
 * such as deploying to live testnets or mainnet. Do not use any
 * of the code present for tasks other than testing behavior on a
 * local hardhat build
 */
export const deployZNS = async ({
  deployer,
  governorAddresses,
  adminAddresses,
  priceConfig = priceConfigDefault,
  registrationFeePerc = registrationFeePercDefault,
  zeroVaultAddress = deployer.address,
  isTenderlyRun = false,
} : DeployZNSParams) : Promise<ZNSContracts> => {
  // We deploy every contract as a UUPS proxy, but ZERO is already
  // deployed as a transparent proxy. This means that there is already
  // a proxy admin deployed to the network. Because future deployments
  // warn when this is the case, we silence the warning from hardhat here
  // to not clog the test output.
  await hre.upgrades.silenceWarnings();

  const accessController = await deployAccessController({
    deployer,
    governorAddresses: [deployer.address, ...governorAddresses],
    adminAddresses: [deployer.address, ...adminAddresses],
    isTenderlyRun,
  });

  const registry = await deployRegistry(
    deployer,
    accessController.address,
    isTenderlyRun
  );

  const domainToken = await deployDomainToken(
    deployer,
    accessController.address,
    isTenderlyRun
  );

  // While we do use the real ZeroToken contract, it is only deployed as a mock here
  // for testing purposes that verify expected behavior of other contracts.
  // This should not be used in any other context than deploying to a local hardhat testnet.
  const zeroTokenMock = await deployZeroToken(deployer, isTenderlyRun);

  const addressResolver = await deployAddressResolver(
    deployer,
    accessController.address,
    registry.address,
    isTenderlyRun
  );

  const priceOracle = await deployPriceOracle({
    deployer,
    accessControllerAddress: accessController.address,
    priceConfig,
    registrationFee: registrationFeePerc,
    isTenderlyRun,
  });

  const treasury = await deployTreasury(
    deployer,
    accessController.address,
    priceOracle.address,
    zeroTokenMock.address,
    zeroVaultAddress,
    isTenderlyRun
  );

  const config : RegistrarConfig = {
    treasury,
    registryAddress: registry.address,
    domainTokenAddress: domainToken.address,
    addressResolverAddress: addressResolver.address,
  };

  const registrar = await deployRegistrar(
    deployer,
    accessController,
    config,
    isTenderlyRun
  );

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

  // Give 15 ZERO to the deployer and allowance to the treasury
  await zeroTokenMock.connect(deployer).approve(treasury.address, ethers.constants.MaxUint256);
  await zeroTokenMock.mint(deployer.address, ethers.utils.parseEther("1500"));

  return znsContracts;
};
