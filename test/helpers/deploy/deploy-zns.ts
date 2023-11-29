import {
  MeowTokenMock__factory,
  ZNSAccessController,
  ZNSAccessController__factory,
  ZNSAddressResolver,
  ZNSAddressResolver__factory,
  ZNSCurvePricer,
  ZNSDomainToken,
  ZNSDomainToken__factory,
  ZNSFixedPricer__factory,
  ZNSCurvePricer__factory,
  ZNSRootRegistrar,
  ZNSRootRegistrar__factory,
  ZNSRegistry,
  ZNSRegistry__factory,
  ZNSSubRegistrar__factory,
  ZNSTreasury,
  ZNSTreasury__factory,
  ZNSFixedPricer,
  ZNSSubRegistrar,
  MeowTokenMock,
} from "../../../typechain";
import { DeployZNSParams, RegistrarConfig, IZNSContracts } from "../types";
import * as hre from "hardhat";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  accessControllerName,
  addressResolverName,
  domainTokenName,
  erc1967ProxyName,
  fixedPricerName,
  DEFAULT_PRICE_CONFIG,
  curvePricerName,
  registrarName,
  registryName,
  subRegistrarName,
  treasuryName,
  meowTokenMockName,
  ZNS_DOMAIN_TOKEN_NAME,
  ZNS_DOMAIN_TOKEN_SYMBOL,
  DEFAULT_ROYALTY_FRACTION,
  DEFAULT_RESOLVER_TYPE,
} from "../constants";
import { REGISTRAR_ROLE } from "../../../src/deploy/constants";
import { getProxyImplAddress } from "../utils";
import { ICurvePriceConfig } from "../../../src/deploy/missions/types";
import { meowTokenName, meowTokenSymbol } from "../../../src/deploy/missions/contracts";
import { transparentProxyName } from "../../../src/deploy/missions/contracts/names";


export const deployAccessController = async ({
  deployer,
  governorAddresses,
  adminAddresses,
  isTenderlyRun = false,
} : {
  deployer : SignerWithAddress;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  isTenderlyRun ?: boolean;
}) : Promise<ZNSAccessController> => {
  const accessControllerFactory = new ZNSAccessController__factory(deployer);
  const controller = await accessControllerFactory.deploy(governorAddresses, adminAddresses);

  await controller.waitForDeployment();

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
  isTenderlyRun = false,
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

  await registry.waitForDeployment();

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
  royaltyReceiverAddress : string,
  royaltyFraction : bigint,
  isTenderlyRun : boolean
) : Promise<ZNSDomainToken> => {
  const domainTokenFactory = new ZNSDomainToken__factory(deployer);
  const domainToken = await upgrades.deployProxy(
    domainTokenFactory,
    [
      accessControllerAddress,
      ZNS_DOMAIN_TOKEN_NAME,
      ZNS_DOMAIN_TOKEN_SYMBOL,
      royaltyReceiverAddress,
      royaltyFraction,
    ],
    {
      kind: "uups",
    }
  ) as ZNSDomainToken;

  await domainToken.waitForDeployment();

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

export const deployMeowToken = async (
  deployer : SignerWithAddress,
  isTenderlyRun : boolean
) => {
  const factory = new MeowTokenMock__factory(deployer);

  const meowToken = await hre.upgrades.deployProxy(
    factory,
    [
      meowTokenName,
      meowTokenSymbol,
    ],
    {
      kind: "transparent",
    }
  ) as MeowTokenMock;

  await meowToken.waitForDeployment();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: transparentProxyName,
      address: meowToken.address,
    });

    const impl = await getProxyImplAddress(meowToken.address);

    await hre.tenderly.verify({
      name: meowTokenMockName,
      address: impl,
    });

    console.log(`${meowTokenMockName} deployed at:
                proxy: ${meowToken.address}
                implementation: ${impl}`);
  }

  // Mint 10,000 ZERO for self
  await meowToken.mint(meowToken.address, ethers.utils.parseEther("10000"));

  return meowToken;
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

  await resolver.waitForDeployment();

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

