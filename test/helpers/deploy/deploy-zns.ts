import {
  ZTokenMock__factory,
  ZNSAccessController,
  ZNSAccessController__factory,
  ZNSAddressResolver,
  ZNSAddressResolver__factory,
  ZNSCurvePricer,
  ZNSDomainToken,
  ZNSDomainToken__factory,
  ZNSFixedPricer__factory,
  ZNSCurvePricer__factory,
  ZNSRegistry,
  ZNSRegistry__factory,
  ZNSTreasury,
  ZNSTreasury__factory,
  ZNSFixedPricer,
  ZTokenMock,
  ZNSStringResolver,
  ZNSStringResolver__factory,
  ZNSChainResolver__factory,
  ZNSChainResolver,
  ZNSRootRegistrarTrunk__factory,
  ZNSRootRegistrarBranch__factory,
  ZNSSubRegistrarTrunk__factory,
  ZNSSubRegistrarBranch__factory,
  PolygonZkEVMBridgeV2Mock__factory,
  PolygonZkEVMBridgeV2Mock,
  ZNSZChainPortal__factory,
  ZNSZChainPortal,
  ZNSEthereumPortal__factory,
  ZNSEthereumPortal,
  ZNSRootRegistrarTrunk,
  ZNSRootRegistrarBranch,
  ZNSSubRegistrarTrunk, ZNSSubRegistrarBranch,
} from "../../../typechain";
import { DeployZNSParams, RegistrarConfig, IZNSContractsLocal } from "../types";
import * as hre from "hardhat";
import { upgrades, ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  erc1967ProxyName,
  fixedPricerName,
  DEFAULT_PRICE_CONFIG,
  ZNS_DOMAIN_TOKEN_NAME,
  ZNS_DOMAIN_TOKEN_SYMBOL,
  DEFAULT_ROYALTY_FRACTION,
  DEFAULT_RESOLVER_TYPE,
  ZCHAIN_ID_TEST_DEFAULT,
  NETWORK_ID_L2_TEST_DEFAULT,
  NETWORK_ID_L1_TEST_DEFAULT,
  INITIAL_ADMIN_DELAY_DEFAULT,
  INITIAL_SUPPLY_DEFAULT,
  INFLATION_RATES_DEFAULT,
  FINAL_INFLATION_RATE_DEFAULT,
  Z_NAME_DEFAULT,
  Z_SYMBOL_DEFAULT,
} from "../constants";
import { PORTAL_ROLE, DOMAIN_TOKEN_ROLE, REGISTRAR_ROLE } from "../../../src/deploy/constants";
import { getProxyImplAddress } from "../utils";
import { ICurvePriceConfig } from "../../../src/deploy/missions/types";
import { transparentProxyName, znsNames } from "../../../src/deploy/missions/contracts/names";
import { TSupportedChain } from "../../../src/deploy/missions/contracts/cross-chain/portals/types";
import { SupportedChains } from "../../../src/deploy/missions/contracts/cross-chain/portals/get-portal-dm";


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
  const proxyAddress = await controller.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: znsNames.accessController.contract,
      address: proxyAddress,
    });

    console.log(`AccessController deployed at: ${proxyAddress}`);
  }

  return controller as unknown as ZNSAccessController;
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
    });

  await registry.waitForDeployment();
  const proxyAddress = await registry.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: znsNames.registry.contract,
      address: impl,
    });

    console.log(`ZNSRegistry deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return registry as unknown as ZNSRegistry;
};

export const deployDomainToken = async (
  deployer : SignerWithAddress,
  accessController : ZNSAccessController,
  royaltyReceiverAddress : string,
  royaltyFraction : bigint,
  isTenderlyRun : boolean,
  registry : ZNSRegistry,
) : Promise<ZNSDomainToken> => {
  const domainTokenFactory = new ZNSDomainToken__factory(deployer);
  const domainToken = await upgrades.deployProxy(
    domainTokenFactory,
    [
      await accessController.getAddress(),
      ZNS_DOMAIN_TOKEN_NAME,
      ZNS_DOMAIN_TOKEN_SYMBOL,
      royaltyReceiverAddress,
      royaltyFraction,
      await registry.getAddress(),
    ],
    {
      kind: "uups",
    }
  ) as unknown as ZNSDomainToken;

  await domainToken.waitForDeployment();

  const proxyAddress = await domainToken.getAddress();

  await accessController.connect(deployer).grantRole(DOMAIN_TOKEN_ROLE, proxyAddress);

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: znsNames.domainToken.contract,
      address: impl,
    });

    console.log(`ZNSDomainToken deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return domainToken as unknown as ZNSDomainToken;
};

