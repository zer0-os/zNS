import * as hre from "hardhat";
import {
  ZNSRegistry,
  ZNSAddressResolver,
  ERC165__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { hashDomainLabel, hashDomainName } from "./helpers/hashing";
import { DeployZNSParams, ZNSContracts } from "./helpers/types";
import { REGISTRAR_ROLE, deployZNS } from "./helpers";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { expect } = require("chai");

/**
 * TODO the registry should have a function for checking isOwnerOrOperator,
 * so that the AddressResolver can implement a single call in its modifier.
 *
 * Consider moving these tests to ZNSRegistry since they deploy a registry.
 */
describe("ZNSAddressResolver", () => {
  let deployer : SignerWithAddress;
  let mockRegistrar : SignerWithAddress;
  let owner : SignerWithAddress;
  let addr1 : SignerWithAddress;
  let operator : SignerWithAddress;
  let wilderDomainNameHash : string;

  let zns : ZNSContracts;

  beforeEach(async () => {
    [
      owner,
      addr1,
      deployer,
      operator,
      mockRegistrar,
    ] = await hre.ethers.getSigners();

    const params : DeployZNSParams = {
      deployer,
      governorAddresses: [deployer.address],
      adminAddresses: [deployer.address],
    };
    zns = await deployZNS(params);

    // const znsAddressResolverFactory = new ZNSAddressResolver__factory(deployer);
    // const znsRegistryFactory = new ZNSRegistry__factory(deployer);

    // znsRegistry = await znsRegistryFactory.deploy();
    // znsAddressResolver = await znsAddressResolverFactory.deploy(zns.registry.address);

    // Initialize registry and domain
    // await zns.registry.connect(deployer).initialize();

    // Have to get this value for every test, but can be fixed
    wilderDomainNameHash = hashDomainName("wilder");

    await zns.accessController.connect(deployer).grantRole(REGISTRAR_ROLE, mockRegistrar.address);

    await zns.registry.connect(mockRegistrar)
      .createDomainRecord(
        wilderDomainNameHash,
        deployer.address,
        zns.addressResolver.address
      );
  });

  it("Should get the AddressResolver", async () => { // Copy of registry tests
    // The domain exists
    const existResolver = await zns.registry.getDomainResolver(wilderDomainNameHash);
    expect(existResolver).to.eq(zns.addressResolver.address);

    // The domain does not exist
    const someDomainHash = hashDomainLabel("random-record");
    const notExistResolver = await zns.registry.getDomainResolver(someDomainHash);
    expect(notExistResolver).to.eq(hre.ethers.constants.AddressZero);
  });

  it("Should have registry address correctly set", async () => {
    expect(await zns.addressResolver.registry()).to.equal(zns.registry.address);
  });

  it("Should not allow non-owner address to setAddress", async () => {
    await expect(
      zns.addressResolver.connect(addr1).setAddress(wilderDomainNameHash, addr1.address)
    ).to.be.revertedWith("ZNSAddressResolver: Not allowed");
  });

  it("Should allow owner to setAddress and emit event", async () => {
    await expect(
      zns.addressResolver.connect(deployer)
        .setAddress(wilderDomainNameHash, addr1.address)
    )
      .to.emit(zns.addressResolver, "AddressSet")
      .withArgs(wilderDomainNameHash, addr1.address);
  });

  it("Should allow operator to setAddress and emit event", async () => {
    await zns.registry.connect(deployer).setOwnerOperator(operator.address, true);

    await expect(
      zns.addressResolver.connect(operator)
        .setAddress(wilderDomainNameHash, addr1.address)
    )
      .to.emit(zns.addressResolver, "AddressSet")
      .withArgs(wilderDomainNameHash, addr1.address);
  });

  it("Should not allow owner to setAddress(0)", async () => {
    await expect(
      zns.addressResolver.connect(deployer).setAddress(wilderDomainNameHash, hre.ethers.constants.AddressZero)
    ).to.be.revertedWith("ZNS: Cant set address to 0");
  });

  it("Should resolve address correctly", async () => {
    await zns.addressResolver.connect(deployer).setAddress(wilderDomainNameHash, addr1.address);

    const resolvedAddress = await zns.addressResolver.getAddress(wilderDomainNameHash);
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
});