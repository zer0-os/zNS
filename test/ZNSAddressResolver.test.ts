import * as hre from "hardhat";
import { ERC165__factory } from "../typechain";
import { DeployZNSParams, ZNSContracts } from "./helpers/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { hashDomainLabel, hashDomainName } from "./helpers/hashing";
import {
  ADMIN_ROLE,
  REGISTRAR_ROLE,
  deployZNS,
  getAccessRevertMsg,
} from "./helpers";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { expect } = require("chai");

describe("ZNSAddressResolver", () => {
  let deployer : SignerWithAddress;
  let mockRegistrar : SignerWithAddress;
  let addr1 : SignerWithAddress;
  let operator : SignerWithAddress;
  let wilderDomainHash : string;

  let zns : ZNSContracts;

  beforeEach(async () => {
    [
      deployer,
      operator,
      addr1,
      mockRegistrar,
    ] = await hre.ethers.getSigners();

    const params : DeployZNSParams = {
      deployer,
      governorAddresses: [deployer.address],
      adminAddresses: [deployer.address],
    };
    zns = await deployZNS(params);

    // Have to get this value for every test, but can be fixed
    wilderDomainHash = hashDomainName("wilder");

    await zns.accessController.connect(deployer).grantRole(REGISTRAR_ROLE, mockRegistrar.address);

    await zns.registry.connect(mockRegistrar)
      .createDomainRecord(
        wilderDomainHash,
        deployer.address,
        zns.addressResolver.address
      );
  });

  it("Should get the AddressResolver", async () => { // Copy of registry tests
    // The domain exists
    const existResolver = await zns.registry.getDomainResolver(wilderDomainHash);
    expect(existResolver).to.eq(zns.addressResolver.address);

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
    await expect(
      zns.addressResolver.connect(deployer).setAccessController(operator.address)
    )
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
      zns.addressResolver.connect(addr1).setAddress(wilderDomainHash, addr1.address)
    ).to.be.revertedWith("ZNSAddressResolver: Not authorized for this domain");
  });

  it("Should allow owner to setAddress and emit event", async () => {
    await expect(
      zns.addressResolver.connect(deployer)
        .setAddress(wilderDomainHash, addr1.address)
    )
      .to.emit(zns.addressResolver, "AddressSet")
      .withArgs(wilderDomainHash, addr1.address);

    const resolvedAddress = await zns.addressResolver.getAddress(wilderDomainHash);
    expect(resolvedAddress).to.equal(addr1.address);
  });

  it("Should allow operator to setAddress and emit event", async () => {
    await zns.registry.connect(deployer).setOwnerOperator(operator.address, true);

    await expect(
      zns.addressResolver.connect(operator)
        .setAddress(wilderDomainHash, addr1.address)
    )
      .to.emit(zns.addressResolver, "AddressSet")
      .withArgs(wilderDomainHash, addr1.address);
  });

  it("Should allow REGISTRAR_ROLE to setAddress and emit event", async () => {
    await zns.accessController.connect(deployer).grantRole(REGISTRAR_ROLE, mockRegistrar.address);

    await expect(
      zns.addressResolver.connect(mockRegistrar).setAddress(wilderDomainHash, hre.ethers.constants.AddressZero)
    ).to.emit(zns.addressResolver, "AddressSet").withArgs(wilderDomainHash, hre.ethers.constants.AddressZero);

    const address = await zns.addressResolver.getAddress(wilderDomainHash);
    expect(address).to.eq(hre.ethers.constants.AddressZero);

  });

  it("Should resolve address correctly", async () => {
    await zns.addressResolver.connect(deployer).setAddress(wilderDomainHash, addr1.address);

    const resolvedAddress = await zns.addressResolver.getAddress(wilderDomainHash);
    expect(resolvedAddress).to.equal(addr1.address);
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
    await zns.addressResolver.connect(deployer).setAddress(wilderDomainHash, addr1.address);

    const resolverAddress = await zns.registry.getDomainResolver(wilderDomainHash);
    expect(resolverAddress).to.eq(zns.addressResolver.address);

    const resolvedAddress = await zns.addressResolver.getAddress(wilderDomainHash);
    expect(resolvedAddress).to.eq(addr1.address);
  });
});
