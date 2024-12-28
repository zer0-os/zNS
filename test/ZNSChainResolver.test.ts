import { expect } from "chai";
import {
  ethers,
  upgrades,
} from "hardhat";
import {
  ZNSAccessController,
  ZNSChainResolver,
  ZNSRegistry,
} from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  deployAccessController,
  deployMeowToken,
  deployRegistry,
} from "./helpers/deploy/deploy-zns";
import {
  AC_UNAUTHORIZED_ERR,
  ADMIN_ROLE,
  CHAIN_RESOLVER_TYPE,
  REGISTRAR_ROLE,
} from "./helpers";

describe("ZNSChainResolver", () => {
  let resolver : ZNSChainResolver;
  let registry : ZNSRegistry;
  let registrar : SignerWithAddress;
  let accessController : ZNSAccessController;

  let admin : SignerWithAddress;
  let unauthorized : SignerWithAddress;
  let emptySigner : SignerWithAddress;

  const domainLabel = "example.com";
  const domainHash = ethers.keccak256(ethers.toUtf8Bytes(domainLabel));
  const chainName = "name";
  const aux = "Aux";

  before(async () => {
    [admin, unauthorized, emptySigner, registrar] = await ethers.getSigners();

    accessController = await deployAccessController({
      deployer: admin,
      governorAddresses: [],
      adminAddresses: [admin.address],
    });
    await accessController.connect(admin).grantRole(REGISTRAR_ROLE, registrar.address);

    registry = await deployRegistry(
      admin,
      await accessController.getAddress()
    );

    const ZNSresolver = await ethers.getContractFactory("ZNSChainResolver");
    resolver = await upgrades.deployProxy(
      ZNSresolver,
      [accessController.target, registry.target],
      { initializer: "initialize" }
    );
    await resolver.waitForDeployment();

    await registry.connect(admin).addResolverType(CHAIN_RESOLVER_TYPE, await resolver.getAddress());
    await registry.connect(registrar).createDomainRecord(
      domainHash,
      admin.address,
      CHAIN_RESOLVER_TYPE
    );

    const token = await deployMeowToken(admin, false);
    await token.mint(admin.address, 1000n);
  });

  it("should allow authorized user to set and resolve chain data", async () => {
    const chainID = 1n;
    const znsRegistryOnChain = await registry.getAddress();
    const auxData = "Additional info";

    await resolver.connect(admin).setChainData(
      domainHash,
      chainID,
      chainName,
      znsRegistryOnChain,
      auxData
    );

    const result = await resolver.resolveChainData(domainHash);

    expect(
      result[0]
    ).to.equal(chainID);
    expect(
      result[1]
    ).to.equal(chainName);
    expect(
      result[2]
    ).to.equal(znsRegistryOnChain);
    expect(
      result[3]
    ).to.equal(auxData);
  });

  it("should revert if unauthorized user attempts to set chain data", async () => {
    const chainID = 1;
    const chainName = "Ethereum Mainnet";
    const znsRegistryOnChain = "0x0000000000000000000000000000000000000001";
    const auxData = "Additional info";

    await expect(
      resolver.connect(unauthorized).setChainData(
        domainHash,
        chainID,
        chainName,
        znsRegistryOnChain,
        auxData
      )
    ).to.be.revertedWithCustomError(
      resolver,
      "NotAuthorizedForDomain"
    );
  });

  it("should NOT let initialize the implementation contract", async () => {
    await expect(
      resolver.initialize(ethers.ZeroAddress, ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(
      resolver,
      "InvalidInitialization"
    );
  });

  it("should get the resolver", async () => {
    expect(
      await resolver.supportsInterface(await resolver.getInterfaceId())
    ).to.be.true;
  });

  it("should return 0 when the domain doesn't exist", async () => {
    const emptyData = await resolver.resolveChainData(ethers.id("nonexistent"));
    expect(
      emptyData[0]
    ).to.equal(
      0
    );

    expect(
      emptyData[1]
    ).to.equal("");

    expect(
      emptyData[2]
    ).to.equal(
      ethers.ZeroAddress
    );

    expect(
      emptyData[3]
    ).to.equal("");
  });

  it("should have registry address correctly set", async () => {
    expect(
      await resolver.registry()
    ).to.equal(
      registry.target
    );
  });

  it("should setRegistry() correctly with ADMIN_ROLE", async () => {
    await resolver.connect(admin).setRegistry(emptySigner);

    expect(
      await resolver.registry()
    ).to.equal(
      emptySigner
    );

    // assign it back
    await resolver.connect(admin).setRegistry(registry.target);
  });

  it("should revert when setRegistry() without ADMIN_ROLE", async () => {
    await expect(
      resolver.connect(unauthorized).setRegistry(ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(
      accessController,
      AC_UNAUTHORIZED_ERR
    ).withArgs(
      unauthorized.address,
      ADMIN_ROLE
    );
  });

  it("should revert when setAccessController() without ADMIN_ROLE", async () => {
    await expect(
      resolver.connect(unauthorized).setAccessController(ethers.ZeroAddress)
    ).to.be.reverted;
  });

  it("should NOT allow non-owner address to setChainData", async () => {
    await expect(
      resolver.connect(unauthorized).setChainData(
        ethers.id("domain"),
        1n,
        chainName,
        registry.target,
        aux
      )
    ).to.be.reverted;
  });

  it("should allow owner to setChainData and emit event", async () => {
    await expect(
      resolver.setChainData(
        domainHash,
        1n,
        chainName,
        registry.target,
        aux
      )
    ).to.emit(
      resolver,
      "ChainDataSet"
    ).withArgs(
      domainHash,
      1n,
      chainName,
      registry.target,
      aux
    );
  });

  it("should resolve chain data correctly", async () => {
    await resolver.connect(admin).setChainData(
      domainHash,
      1n,
      chainName,
      registry.target,
      aux
    );

    const data = await resolver.resolveChainData(domainHash);

    expect(
      data[0]
    ).to.equal(
      1n
    );

    expect(
      data[1]
    ).to.equal(
      chainName
    );
    expect(
      data[2]
    ).to.equal(
      registry.target
    );

    expect(
      data[3]
    ).to.equal(
      aux
    );
  });

  it("should support the IChainResolver interface ID", async () => {
    expect(
      await resolver.supportsInterface(await resolver.getInterfaceId())
    ).to.be.true;
  });

  it("should support the ERC-165 interface ID", async () => {
    expect(
      await resolver.supportsInterface("0x01ffc9a7")
    ).to.be.true;
  });

  it("should not support other interface IDs", async () => {
    expect(
      await resolver.supportsInterface("0xffffffff")
    ).to.be.false;
  });
});