export const deployZToken = async (
  deployer : SignerWithAddress,
  governorAddresses : Array<string>,
  adminAddresses : Array<string>,
  isTenderlyRun : boolean
) : Promise<ZTokenMock> => {
  const Factory = new ZTokenMock__factory(deployer);
  const zToken = await Factory.deploy(
    Z_NAME_DEFAULT,
    Z_SYMBOL_DEFAULT,
    governorAddresses[0],
    INITIAL_ADMIN_DELAY_DEFAULT,
    deployer.address,
    adminAddresses[0],
    INITIAL_SUPPLY_DEFAULT,
    INFLATION_RATES_DEFAULT,
    FINAL_INFLATION_RATE_DEFAULT
  ) as ZTokenMock;

  await zToken.waitForDeployment();
  const proxyAddress = await zToken.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: transparentProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: znsNames.zToken.contractMock,
      address: impl,
    });

    console.log(`${znsNames.zToken.contractMock} deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return zToken as unknown as ZTokenMock;
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
  );

  await resolver.waitForDeployment();

  const proxyAddress = await resolver.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: znsNames.addressResolver.contract,
      address: impl,
    });

    console.log(`ZNSAddressResolver deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return resolver as unknown as ZNSAddressResolver;
};

export const deployStringResolver = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string,
  registryAddress : string,
  isTenderlyRun : boolean,
) => {
  const stringResolverFactory = new ZNSStringResolver__factory(deployer);

  const resolver = await upgrades.deployProxy(
    stringResolverFactory,
    [
      accessControllerAddress,
      registryAddress,
    ],
    {
      kind: "uups",
    }
  );

  await resolver.waitForDeployment();

  const proxyAddress = await resolver.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: znsNames.stringResolver.contract,
      address: impl,
    });

    console.log(`ZNSStringResolver deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return resolver as unknown as ZNSStringResolver;
};

export const deployChainResolver = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string,
  registryAddress : string,
  isTenderlyRun : boolean,
) => {
  const chainResolverFactory = new ZNSChainResolver__factory(deployer);

  const resolver = await upgrades.deployProxy(
    chainResolverFactory,
    [
      accessControllerAddress,
      registryAddress,
    ],
    {
      kind: "uups",
    }
  );

  await resolver.waitForDeployment();

  const proxyAddress = await resolver.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: znsNames.chainResolver.contract,
      address: impl,
    });

    console.log(`ZNSChainResolver deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return resolver as unknown as ZNSChainResolver;
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
  );

  await curvePricer.waitForDeployment();

  const proxyAddress = await curvePricer.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: znsNames.curvePricer.contract,
      address: impl,
    });

    console.log(`${znsNames.curvePricer.contract} deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return curvePricer as unknown as ZNSCurvePricer;
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
  const treasury = await upgrades.deployProxy(treasuryFactory,
    [
      accessControllerAddress,
      registryAddress,
      zTokenMockAddress,
      zeroVaultAddress,
    ],
    {
      kind: "uups",
    }
  );

  await treasury.waitForDeployment();
  const proxyAddress = await treasury.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: znsNames.treasury.contract,
      address: impl,
    });

    console.log(`ZNSTreasury deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return treasury as unknown as ZNSTreasury;
};

