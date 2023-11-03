import * as hre from "hardhat";
import { ERC165__factory, ZNSAddressResolver__factory, ZNSAddressResolverUpgradeMock__factory } from "../typechain";
import { DeployZNSParams, IZNSContracts } from "./helpers/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { hashDomainLabel, hashSubdomainName } from "./helpers/hashing";
import {
  ADMIN_ROLE,
  DEFAULT_RESOLVER_TYPE,
  GOVERNOR_ROLE,
  REGISTRAR_ROLE,
  deployZNS,
  getAccessRevertMsg,
  validateUpgrade, INITIALIZED_ERR,
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

  let zns : IZNSContracts;

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

    await zns.registry.connect(deployer).addResolverType(DEFAULT_RESOLVER_TYPE, zns.addressResolver.address);

    await zns.registry.connect(mockRegistrar)
      .createDomainRecord(
        wilderDomainHash,
        deployer.address,
        DEFAULT_RESOLVER_TYPE
      );
  });

  it("Should NOT let initialize the implementation contract", async () => {
    const factory = new ZNSAddressResolver__factory(deployer);
    const impl = await getProxyImplAddress(zns.addressResolver.address);
    const implContract = factory.attach(impl);

    await expect(
      implContract.initialize(
        operator.address,
        mockRegistrar.address,
      )
    ).to.be.revertedWith(INITIALIZED_ERR);
  });

  it("Should get the AddressResolver", async () => { // Copy of registry tests
    // The domain exists
    const existResolver = await zns.registry.getDomainResolver(wilderDomainHash);
    expect(existResolver).to.eq(zns.addressResolver.address);
  });

  it("Returns 0 when the domain doesnt exist", async () => {
    // The domain does not exist
    const someDomainHash = hashDomainLabel("random-record");
    const notExistResolver = await zns.registry.getDomainResolver(someDomainHash);
    expect(notExistResolver).to.eq(hre.ethers.constants.AddressZero);
  });

  it("Should have registry address correctly set", async () => {
    expect(await zns.addressResolver.registry()).to.equal(zns.registry.address);
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
    ).to.be.revertedWith(
      getAccessRevertMsg(operator.address, ADMIN_ROLE)
    );
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
    ).to.be.revertedWith(
      getAccessRevertMsg(operator.address, ADMIN_ROLE)
    );
  });

  it("Should not allow non-owner address to setAddress", async () => {
    await expect(
      zns.addressResolver.connect(user).setAddress(wilderDomainHash, user.address)
    ).to.be.revertedWith("ZNSAddressResolver: Not authorized for this domain");
  });

  it("Should allow owner to setAddress and emit event", async () => {
    await expect(
      zns.addressResolver.connect(deployer)
        .setAddress(wilderDomainHash, user.address)
    )
      .to.emit(zns.addressResolver, "AddressSet")
      .withArgs(wilderDomainHash, user.address);

    const resolvedAddress = await zns.addressResolver.getAddress(wilderDomainHash);
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
        .setAddress(wilderDomainHash, hre.ethers.constants.AddressZero)
    )
      .to.emit(zns.addressResolver, "AddressSet")
      .withArgs(wilderDomainHash, hre.ethers.constants.AddressZero);

    const address = await zns.addressResolver.getAddress(wilderDomainHash);
    expect(address).to.eq(hre.ethers.constants.AddressZero);

  });

  it("Should resolve address correctly", async () => {
    await zns.addressResolver.connect(deployer).setAddress(wilderDomainHash, user.address);

    const resolvedAddress = await zns.addressResolver.getAddress(wilderDomainHash);
    expect(resolvedAddress).to.equal(user.address);
  });

  it("Should support the IZNSAddressResolver interface ID", async () => {
    const interfaceId = await zns.addressResolver.getInterfaceId();
    const supported = await zns.addressResolver.supportsInterface(interfaceId);
    expect(supported).to.be.true;
  });

  it("Should support the ERC-165 interface ID", async () => {
    const erc165Interface = ERC165__factory.createInterface();
    const interfaceId = erc165Interface.getSighash(erc165Interface.functions["supportsInterface(bytes4)"]);
    const supported = await zns.addressResolver.supportsInterface(interfaceId);
    expect(supported).to.be.true;
  });

  it("Should not support other interface IDs", async () => {
    const notSupported = await zns.addressResolver.supportsInterface("0xffffffff");
    expect(notSupported).to.be.false;
  });

  it("Should support full discovery flow from zns.registry", async () => {
    await zns.addressResolver.connect(deployer).setAddress(wilderDomainHash, user.address);

    const resolverAddress = await zns.registry.getDomainResolver(wilderDomainHash);
    expect(resolverAddress).to.eq(zns.addressResolver.address);

    const resolvedAddress = await zns.addressResolver.getAddress(wilderDomainHash);
    expect(resolvedAddress).to.eq(user.address);
  });

  describe("UUPS", () => {
    it("Allows an authorized user to upgrade the contract", async () => {
      // AddressResolver to upgrade to
      const factory = new ZNSAddressResolverUpgradeMock__factory(deployer);
      const newAddressResolver = await factory.deploy();
      await newAddressResolver.deployed();

      // Confirm the deployer is a governor
      expect(
        await zns.accessController.hasRole(GOVERNOR_ROLE, deployer.address)
      ).to.be.true;

      const upgradeTx = zns.domainToken.connect(deployer).upgradeTo(newAddressResolver.address);

      await expect(upgradeTx).to.not.be.reverted;
    });

    it("Fails to upgrade if the caller is not authorized", async () => {
      const factory = new ZNSAddressResolverUpgradeMock__factory(deployer);

      // DomainToken to upgrade to
      const newAddressResolver = await factory.deploy();
      await newAddressResolver.deployed();

      // Confirm the operator is not a governor
      await expect(
        zns.accessController.checkGovernor(operator.address)
      ).to.be.revertedWith(
        getAccessRevertMsg(operator.address, GOVERNOR_ROLE)
      );

      const upgradeTx = zns.domainToken.connect(operator).upgradeTo(newAddressResolver.address);

      await expect(upgradeTx).to.be.revertedWith(
        getAccessRevertMsg(operator.address, GOVERNOR_ROLE)
      );
    });

    it("Verifies that variable values are not changed in the upgrade process", async () => {
      // AddressResolver to upgrade to
      const factory = new ZNSAddressResolverUpgradeMock__factory(deployer);
      const newResolver = await factory.deploy();
      await newResolver.deployed();

      await zns.addressResolver.connect(mockRegistrar).setAddress(wilderDomainHash, user.address);

      const contractCalls = [
        zns.addressResolver.registry(),
        zns.addressResolver.getAddress(wilderDomainHash),
      ];

      await validateUpgrade(deployer, zns.addressResolver, newResolver, factory, contractCalls);
    });
  });
});
