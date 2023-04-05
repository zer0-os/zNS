import {
  ZeroTokenMock__factory,
  ZNSDomainToken__factory,
  ZNSEthRegistrar__factory,
  ZNSRegistry__factory,
  ZNSTreasury,
  ZNSTreasury__factory,
} from "../../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export const deployRegistry = async (deployer: SignerWithAddress) => {
  const registryFactory = new ZNSRegistry__factory(deployer);
  const registry = await registryFactory.deploy();

  // To set the owner of the zero domain to the deployer
  await registry.connect(deployer).initialize(deployer.address);

  return registry;
};

export const deployDomainToken = async (deployer: SignerWithAddress) => {
  const domainTokenFactory = new ZNSDomainToken__factory(deployer);
  return domainTokenFactory.deploy();
};

export const deployZTokenMock = async (deployer: SignerWithAddress) => {
  const zTokenMockFactory = new ZeroTokenMock__factory(deployer);
  return zTokenMockFactory.deploy(deployer.address);
};

export const deployTreasury = async (
  deployer: SignerWithAddress,
  zTokenMockAddress: string
) => {
  const treasuryFactory = new ZNSTreasury__factory(deployer);
  // TODO:  fix this when Oracle is ready
  return treasuryFactory.deploy(deployer.address, zTokenMockAddress);
};

export const deployRegistrar = async ({
  deployer,
  treasury,
  registryAddress,
  domainTokenAddress,
}: {
  deployer: SignerWithAddress;
  treasury: ZNSTreasury;
  registryAddress: string;
  domainTokenAddress: string;
}) => {
  const registrarFactory = new ZNSEthRegistrar__factory(deployer);
  const registrar = await registrarFactory.deploy(
    registryAddress,
    treasury.address,
    domainTokenAddress
  );

  await treasury.connect(deployer).setZnsRegistrar(registrar.address);

  return registrar;
};

export const deployZNS = async (deployer: SignerWithAddress) => {
  const registry = await deployRegistry(deployer);

  const domainToken = await deployDomainToken(deployer);

  const zTokenMock = await deployZTokenMock(deployer);

  const treasury = await deployTreasury(deployer, zTokenMock.address);

  const registrar = await deployRegistrar({
    deployer,
    treasury,
    registryAddress: registry.address,
    domainTokenAddress: domainToken.address,
  });

  return {
    registry,
    domainToken,
    zTokenMock,
    treasury,
    registrar,
  };
};
