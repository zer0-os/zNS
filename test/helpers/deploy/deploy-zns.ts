import {
  ERC20Mock__factory,
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
  ERC20Mock,
} from "../../../typechain";
import { DeployZNSParams, RegistrarConfig, IZNSContractsLocal } from "../types";
import * as hre from "hardhat";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  accessControllerName,
  addressResolverName,
  domainTokenName,
  erc1967ProxyName,
  fixedPricerName,
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
  DEFAULT_CURVE_PRICE_CONFIG_BYTES,
} from "../constants";
import { DOMAIN_TOKEN_ROLE, REGISTRAR_ROLE } from "../../../src/deploy/constants";
import { getProxyImplAddress } from "../utils";
import { meowTokenName, meowTokenSymbol } from "../../../src/deploy/missions/contracts";

const logDeploy = (name : string, address : string, args : any[], implAddress ?: string) => {
  console.log(`Deployed ${name} at: ${address}`);
  if (implAddress) {
    console.log(`Implementation address: ${implAddress}`);
  }
  console.log(`With args: ${args.join(", ")}`);
}

const verifyContract = async (contractAddress : string, args ?: any[]) => {
  if (hre.network.name !== "hardhat") {
    await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: args,
    });
  }
}

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
  const controller = await accessControllerFactory.deploy(
    governorAddresses,
    adminAddresses
  );

  await controller.waitForDeployment();
  const proxyAddress = await controller.getAddress();

  if (isTenderlyRun) {
    await hre.ethers.verify({
      name: accessControllerName,
      address: proxyAddress,
    });
  }

  await verifyContract(proxyAddress, [
    governorAddresses,
    adminAddresses,
  ]);

  logDeploy("AccessController", proxyAddress, [governorAddresses, adminAddresses]);

  return controller as ZNSAccessController;
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
  const impl = await getProxyImplAddress(proxyAddress);
  
  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    await hre.tenderly.verify({
      name: registryName,
      address: impl,
    });
  }

  await verifyContract(proxyAddress, [
    accessControllerAddress,
  ]);

  logDeploy("ZNSRegistry", proxyAddress, [accessControllerAddress], impl);

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
      name: domainTokenName,
      address: impl,
    });

    console.log(`ZNSDomainToken deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  await verifyContract(proxyAddress, [
    await accessController.getAddress(),
    ZNS_DOMAIN_TOKEN_NAME,
    ZNS_DOMAIN_TOKEN_SYMBOL,
    royaltyReceiverAddress,
    royaltyFraction.toString(),
    await registry.getAddress(),
  ]);

  logDeploy("ZNSDomainToken", proxyAddress, [
    await accessController.getAddress(),
    ZNS_DOMAIN_TOKEN_NAME,
    ZNS_DOMAIN_TOKEN_SYMBOL,
    royaltyReceiverAddress,
    royaltyFraction.toString(),
    await registry.getAddress(),
  ]);

  return domainToken as unknown as ZNSDomainToken;
};

export const deployMeowToken = async (
  deployer : SignerWithAddress,
  isTenderlyRun : boolean
) : Promise<ERC20Mock> => {
  const factory = new ERC20Mock__factory(deployer);

  const meowToken = await factory.deploy(
    meowTokenName,
    meowTokenSymbol,
  ) as unknown as ERC20Mock;

  await meowToken.waitForDeployment();
  const tokenAddress = await meowToken.getAddress();

  await hre.ethers.ver

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: meowTokenMockName,
      address: tokenAddress,
    });

    console.log(
      `${meowTokenMockName} deployed at:
      implementation: ${tokenAddress}`
    );
  }

  await verifyContract(tokenAddress, [
    meowTokenName,
    meowTokenSymbol,
  ]);

  logDeploy("MeowToken", tokenAddress, [meowTokenName, meowTokenSymbol]);

  // Mint 10,000 ZERO for self
  await meowToken.mint(tokenAddress, ethers.parseEther("10000"));

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
      name: addressResolverName,
      address: impl,
    });

    console.log(
      `ZNSAddressResolver deployed at:
      proxy: ${proxyAddress}
      implementation: ${impl}`
    );
  }

  verifyContract(proxyAddress, [
    accessControllerAddress,
    registryAddress,
  ]);

  logDeploy("ZNSAddressResolver", proxyAddress, [accessControllerAddress, registryAddress]);

  return resolver as unknown as ZNSAddressResolver;
};

export const deployCurvePricer = async ({
  deployer,
  isTenderlyRun,
} : {
  deployer : SignerWithAddress;
  isTenderlyRun : boolean;
}) : Promise<ZNSCurvePricer> => {
  const curveFactory = new ZNSCurvePricer__factory(deployer);
  const curvePricer = await curveFactory.deploy();

  await curvePricer.waitForDeployment();

  const address = await curvePricer.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: curvePricerName,
      address,
    });

    console.log(`${curvePricerName} deployed at: ${address}`);
  }

  await verifyContract(proxyAddress, [
    accessControllerAddress,
    registryAddress,
    priceConfig,
  ]);

  logDeploy("ZNSCurvePricer", proxyAddress, [
    accessControllerAddress,
    registryAddress,
    priceConfig
  ]);

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
      name: treasuryName,
      address: impl,
    });

    console.log(`ZNSTreasury deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  await verifyContract(proxyAddress, [
    accessControllerAddress,
    registryAddress,
    zTokenMockAddress,
    zeroVaultAddress,
  ]);

  logDeploy("ZNSTreasury", proxyAddress, [
    accessControllerAddress,
    registryAddress,
    zTokenMockAddress,
    zeroVaultAddress,
  ]);

  return treasury as unknown as ZNSTreasury;
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
      config.curvePriceConfig,
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
      name: registrarName,
      address: impl,
    });

    console.log(`ZNSRootRegistrar deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  await verifyContract(proxyAddress, [
    await accessController.getAddress(),
    config.registryAddress,
    config.curvePricerAddress,
    config.treasuryAddress,
    config.domainTokenAddress,
  ]);

  logDeploy("ZNSRootRegistrar", proxyAddress, [
    await accessController.getAddress(),
    config.registryAddress,
    config.curvePricerAddress,
    config.treasuryAddress,
    config.domainTokenAddress,
  ]);

  return registrar as unknown as ZNSRootRegistrar;
};

export const deployFixedPricer = async ({
  deployer,
  isTenderlyRun = false,
} : {
  deployer : SignerWithAddress;
  isTenderlyRun ?: boolean;
}) => {
  const pricerFactory = new ZNSFixedPricer__factory(deployer);
  const fixedPricer = await pricerFactory.deploy();

  await fixedPricer.waitForDeployment();

  const address = await fixedPricer.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: fixedPricerName,
      address,
    });

    console.log(
      `${fixedPricerName} deployed at:
      proxy: ${address}
      implementation: ${address}`
    );
  }

  await verifyContract(proxyAddress, [
    acAddress,
    regAddress,
  ]);

  logDeploy("ZNSFixedPricer", proxyAddress, [acAddress, regAddress]);

  return fixedPricer as unknown as ZNSFixedPricer;
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
      name: subRegistrarName,
      address: impl,
    });
  }

  await verifyContract(proxyAddress, [
    await accessController.getAddress(),
    await registry.getAddress(),
    await rootRegistrar.getAddress(),
  ]);

  logDeploy("ZNSSubRegistrar", proxyAddress, [
    await accessController.getAddress(),
    await registry.getAddress(),
    await rootRegistrar.getAddress(),
  ]);

  return subRegistrar as unknown as ZNSSubRegistrar;
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
  zeroVaultAddress = deployer.address,
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
  const meowTokenMock = await deployMeowToken(deployer, isTenderlyRun);

  const addressResolver = await deployAddressResolver(
    deployer,
    await accessController.getAddress(),
    await registry.getAddress(),
    isTenderlyRun
  );

  const curvePricer = await deployCurvePricer({
    deployer,
    isTenderlyRun,
  });

  const treasury = await deployTreasury({
    deployer,
    accessControllerAddress: await accessController.getAddress(),
    registryAddress: await registry.getAddress(),
    zTokenMockAddress: await meowTokenMock.getAddress(),
    zeroVaultAddress,
    isTenderlyRun,
  });

  const config : RegistrarConfig = {
    registryAddress: await registry.getAddress(),
    curvePricerAddress: await curvePricer.getAddress(),
    curvePriceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
    treasuryAddress: await treasury.getAddress(),
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

  const znsContracts : IZNSContractsLocal = {
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
  await meowTokenMock.mint(await deployer.getAddress(), ethers.parseEther("5000000"));

  await registry.connect(deployer).addResolverType(DEFAULT_RESOLVER_TYPE, await addressResolver.getAddress());

  return znsContracts;
};
