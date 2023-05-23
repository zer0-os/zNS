import * as hre from "hardhat";
import {
  ZNSRegistry,
  ZNSAddressResolver,
  ERC165__factory, ZNSAccessController,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { hashDomainLabel, hashDomainName } from "./helpers/hashing";
import { deployAccessController, deployAddressResolver, deployRegistry, REGISTRAR_ROLE } from "./helpers";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { expect } = require("chai");


describe("ZNSAddressResolver", () => {
  let deployer : SignerWithAddress;
  let mockRegistrar : SignerWithAddress;
  let znsAddressResolver : ZNSAddressResolver;
  let accessController : ZNSAccessController;
  let znsRegistry : ZNSRegistry;
  let owner : SignerWithAddress;
  let addr1 : SignerWithAddress;
  let operator : SignerWithAddress;
  let wilderDomainNameHash : string;

  beforeEach(async () => {
    [owner, addr1] = await hre.ethers.getSigners();
    [deployer, operator, mockRegistrar] = await hre.ethers.getSigners();

    accessController = await deployAccessController({
      deployer,
      governorAddresses: [deployer.address],
      adminAddresses: [deployer.address],
    });
    await accessController.connect(deployer).grantRole(REGISTRAR_ROLE, mockRegistrar.address);

    znsRegistry = await deployRegistry(deployer, accessController.address);
    znsAddressResolver = await deployAddressResolver(deployer, znsRegistry.address);

    // Have to get this value for every test, but can be fixed
    wilderDomainNameHash = hashDomainName("wilder");

    await znsRegistry.connect(mockRegistrar)
      .createDomainRecord(
        wilderDomainNameHash,
        deployer.address,
        znsAddressResolver.address
      );
  });

  it("Should get the AddressResolver", async () => { // Copy of registry tests
    // The domain exists
    const existResolver = await znsRegistry.getDomainResolver(wilderDomainNameHash);
    expect(existResolver).to.eq(znsAddressResolver.address);

    // The domain does not exist
    const someDomainHash = hashDomainLabel("random-record");
    const notExistResolver = await znsRegistry.getDomainResolver(someDomainHash);
    expect(notExistResolver).to.eq(hre.ethers.constants.AddressZero);
  });

  it("Should have registry address correctly set", async () => {
    expect(await znsAddressResolver.registry()).to.equal(znsRegistry.address);
  });

  it("Should not allow non-owner address to setAddress", async () => {
    await expect(
      znsAddressResolver.connect(addr1).setAddress(wilderDomainNameHash, addr1.address)
    ).to.be.revertedWith(
      "ZNSAddressResolver: Not authorized for this domain"
    );
  });

  it("Should allow owner to setAddress and emit event", async () => {
    await expect(
      znsAddressResolver.connect(owner)
        .setAddress(wilderDomainNameHash, addr1.address)
    )
      .to.emit(znsAddressResolver, "AddressSet")
      .withArgs(wilderDomainNameHash, addr1.address);

    const resolvedAddress = await znsAddressResolver.getAddress(wilderDomainNameHash);
    expect(resolvedAddress).to.equal(addr1.address);
  });

  it("Should allow operator to setAddress and emit event", async () => {
    await znsRegistry.connect(owner).setOwnerOperator(operator.address, true);

    await expect(
      znsAddressResolver.connect(operator)
        .setAddress(wilderDomainNameHash, addr1.address)
    )
      .to.emit(znsAddressResolver, "AddressSet")
      .withArgs(wilderDomainNameHash, addr1.address);
  });

  it("Should allow owner to set address to 0", async () => {
    await znsAddressResolver
      .connect(owner)
      .setAddress(wilderDomainNameHash, hre.ethers.constants.AddressZero);

    const resolvedAddress = await znsAddressResolver.getAddress(wilderDomainNameHash);
    expect(resolvedAddress).to.equal(hre.ethers.constants.AddressZero);
  });

  it("Should resolve address correctly", async () => {
    await znsAddressResolver.connect(owner).setAddress(wilderDomainNameHash, addr1.address);

    const resolvedAddress = await znsAddressResolver.getAddress(wilderDomainNameHash);
    expect(resolvedAddress).to.equal(addr1.address);
  });

  it("Should support the IZNSAddressResolver interface ID", async () => {
    const interfaceId = await znsAddressResolver.getInterfaceId();
    const supported = await znsAddressResolver.supportsInterface(interfaceId);
    expect(supported).to.be.true;
  });

  it("Should support the ERC-165 interface ID", async () => {
    const erc165Interface = ERC165__factory.createInterface();
    const interfaceId = erc165Interface.getSighash(erc165Interface.functions["supportsInterface(bytes4)"]);
    const supported = await znsAddressResolver.supportsInterface(interfaceId);
    expect(supported).to.be.true;
  });

  it("Should not support other interface IDs", async () => {
    const notSupported = await znsAddressResolver.supportsInterface("0xffffffff");
    expect(notSupported).to.be.false;
  });

  it("Should support full discovery flow from ZNSRegistry", async () => {
    await znsAddressResolver.connect(owner)
      .setAddress(wilderDomainNameHash, addr1.address);

    const resolverAddress = await znsRegistry.getDomainResolver(wilderDomainNameHash);
    expect(resolverAddress).to.eq(znsAddressResolver.address);

    const resolvedAddress = await znsAddressResolver.getAddress(wilderDomainNameHash);
    expect(resolvedAddress).to.eq(addr1.address);
  });
});
