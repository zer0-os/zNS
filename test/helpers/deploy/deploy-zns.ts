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
  const address = await controller.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: accessControllerName,
      address,
    });

    console.log(`AccessController deployed at: ${address}`);
  }

  return controller;
};

export const deployRegistry = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string,
  isTenderlyRun = false,
) : Promise<ZNSRegistry> => {
  const registryFactory = new ZNSRegistry__factory(deployer);
  // TODO ethers: figure out why this is happening with OZ guys.
  const registry = await hre.upgrades.deployProxy(
    registryFactory,
    [
      accessControllerAddress,
    ],
    {
      kind: "uups",
    }) as ZNSRegistry;

  await registry.waitForDeployment();
  const address = await registry.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address,
    });

    const impl = await getProxyImplAddress(address);

    await hre.tenderly.verify({
      name: registryName,
      address: impl,
    });

    console.log(`ZNSRegistry deployed at:
                proxy: ${address}
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
  ) as unknown as ZNSDomainToken;

  await domainToken.waitForDeployment();

  const domainTokenAddress = await domainToken.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: domainTokenAddress,
    });

    const impl = await getProxyImplAddress(domainTokenAddress);

    await hre.tenderly.verify({
      name: domainTokenName,
      address: impl,
    });

    console.log(`ZNSDomainToken deployed at:
                proxy: ${domainTokenAddress}
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
  ) as unknown as MeowTokenMock;

  await meowToken.waitForDeployment();

  const address = await meowToken.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: transparentProxyName,
      address,
    });

    const impl = await getProxyImplAddress(address);

    await hre.tenderly.verify({
      name: meowTokenMockName,
      address: impl,
    });

    console.log(`${meowTokenMockName} deployed at:
                proxy: ${address}
                implementation: ${impl}`);
  }

  // Mint 10,000 ZERO for self
  await meowToken.mint(address, ethers.parseEther("10000"));

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

  const address = await resolver.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address,
    });

    const impl = await getProxyImplAddress(address);

    await hre.tenderly.verify({
      name: addressResolverName,
      address: impl,
    });

    console.log(`ZNSAddressResolver deployed at:
                proxy: ${address}
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

  const address = await curvePricer.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address,
    });

    const impl = await getProxyImplAddress(address);

    await hre.tenderly.verify({
      name: curvePricerName,
      address: impl,
    });

    console.log(`${curvePricerName} deployed at:
                proxy: ${address}
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

  const address = await treasury.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address,
    });

    const impl = await getProxyImplAddress(address);

    await hre.tenderly.verify({
      name: treasuryName,
      address: impl,
    });

    console.log(`ZNSTreasury deployed at:
                proxy: ${address}
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
      await accessController.getAddress(),
      config.registryAddress,
      config.curvePricerAddress,
      await config.treasury.getAddress(),
      config.domainTokenAddress,
    ],
    {
      kind: "uups",
    }
  ) as ZNSRootRegistrar;

  await registrar.waitForDeployment();

  const address = await registrar.getAddress();

  await accessController.connect(deployer).grantRole(REGISTRAR_ROLE, await registrar.getAddress());

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address,
    });

    const impl = await getProxyImplAddress(address);

    await hre.tenderly.verify({
      name: registrarName,
      address: impl,
    });

    console.log(`ZNSRootRegistrar deployed at:
                proxy: ${address}
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

  const address = await fixedPricer.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address,
    });

    const impl = await getProxyImplAddress(address);

    await hre.tenderly.verify({
      name: fixedPricerName,
      address: impl,
    });

    console.log(`${fixedPricerName} deployed at:
                proxy: ${address}
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
      await accessController.getAddress(),
      await registry.getAddress(),
      await rootRegistrar.getAddress(),
    ],
    {
      kind: "uups",
    }
  ) as ZNSSubRegistrar;

  await subRegistrar.waitForDeployment();

  const address = await subRegistrar.getAddress();

  // set SubRegistrar on RootRegistrar
  await rootRegistrar.setSubRegistrar(address);

  // give SubRegistrar REGISTRAR_ROLE
  await accessController.connect(admin).grantRole(REGISTRAR_ROLE, address);

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address,
    });

    const impl = await getProxyImplAddress(address);

    await hre.tenderly.verify({
      name: subRegistrarName,
      address: impl,
    });

    console.log(`${subRegistrarName} deployed at:
                proxy: ${address}
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

  const acAddress = await accessController.getAddress();

  const registry = await deployRegistry(
    deployer,
    acAddress,
    isTenderlyRun
  );
  const registryAddress = await registry.getAddress();

  const domainToken = await deployDomainToken(
    deployer,
    acAddress,
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
    acAddress,
    registryAddress,
    isTenderlyRun
  );

  const curvePricer = await deployCurvePricer({
    deployer,
    accessControllerAddress: acAddress,
    registryAddress,
    priceConfig,
    isTenderlyRun,
  });

  const treasury = await deployTreasury({
    deployer,
    accessControllerAddress: acAddress,
    registryAddress,
    zTokenMockAddress: await meowTokenMock.getAddress(),
    zeroVaultAddress,
    isTenderlyRun,
  });

  const config : RegistrarConfig = {
    treasury,
    registryAddress,
    curvePricerAddress: await curvePricer.getAddress(),
    domainTokenAddress: await domainToken.getAddress(),
  };

  const rootRegistrar = await deployRootRegistrar(
    deployer,
    accessController,
    config,
    isTenderlyRun
  );

  const fixedPricer = await deployFixedPricer({
    deployer,
    acAddress,
    regAddress: registryAddress,
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
  await meowTokenMock.connect(deployer).approve(await treasury.getAddress(), ethers.MaxUint256);
  await meowTokenMock.mint(deployer.address, ethers.parseEther("5000000"));
  await registry.connect(deployer).addResolverType(DEFAULT_RESOLVER_TYPE, await addressResolver.getAddress());

  return znsContracts;
};