export const deployRootRegistrar = async (
  deployer : SignerWithAddress,
  accessController : ZNSAccessController,
  config : RegistrarConfig,
  srcChainName = SupportedChains.eth,
  isTenderlyRun : boolean
) : Promise<ZNSRootRegistrarTrunk | ZNSRootRegistrarBranch> => {
  let registrarFactory;
  let name;
  if (srcChainName === SupportedChains.eth) {
    registrarFactory = new ZNSRootRegistrarTrunk__factory(deployer);
    name = znsNames.rootRegistrar.contractTrunk;
  } else {
    registrarFactory = new ZNSRootRegistrarBranch__factory(deployer);
    name = znsNames.rootRegistrar.contractBranch;
  }

  const registrar = await upgrades.deployProxy(
    registrarFactory,
    [
      await accessController.getAddress(),
      config.registryAddress,
      config.curvePricerAddress,
      config.treasuryAddress,
      config.domainTokenAddress,
    ],
    {
      kind: "uups",
    }
  );

  await registrar.waitForDeployment();
  const proxyAddress = await registrar.getAddress();

  await accessController.connect(deployer).grantRole(REGISTRAR_ROLE, proxyAddress);

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name,
      address: impl,
    });

    console.log(`${name} deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return registrar as unknown as ZNSRootRegistrarTrunk | ZNSRootRegistrarBranch;
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
  );

  await fixedPricer.waitForDeployment();
  const proxyAddress = await fixedPricer.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: znsNames.fixedPricer.contract,
      address: impl,
    });

    console.log(`${fixedPricerName} deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return fixedPricer as unknown as ZNSFixedPricer;
};

export const deploySubRegistrar = async ({
  deployer,
  accessController,
  registry,
  rootRegistrar,
  admin,
  srcChainName = SupportedChains.eth,
  isTenderlyRun = false,
} : {
  deployer : SignerWithAddress;
  accessController : ZNSAccessController;
  registry : ZNSRegistry;
  rootRegistrar : ZNSRootRegistrarTrunk | ZNSRootRegistrarBranch;
  admin : SignerWithAddress;
  srcChainName ?: TSupportedChain;
  isTenderlyRun ?: boolean;
}) => {
  let subRegistrarFactory;
  let name;
  if (srcChainName === SupportedChains.eth) {
    subRegistrarFactory = new ZNSSubRegistrarTrunk__factory(deployer);
    name = znsNames.subRegistrar.contractTrunk;
  } else {
    subRegistrarFactory = new ZNSSubRegistrarBranch__factory(deployer);
    name = znsNames.subRegistrar.contractBranch;
  }

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
  );

  await subRegistrar.waitForDeployment();
  const proxyAddress = await subRegistrar.getAddress();

  // set SubRegistrar on RootRegistrar
  await rootRegistrar.setSubRegistrar(proxyAddress);

  // give SubRegistrar REGISTRAR_ROLE
  await accessController.connect(admin).grantRole(REGISTRAR_ROLE, proxyAddress);

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name,
      address: impl,
    });

    console.log(`${name} deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return subRegistrar as unknown as ZNSSubRegistrarTrunk | ZNSSubRegistrarBranch;
};

export const deployZkEvmBridgeMock = async (
  deployer : SignerWithAddress,
  networkId : bigint,
  bridgeTokenAddress : string,
  isTenderlyRun : boolean,
) => {
  const bridgeFact = new PolygonZkEVMBridgeV2Mock__factory(deployer);

  const bridge = await hre.upgrades.deployProxy(
    bridgeFact,
    [
      networkId,
      bridgeTokenAddress,
    ],
    {
      kind: "transparent",
    }
  );

  await bridge.waitForDeployment();
  const proxyAddress = await bridge.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: transparentProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: znsNames.zkEvmBridge.contractMock,
      address: impl,
    });

    console.log(`${znsNames.zkEvmBridge.contractMock} deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return bridge as unknown as PolygonZkEVMBridgeV2Mock;
};