export const deployCurvePricer = async ({
  deployer,
  accessControllerAddress,
  registryAddress,
  priceConfig,
  isTenderlyRun,
} : {
  deployer : SignerWithAddress;
  accessControllerAddress : string;
  registryAddress : string;
  priceConfig : ICurvePriceConfig;
  isTenderlyRun : boolean;
}) : Promise<ZNSCurvePricer> => {
  const curveFactory = new ZNSCurvePricer__factory(deployer);

  const curvePricer = await upgrades.deployProxy(
    curveFactory,
    [
      accessControllerAddress,
      registryAddress,
      priceConfig,
    ],
    {
      kind: "uups",
    }
  ) as ZNSCurvePricer;

  await curvePricer.waitForDeployment();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: curvePricer.address,
    });

    const impl = await getProxyImplAddress(curvePricer.address);

    await hre.tenderly.verify({
      name: curvePricerName,
      address: impl,
    });

    console.log(`${curvePricerName} deployed at:
                proxy: ${curvePricer.address}
                implementation: ${impl}`);
  }

  return curvePricer;
};

export const deployTreasury = async ({
  deployer,
  accessControllerAddress,
  registryAddress,
  zTokenMockAddress,
  zeroVaultAddress,
  isTenderlyRun = false,
} : {
  deployer : SignerWithAddress;
  accessControllerAddress : string;
  registryAddress : string;
  zTokenMockAddress : string;
  zeroVaultAddress : string;
  isTenderlyRun : boolean;
}) : Promise<ZNSTreasury> => {
  const treasuryFactory = new ZNSTreasury__factory(deployer);
  const treasury : ZNSTreasury = await upgrades.deployProxy(treasuryFactory,
    [
      accessControllerAddress,
      registryAddress,
      zTokenMockAddress,
      zeroVaultAddress,
    ],
    {
      kind: "uups",
    }
  ) as ZNSTreasury;

  await treasury.waitForDeployment();

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

export const deployRootRegistrar = async (
  deployer : SignerWithAddress,
  accessController : ZNSAccessController,
  config : RegistrarConfig,
  isTenderlyRun : boolean
) : Promise<ZNSRootRegistrar> => {
  const registrarFactory = new ZNSRootRegistrar__factory(deployer);

  const registrar = await upgrades.deployProxy(
    registrarFactory,
    [
      accessController.address,
      config.registryAddress,
      config.curvePricerAddress,
      config.treasury.address,
      config.domainTokenAddress,
    ],
    {
      kind: "uups",
    }
  ) as ZNSRootRegistrar;

  await registrar.waitForDeployment();

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

    console.log(`ZNSRootRegistrar deployed at:
                proxy: ${registrar.address}
                implementation: ${impl}`);
  }

  return registrar;
};

export const deployFixedPricer = async ({
  deployer,
  acAddress,
  regAddress,
  isTenderlyRun = false,
} : {
  deployer : SignerWithAddress;
  acAddress : string;
  regAddress : string;
  isTenderlyRun ?: boolean;
}) => {
  const pricerFactory = new ZNSFixedPricer__factory(deployer);
  const fixedPricer = await upgrades.deployProxy(
    pricerFactory,
    [
      acAddress,
      regAddress,
    ],
    {
      kind: "uups",
    }
  ) as ZNSFixedPricer;

  await fixedPricer.waitForDeployment();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: fixedPricer.address,
    });

    const impl = await getProxyImplAddress(fixedPricer.address);

    await hre.tenderly.verify({
      name: fixedPricerName,
      address: impl,
    });

    console.log(`${fixedPricerName} deployed at:
                proxy: ${fixedPricer.address}
                implementation: ${impl}`);
  }

  return fixedPricer;
};

