import {
  ZeroTokenMock,
  ZeroTokenMock__factory,
  ZNSAddressResolver,
  ZNSAddressResolver__factory,
  ZNSDomainToken,
  ZNSDomainToken__factory,
  ZNSEthRegistrar,
  ZNSEthRegistrar__factory,
  ZNSRegistry,
  ZNSRegistry__factory,
  ZNSTreasury,
  ZNSTreasury__factory,
} from "../../typechain";
import { RegistrarConfig } from "./types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export const deployRegistry = async (
  deployer: SignerWithAddress
): Promise<ZNSRegistry> => {
  const registryFactory = new ZNSRegistry__factory(deployer);
  const registry = await registryFactory.deploy();

  // To set the owner of the zero domain to the deployer
  await registry.connect(deployer).initialize(deployer.address);

  return registry;
};

export const deployAddressResolver = async (
  deployer: SignerWithAddress,
  registryAddress: string
): Promise<ZNSAddressResolver> => {
  const addressResolverFactory = new ZNSAddressResolver__factory(deployer);
  const addressResolver = await addressResolverFactory.deploy(registryAddress);

  return addressResolver;
}

export const deployDomainToken = async (
  deployer: SignerWithAddress
): Promise<ZNSDomainToken> => {
  const domainTokenFactory = new ZNSDomainToken__factory(deployer);
  return domainTokenFactory.deploy();
};

export const deployZTokenMock = async (
  deployer: SignerWithAddress
): Promise<ZeroTokenMock> => {
  const zTokenMockFactory = new ZeroTokenMock__factory(deployer);
  return zTokenMockFactory.deploy(deployer.address);
};

export const deployTreasury = async (
  deployer: SignerWithAddress,
  zTokenMockAddress: string
): Promise<ZNSTreasury> => {
  const treasuryFactory = new ZNSTreasury__factory(deployer);
  // TODO:  fix this when Oracle is ready
  return treasuryFactory.deploy(deployer.address, zTokenMockAddress);
};

export const deployRegistrar = async (
  deployer: SignerWithAddress,
  config: RegistrarConfig
): Promise<ZNSEthRegistrar> => {
  const registrarFactory = new ZNSEthRegistrar__factory(deployer);
  const registrar = await registrarFactory.deploy(
    config.treasury.address,
    config.registryAddress,
    config.domainTokenAddress,
    config.addressResolverAddress
  );

  await config.treasury.connect(deployer).setZnsRegistrar(registrar.address);

  return registrar;
};

export const deployZNS = async (deployer: SignerWithAddress) => {
  const registry = await deployRegistry(deployer);

  const domainToken = await deployDomainToken(deployer);

  const zTokenMock = await deployZTokenMock(deployer);

  const addressResolver = await deployAddressResolver(deployer, registry.address);

  const treasury = await deployTreasury(deployer, zTokenMock.address);

  const config = {
    treasury: treasury,
    registryAddress: registry.address,
    domainTokenAddress: domainToken.address,
    addressResolverAddress: addressResolver.address
  }
  // const registrar = await deployRegistrar({
  //   deployer,
  //   treasury,
  //   registryAddress: registry.address,
  //   domainTokenAddress: domainToken.address,
  // });

  // return {
  //   registry,
  //   domainToken,
  //   zTokenMock,
  //   treasury,
  //   registrar,
  // };
};
