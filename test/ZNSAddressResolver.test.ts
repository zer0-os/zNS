import * as hre from "hardhat";
import {
  ERC165__factory,
  ZNSAddressResolver,
  ZNSAddressResolver__factory,
  ZNSAddressResolverUpgradeMock__factory,
} from "../typechain";
import { DeployZNSParams, IZNSContractsLocal } from "./helpers/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { hashDomainLabel, hashSubdomainName } from "./helpers/hashing";
import {
  ADMIN_ROLE,
  DEFAULT_RESOLVER_TYPE,
  GOVERNOR_ROLE,
  REGISTRAR_ROLE,
  deployZNS,
  validateUpgrade, INITIALIZED_ERR, AC_UNAUTHORIZED_ERR, NOT_AUTHORIZED_ERR,
} from "./helpers";
import { getProxyImplAddress } from "./helpers/utils";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { expect } = require("chai");


describe("ZNSAddressResolver", () => {
  let deployer : SignerWithAddress;
  let mockRegistrar : SignerWithAddress;
  let user : SignerWithAddress;
  let operator : SignerWithAddress;
  let wilderDomainHash : string;

  let zns : IZNSContractsLocal;

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

    // Have to get this value for every test, but can be fixed
    wilderDomainHash = hashSubdomainName("wilder");

    await zns.accessController.connect(deployer).grantRole(REGISTRAR_ROLE, mockRegistrar.address);

    await zns.registry.connect(deployer).addResolverType(DEFAULT_RESOLVER_TYPE, await zns.addressResolver.getAddress());

    await zns.registry.connect(mockRegistrar)
      .createDomainRecord(
        wilderDomainHash,
        deployer.address,
        DEFAULT_RESOLVER_TYPE
      );
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
    const existResolver = await zns.registry.getDomainResolver(wilderDomainHash);
    expect(existResolver).to.eq(await zns.addressResolver.getAddress());
  });

  it("Returns 0 when the domain doesnt exist", async () => {
    // The domain does not exist
    const someDomainHash = hashDomainLabel("random-record");
    const notExistResolver = await zns.registry.getDomainResolver(someDomainHash);
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

  it("Should setAccessController() correctly with ADMIN_ROLE", async () => {
    expect(await zns.addressResolver.connect(deployer).setAccessController(operator.address))
      .to.emit(zns.addressResolver, "AccessControllerSet")
      .withArgs(operator.address);

    expect(await zns.addressResolver.getAccessController()).to.equal(operator.address);
  });

  it("Should revert when setAccessController() without ADMIN_ROLE", async () => {
    await expect(
      zns.addressResolver.connect(operator).setAccessController(operator.address)
    ).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
      .withArgs(operator.address, ADMIN_ROLE);
  });

  it("Should not allow non-owner address to setAddress", async () => {
    await expect(
      zns.addressResolver.connect(user).setAddress(wilderDomainHash, user.address)
    ).to.be.revertedWithCustomError(zns.addressResolver, NOT_AUTHORIZED_ERR);
  });

  it("Should allow owner to setAddress and emit event", async () => {
    await expect(
      zns.addressResolver.connect(deployer)
        .setAddress(wilderDomainHash, user.address)
    )
      .to.emit(zns.addressResolver, "AddressSet")
      .withArgs(wilderDomainHash, user.address);

    const resolvedAddress = await zns.addressResolver.resolveDomainAddress(wilderDomainHash);
    expect(resolvedAddress).to.equal(user.address);
  });

  it("Should allow operator to setAddress and emit event", async () => {
    await zns.registry.connect(deployer).setOwnersOperator(operator.address, true);

    await expect(
      zns.addressResolver.connect(operator)
        .setAddress(wilderDomainHash, user.address)
    )
      .to.emit(zns.addressResolver, "AddressSet")
      .withArgs(wilderDomainHash, user.address);
  });

  it("Should allow REGISTRAR_ROLE to setAddress and emit event", async () => {
    await zns.accessController.connect(deployer).grantRole(REGISTRAR_ROLE, mockRegistrar.address);

    await expect(
      zns.addressResolver.connect(mockRegistrar)
        .setAddress(wilderDomainHash, hre.ethers.ZeroAddress)
    )
      .to.emit(zns.addressResolver, "AddressSet")
      .withArgs(wilderDomainHash, hre.ethers.ZeroAddress);

    const address = await zns.addressResolver.resolveDomainAddress(wilderDomainHash);
    expect(address).to.eq(hre.ethers.ZeroAddress);

  });

  it("Should resolve address correctly", async () => {
    await zns.addressResolver.connect(deployer).setAddress(wilderDomainHash, user.address);

    const resolvedAddress = await zns.addressResolver.resolveDomainAddress(wilderDomainHash);
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
    await zns.addressResolver.connect(deployer).setAddress(wilderDomainHash, user.address);

    const resolverAddress = await zns.registry.getDomainResolver(wilderDomainHash);
    expect(resolverAddress).to.eq(await zns.addressResolver.getAddress());

    const resolvedAddress = await zns.addressResolver.resolveDomainAddress(wilderDomainHash);
    expect(resolvedAddress).to.eq(user.address);
  });

  describe("General validation", () => {
    it("Should revert when NON-admin tries to set #PAUSE", async () => {
      await expect(
        zns.addressResolver.connect(user).pause()
      ).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR);
    });

    it("Should revert on every suspendable function call when the contract is PAUSED", async () => {
      await zns.addressResolver.connect(deployer).pause();

      const functionsToTest = [
        async () => zns.addressResolver.setAddress(wilderDomainHash, user.address),
      ];

      for (const call of functionsToTest) {
        await expect(
          call()
        ).to.be.revertedWithCustomError(
          zns.addressResolver,
          "EnforcedPause"
        );
      }
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

      await zns.addressResolver.connect(mockRegistrar).setAddress(wilderDomainHash, user.address);

      const contractCalls = [
        zns.addressResolver.registry(),
        zns.addressResolver.resolveDomainAddress(wilderDomainHash),
      ];

      await validateUpgrade(deployer, zns.addressResolver, newResolver, factory, contractCalls);
    });
  });
});