export const deployZChainPortal = async ({
  deployer,
  destNetworkId,
  destChainName,
  destChainId,
  bridgeAddress,
  contractAddresses,
  isTenderlyRun,
} : {
  deployer : SignerWithAddress;
  destNetworkId : bigint;
  destChainName : TSupportedChain;
  destChainId : bigint;
  bridgeAddress : string;
  contractAddresses : {
    accessController : string;
    rootRegistrar : string;
    subRegistrar : string;
    treasury : string;
    registry : string;
    chainResolver : string;
  };
  isTenderlyRun : boolean;
}) => {
  const factory = new ZNSZChainPortal__factory(deployer);

  const zChainPortal = await hre.upgrades.deployProxy(
    factory,
    [
      destNetworkId,
      destChainName,
      destChainId,
      bridgeAddress,
      contractAddresses,
    ],
    {
      kind: "uups",
    }
  );

  await zChainPortal.waitForDeployment();
  const proxyAddress = await zChainPortal.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: znsNames.zPortal.contract,
      address: impl,
    });

    console.log(`${znsNames.zPortal.contract} deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return zChainPortal as unknown as ZNSZChainPortal;
};

export const deployEthPortal = async ({
  deployer,
  accessController,
  zkEvmBridgeAddress,
  srcZnsPortalAddress,
  registryAddress,
  domainTokenAddress,
  rootRegistrarAddress,
  subRegistrarAddress,
  isTenderlyRun,
} : {
  deployer : SignerWithAddress;
  accessController : ZNSAccessController;
  zkEvmBridgeAddress : string;
  srcZnsPortalAddress : string;
  registryAddress : string;
  domainTokenAddress : string;
  rootRegistrarAddress : string;
  subRegistrarAddress : string;
  isTenderlyRun : boolean;
}) => {
  const factory = new ZNSEthereumPortal__factory(deployer);

  const ethPortal = await hre.upgrades.deployProxy(
    factory,
    [
      accessController.target,
      zkEvmBridgeAddress,
      srcZnsPortalAddress,
      registryAddress,
      domainTokenAddress,
      rootRegistrarAddress,
      subRegistrarAddress,
    ],
    {
      kind: "uups",
    }
  );

  await ethPortal.waitForDeployment();
  const proxyAddress = await ethPortal.getAddress();

  await accessController.connect(deployer).grantRole(PORTAL_ROLE, proxyAddress);

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: znsNames.ethPortal.contract,
      address: impl,
    });

    console.log(`${znsNames.ethPortal.contract} deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return ethPortal as unknown as ZNSEthereumPortal;
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
  srcChainName = SupportedChains.eth,
  srcNetworkId = NETWORK_ID_L1_TEST_DEFAULT,
  bridgeTokenAddress = ethers.ZeroAddress,
  destNetworkId = NETWORK_ID_L2_TEST_DEFAULT,
  destChainName = SupportedChains.z,
  destChainId = ZCHAIN_ID_TEST_DEFAULT,
  srcZnsPortalAddress = ethers.ZeroAddress,
  isTenderlyRun = false,
} : DeployZNSParams) : Promise<IZNSContractsLocal> => {
  // We deploy every contract as a UUPS proxy, but ZERO is already
  // deployed as a transparent proxy. This means that there is already
  // a proxy admin deployed to the network. Because future deployments
  // warn when this is the case, we silence the warning from hardhat here
  // to not clog the test output.
  await hre.upgrades.silenceWarnings();

  if (!zeroVaultAddress) {
    zeroVaultAddress = deployer.address;
  }

  const accessController = await deployAccessController({
    deployer,
    governorAddresses: [deployer.address, ...governorAddresses],
    adminAddresses: [deployer.address, ...adminAddresses],
    isTenderlyRun,
  });

  const registry = await deployRegistry(
    deployer,
    await accessController.getAddress(),
    isTenderlyRun
  );

  const domainToken = await deployDomainToken(
    deployer,
    accessController,
    zeroVaultAddress,
    DEFAULT_ROYALTY_FRACTION,
    isTenderlyRun,
    registry
  );

  // While we do use the real ZeroToken contract, it is only deployed as a mock here
  // for testing purposes that verify expected behavior of other contracts.
  // This should not be used in any other context than deploying to a local hardhat testnet.
  const zTokenMock = await deployZToken(
    deployer,
    governorAddresses,
    adminAddresses,
    isTenderlyRun,
  );

  const addressResolver = await deployAddressResolver(
    deployer,
    await accessController.getAddress(),
    await registry.getAddress(),
    isTenderlyRun
  );

  const stringResolver = await deployStringResolver(
    deployer,
    await accessController.getAddress(),
    await registry.getAddress(),
    isTenderlyRun
  );

  const curvePricer = await deployCurvePricer({
    deployer,
    accessControllerAddress: await accessController.getAddress(),
    registryAddress: await registry.getAddress(),
    priceConfig,
    isTenderlyRun,
  });

  const treasury = await deployTreasury({
    deployer,
    accessControllerAddress: await accessController.getAddress(),
    registryAddress: await registry.getAddress(),
    zTokenMockAddress: await zTokenMock.getAddress(),
    zeroVaultAddress,
    isTenderlyRun,
  });

  const config : RegistrarConfig = {
    treasuryAddress: await treasury.getAddress(),
    registryAddress: await registry.getAddress(),
    curvePricerAddress: await curvePricer.getAddress(),
    domainTokenAddress: await domainToken.getAddress(),
  };

  const rootRegistrar = await deployRootRegistrar(
    deployer,
    accessController,
    config,
    srcChainName,
    isTenderlyRun
  );

  const fixedPricer = await deployFixedPricer({
    deployer,
    acAddress: await accessController.getAddress(),
    regAddress: await registry.getAddress(),
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

  const chainResolver = await deployChainResolver(
    deployer,
    await accessController.getAddress(),
    await registry.getAddress(),
    isTenderlyRun
  );

  const zkEvmBridge = await deployZkEvmBridgeMock(
    deployer,
    srcNetworkId,
    bridgeTokenAddress,
    isTenderlyRun
  );

  let zChainPortal;
  let ethPortal;
  if (srcChainName === SupportedChains.eth) {
    zChainPortal = await deployZChainPortal({
      deployer,
      destNetworkId,
      destChainName,
      destChainId,
      bridgeAddress: await zkEvmBridge.getAddress(),
      contractAddresses: {
        accessController: await accessController.getAddress(),
        rootRegistrar: await rootRegistrar.getAddress(),
        subRegistrar: await subRegistrar.getAddress(),
        treasury: await treasury.getAddress(),
        registry: await registry.getAddress(),
        chainResolver: await chainResolver.getAddress(),
      },
      isTenderlyRun,
    });
  } else {
    ethPortal = await deployEthPortal({
      deployer,
      accessController,
      zkEvmBridgeAddress: await zkEvmBridge.getAddress(),
      srcZnsPortalAddress,
      registryAddress: await registry.getAddress(),
      domainTokenAddress: await domainToken.getAddress(),
      rootRegistrarAddress: await rootRegistrar.getAddress(),
      subRegistrarAddress: await subRegistrar.getAddress(),
      isTenderlyRun,
    });
  }

  const znsContracts : IZNSContractsLocal = {
    accessController,
    registry,
    domainToken,
    zToken: zTokenMock,
    addressResolver,
    stringResolver,
    curvePricer,
    treasury,
    rootRegistrar,
    fixedPricer,
    subRegistrar,
    chainResolver,
    zkEvmBridge,
    zChainPortal,
    ethPortal,
    zeroVaultAddress,
  };

  await registry.connect(deployer).addResolverType(DEFAULT_RESOLVER_TYPE, await addressResolver.getAddress());

  return znsContracts;
};
