import * as hre from "hardhat";
import {
  ERC165__factory,
  ZNSAddressResolver,
  ZNSAddressResolver__factory,
  ZNSAddressResolverUpgradeMock__factory,
} from "../typechain";
import { DeployZNSParams, IZNSContractsLocal } from "./helpers/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  ADMIN_ROLE,
  GOVERNOR_ROLE,
  REGISTRAR_ROLE,
  deployZNS,
  validateUpgrade,
  INITIALIZED_ERR,
  AC_UNAUTHORIZED_ERR,
  NOT_AUTHORIZED_ERR,
  AC_WRONGADDRESS_ERR,
  distrConfigEmpty,
  paymentConfigEmpty,
} from "./helpers";
import { getProxyImplAddress } from "./helpers/utils";
import { ethers } from "hardhat";
import Domain from "./helpers/domain/domain";


// eslint-disable-next-line @typescript-eslint/no-var-requires
const { expect } = require("chai");


describe("ZNSAddressResolver", () => {
  let deployer : SignerWithAddress;
  let mockRegistrar : SignerWithAddress;
  let user : SignerWithAddress;
  let operator : SignerWithAddress;

  let zns : IZNSContractsLocal;

  let domain : Domain;

  beforeEach(async () => {
    [
      deployer,
      operator,
      user,
      mockRegistrar,
    ] = await hre.ethers.getSigners();

    const params : DeployZNSParams = {
      deployer,
      governorAddresses: [deployer.address],
      adminAddresses: [deployer.address],
    };

    zns = await deployZNS(params);

    await zns.accessController.connect(deployer).grantRole(REGISTRAR_ROLE, mockRegistrar.address);

    domain = new Domain({
      zns,
      domainConfig: {
        label: "wilder",
        owner: deployer,
        parentHash: ethers.ZeroHash,
        tokenOwner: deployer.address,
        distrConfig: distrConfigEmpty,
        priceConfig: {},
        paymentConfig: paymentConfigEmpty,
        tokenURI: "wilder",
      },
    });

    await domain.register(deployer);
  });

  it("Should NOT let initialize the implementation contract", async () => {
    const factory = new ZNSAddressResolver__factory(deployer);
    const impl = await getProxyImplAddress(await zns.addressResolver.getAddress());
    const implContract = factory.attach(impl) as ZNSAddressResolver;

    await expect(
      implContract.initialize(
        operator.address,
        mockRegistrar.address,
      )
    ).to.be.revertedWithCustomError(implContract, INITIALIZED_ERR);
  });

  it("Should get the AddressResolver", async () => { // Copy of registry tests
    // The domain exists
    const existResolver = await domain.getResolverAddressByLabel(domain.label);
    expect(existResolver).to.eq(await zns.addressResolver.getAddress());
  });

  it("Returns 0 when the domain doesnt exist", async () => {
    // The domain does not exist
    const notExistResolver = await domain.getResolverAddressByLabel("random-record");
    expect(notExistResolver).to.eq(hre.ethers.ZeroAddress);
  });

  it("Should have registry address correctly set", async () => {
    expect(await zns.addressResolver.registry()).to.equal(await zns.registry.getAddress());
  });

  it("Should setRegistry() correctly with ADMIN_ROLE", async () => {
    await expect(
      zns.addressResolver.connect(deployer).setRegistry(operator.address)
    )
      .to.emit(zns.addressResolver, "RegistrySet")
      .withArgs(operator.address);

    expect(await zns.addressResolver.registry()).to.equal(operator.address);
  });

  it("Should revert when setRegistry() without ADMIN_ROLE", async () => {
    await expect(
      zns.addressResolver.connect(operator).setRegistry(operator.address)
    ).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
      .withArgs(operator.address, ADMIN_ROLE);
  });

  it("Should revert when setAccessController() without ADMIN_ROLE", async () => {
    await expect(
      zns.addressResolver.connect(operator).setAccessController(operator.address)
    ).to.be.revertedWithCustomError(zns.addressResolver, AC_UNAUTHORIZED_ERR)
      .withArgs(operator.address, ADMIN_ROLE);
  });

  it("Should not allow non-owner address to setAddress", async () => {
    await expect(
      zns.addressResolver.connect(user).setAddress(domain.hash, user.address)
    ).to.be.revertedWithCustomError(zns.addressResolver, NOT_AUTHORIZED_ERR);
  });

  it("Should allow owner to setAddress and emit event", async () => {
    await expect(
      zns.addressResolver.connect(deployer)
        .setAddress(domain.hash, user.address)
    )
      .to.emit(zns.addressResolver, "AddressSet")
      .withArgs(domain.hash, user.address);

    const resolvedAddress = await zns.addressResolver.resolveDomainAddress(domain.hash);
    expect(resolvedAddress).to.equal(user.address);
  });

  it("Should allow operator to setAddress and emit event", async () => {
    await domain.setOwnersOperator(operator.address, true);

    await expect(
      zns.addressResolver.connect(operator)
        .setAddress(domain.hash, user.address)
    )
      .to.emit(zns.addressResolver, "AddressSet")
      .withArgs(domain.hash, user.address);
  });

  it("Should allow REGISTRAR_ROLE to setAddress and emit event", async () => {
    await zns.accessController.connect(deployer).grantRole(REGISTRAR_ROLE, mockRegistrar.address);

    await expect(
      zns.addressResolver.connect(mockRegistrar)
        .setAddress(domain.hash, hre.ethers.ZeroAddress)
    )
      .to.emit(zns.addressResolver, "AddressSet")
      .withArgs(domain.hash, hre.ethers.ZeroAddress);

    const address = await zns.addressResolver.resolveDomainAddress(domain.hash);
    expect(address).to.eq(hre.ethers.ZeroAddress);
  });

  it("Should resolve address correctly", async () => {
    await zns.addressResolver.connect(deployer).setAddress(domain.hash, user.address);

    const resolvedAddress = await zns.addressResolver.resolveDomainAddress(domain.hash);
    expect(resolvedAddress).to.equal(user.address);
  });

  it("Should support the IZNSAddressResolver interface ID", async () => {
    const interfaceId = await zns.addressResolver.getInterfaceId();
    const supported = await zns.addressResolver.supportsInterface(interfaceId);
    expect(supported).to.be.true;
  });

  it("Should support the ERC-165 interface ID", async () => {
    const erc165Interface = ERC165__factory.createInterface();

    const fragment = erc165Interface.getFunction("supportsInterface");

    const supported = await zns.addressResolver.supportsInterface(fragment.selector);
    expect(supported).to.be.true;
  });

  it("Should not support other interface IDs", async () => {
    const notSupported = await zns.addressResolver.supportsInterface("0xffffffff");
    expect(notSupported).to.be.false;
  });

  it("Should support full discovery flow from zns.registry", async () => {
    await zns.addressResolver.connect(deployer).setAddress(domain.hash, user.address);

    const resolverAddress = await domain.getResolverAddressByLabel(domain.label);
    expect(resolverAddress).to.eq(await zns.addressResolver.getAddress());

    const resolvedAddress = await zns.addressResolver.resolveDomainAddress(domain.hash);
    expect(resolvedAddress).to.eq(user.address);
  });

  describe("#setAccessController", () => {
    it("should allow ADMIN to set a valid AccessController", async () => {
      await zns.addressResolver.connect(deployer).setAccessController(zns.accessController.target);

      const currentAccessController = await zns.addressResolver.getAccessController();

      expect(currentAccessController).to.equal(zns.accessController.target);
    });

    it("should allow re-setting the AccessController to another valid contract", async () => {
      expect(
        await zns.addressResolver.getAccessController()
      ).to.equal(
        zns.accessController.target
      );

      const ZNSAccessControllerFactory = await ethers.getContractFactory("ZNSAccessController", deployer);
      const newAccessController = await ZNSAccessControllerFactory.deploy(
        [deployer.address],
        [deployer.address]
      );

      // then change the AccessController
      await zns.addressResolver.connect(deployer).setAccessController(newAccessController.target);

      expect(
        await zns.addressResolver.getAccessController()
      ).to.equal(
        newAccessController.target
      );
    });

    it("should emit AccessControllerSet event when setting a valid AccessController", async () => {
      await expect(
        zns.addressResolver.connect(deployer).setAccessController(zns.accessController.target)
      ).to.emit(
        zns.addressResolver,
        "AccessControllerSet"
      ).withArgs(zns.accessController.target);
    });

    it("should revert when a non-ADMIN tries to set AccessController", async () => {
      await expect(
        zns.addressResolver.connect(user).setAccessController(zns.accessController.target)
      ).to.be.revertedWithCustomError(zns.addressResolver, AC_UNAUTHORIZED_ERR)
        .withArgs(user.address, ADMIN_ROLE);
    });

    it("should revert when setting an AccessController as EOA address", async () => {
      await expect(
        zns.addressResolver.connect(deployer).setAccessController(user.address)
      ).to.be.revertedWithCustomError(zns.addressResolver, AC_WRONGADDRESS_ERR)
        .withArgs(user.address);
    });

    it("should revert when setting an AccessController as another non-AC contract address", async () => {
      await expect(
        zns.addressResolver.connect(deployer).setAccessController(zns.addressResolver.target)
      ).to.be.revertedWithCustomError(zns.addressResolver, AC_WRONGADDRESS_ERR)
        .withArgs(zns.addressResolver.target);
    });

    it("should revert when setting a zero address as AccessController", async () => {
      await expect(
        zns.addressResolver.connect(deployer).setAccessController(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(zns.addressResolver, AC_WRONGADDRESS_ERR)
        .withArgs(ethers.ZeroAddress);
    });
  });

  describe("UUPS", () => {
    it("Allows an authorized user to upgrade the contract", async () => {
      // AddressResolver to upgrade to
      const factory = new ZNSAddressResolverUpgradeMock__factory(deployer);
      const newAddressResolver = await factory.deploy();
      await newAddressResolver.waitForDeployment();

      // Confirm the deployer is a governor
      expect(
        await zns.accessController.hasRole(GOVERNOR_ROLE, deployer.address)
      ).to.be.true;

      const upgradeTx = zns.domainToken.connect(deployer).upgradeToAndCall(
        await newAddressResolver.getAddress(),
        "0x"
      );

      await expect(upgradeTx).to.not.be.reverted;
    });

    it("Fails to upgrade if the caller is not authorized", async () => {
      const factory = new ZNSAddressResolverUpgradeMock__factory(deployer);

      // DomainToken to upgrade to
      const newAddressResolver = await factory.deploy();
      await newAddressResolver.waitForDeployment();

      // Confirm the operator is not a governor
      await expect(
        zns.accessController.checkGovernor(operator.address)
      ).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(operator.address, GOVERNOR_ROLE);

      const upgradeTx = zns.domainToken.connect(operator).upgradeToAndCall(await newAddressResolver.getAddress(), "0x");

      await expect(upgradeTx).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(operator.address, GOVERNOR_ROLE);
    });

    it("Verifies that variable values are not changed in the upgrade process", async () => {
      // AddressResolver to upgrade to
      const factory = new ZNSAddressResolverUpgradeMock__factory(deployer);
      const newResolver = await factory.deploy();
      await newResolver.waitForDeployment();

      await zns.addressResolver.connect(mockRegistrar).setAddress(domain.hash, user.address);

      const contractCalls = [
        zns.addressResolver.registry(),
        zns.addressResolver.resolveDomainAddress(domain.hash),
      ];

      await validateUpgrade(deployer, zns.addressResolver, newResolver, factory, contractCalls);
    });
  });
});
