const { expect } = require("chai");
import * as hre from "hardhat";
import { ZNSAddressResolver, ZNSAddressResolver__factory } from "../typechain";
import { ZNSRegistry, ZNSRegistry__factory } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

/**
 * TODO the registry should have a function for checking isOwnerOrOperator, 
 * so that the AddressResolver can implement a single call in its modifier.
 * 
 * Consider moving these tests to ZNSRegistry since they deploy a registry.
 */
describe("ZNSAddressResolver", function () {
    let deployer: SignerWithAddress;
    let znsAddressResolver: ZNSAddressResolver;
    let znsRegistry: ZNSRegistry;
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let operator: SignerWithAddress;
    const rootDomainHash = hre.ethers.constants.HashZero;
    const wilderLabel = hre.ethers.utils.id("wilder");
    const wilderDomainNameHash = hre.ethers.utils.solidityKeccak256(["bytes32", "bytes32"], [rootDomainHash, wilderLabel]);

    beforeEach(async function () {
        [owner, addr1] = await hre.ethers.getSigners();
        [deployer, operator] = await hre.ethers.getSigners();

        const znsAddressResolverFactory = new ZNSAddressResolver__factory(deployer);
        const znsRegistryFactory = new ZNSRegistry__factory(deployer);

        znsRegistry = await znsRegistryFactory.deploy();
        znsAddressResolver = await znsAddressResolverFactory.deploy(znsRegistry.address);

        //Initialize registry and domain
        await znsRegistry.connect(deployer).initialize(deployer.address);
        await znsRegistry.connect(deployer).setSubdomainRecord(rootDomainHash, wilderLabel, deployer.address, znsAddressResolver.address);
    });

    it("Should get the AddressResolver", async () => { // Copy of registry tests
        // The domain exists
        const existResolver = await znsRegistry.getDomainResolver(wilderDomainNameHash);
        expect(existResolver).to.eq(znsAddressResolver.address);

        // The domain does not exist
        const someDomainHash = hre.ethers.utils.id("random-record");
        const notExistResolver = await znsRegistry.getDomainResolver(someDomainHash);
        expect(notExistResolver).to.eq(hre.ethers.constants.AddressZero);
    });

    it("Should have registry address correctly set", async function () {
        expect(await znsAddressResolver.registry()).to.equal(znsRegistry.address);
    });

    it("Should not allow non-owner address to setAddress", async function () {
        await expect(znsAddressResolver.connect(addr1).setAddress(wilderDomainNameHash, addr1.address)).to.be.revertedWith("ZNS: Not allowed");
    });

    it("Should allow owner to setAddress and emit event", async function () {
        await expect(znsAddressResolver.connect(owner).setAddress(wilderDomainNameHash, addr1.address)).to.emit(znsAddressResolver, "AddressSet").withArgs(wilderDomainNameHash, addr1.address);
    });

    it("Should resolve address correctly", async function () {
        await znsAddressResolver.connect(owner).setAddress(wilderDomainNameHash, addr1.address);

        const resolvedAddress = await znsAddressResolver.getAddress(wilderDomainNameHash);
        expect(resolvedAddress).to.equal(addr1.address);
    });

    it("Should support the IZNSAddressResolver interface ID", async function () {
        const interfaceId = await znsAddressResolver.getInterfaceId();
        const supported = await znsAddressResolver.supportsInterface(interfaceId);
        expect(supported).to.be.true;
    });

    it("Should not support other interface IDs", async function () {
        const notSupported = await znsAddressResolver.supportsInterface("0xffffffff");
        expect(notSupported).to.be.false;
    });
});