export const deploySubRegistrar = async ({
  deployer,
  accessController,
  registry,
  rootRegistrar,
  admin,
  isTenderlyRun = false,
} : {
  deployer : SignerWithAddress;
  accessController : ZNSAccessController;
  registry : ZNSRegistry;
  rootRegistrar : ZNSRootRegistrar;
  admin : SignerWithAddress;
  isTenderlyRun ?: boolean;
}) => {
  const subRegistrarFactory = new ZNSSubRegistrar__factory(deployer);
  const subRegistrar = await upgrades.deployProxy(
    subRegistrarFactory,
    [
      accessController.address,
      registry.address,
      rootRegistrar.address,
    ],
    {
      kind: "uups",
    }
  ) as ZNSSubRegistrar;

  await subRegistrar.waitForDeployment();

  // set SubRegistrar on RootRegistrar
  await rootRegistrar.setSubRegistrar(subRegistrar.address);

  // give SubRegistrar REGISTRAR_ROLE
  await accessController.connect(admin).grantRole(REGISTRAR_ROLE, subRegistrar.address);

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: subRegistrar.address,
    });

    const impl = await getProxyImplAddress(subRegistrar.address);

    await hre.tenderly.verify({
      name: subRegistrarName,
      address: impl,
    });

    console.log(`${subRegistrarName} deployed at:
                proxy: ${subRegistrar.address}
                implementation: ${impl}`);
  }

  return subRegistrar;
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
  priceConfig = DEFAULT_PRICE_CONFIG,
  zeroVaultAddress = deployer.address,
  isTenderlyRun = false,
} : DeployZNSParams) : Promise<IZNSContracts> => {
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
    zeroVaultAddress,
    DEFAULT_ROYALTY_FRACTION,
    isTenderlyRun
  );

  // While we do use the real ZeroToken contract, it is only deployed as a mock here
  // for testing purposes that verify expected behavior of other contracts.
  // This should not be used in any other context than deploying to a local hardhat testnet.
  const meowTokenMock = await deployMeowToken(deployer, isTenderlyRun);

  const addressResolver = await deployAddressResolver(
    deployer,
    accessController.address,
    registry.address,
    isTenderlyRun
  );

  const curvePricer = await deployCurvePricer({
    deployer,
    accessControllerAddress: accessController.address,
    registryAddress: registry.address,
    priceConfig,
    isTenderlyRun,
  });

  const treasury = await deployTreasury({
    deployer,
    accessControllerAddress: accessController.address,
    registryAddress: registry.address,
    zTokenMockAddress: meowTokenMock.address,
    zeroVaultAddress,
    isTenderlyRun,
  });

  const config : RegistrarConfig = {
    treasury,
    registryAddress: registry.address,
    curvePricerAddress: curvePricer.address,
    domainTokenAddress: domainToken.address,
  };

  const rootRegistrar = await deployRootRegistrar(
    deployer,
    accessController,
    config,
    isTenderlyRun
  );

  const fixedPricer = await deployFixedPricer({
    deployer,
    acAddress: accessController.address,
    regAddress: registry.address,
    isTenderlyRun,
  });

  const subRegistrar = await deploySubRegistrar({
    deployer,
    accessController,
    registry,
    rootRegistrar,
    admin: deployer,
    isTenderlyRun,
  });

  const znsContracts : IZNSContracts = {
    accessController,
    registry,
    domainToken,
    meowToken: meowTokenMock,
    addressResolver,
    curvePricer,
    treasury,
    rootRegistrar,
    fixedPricer,
    subRegistrar,
    zeroVaultAddress,
  };

  // Give 15 ZERO to the deployer and allowance to the treasury
  await meowTokenMock.connect(deployer).approve(treasury.address, ethers.constants.MaxUint256);
  await meowTokenMock.mint(deployer.address, ethers.utils.parseEther("5000000"));
  await registry.connect(deployer).addResolverType(DEFAULT_RESOLVER_TYPE, addressResolver.address);

  return znsContracts;
};
