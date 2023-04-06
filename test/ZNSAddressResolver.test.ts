const { expect } = require("chai");
import * as hre from "hardhat";
import { ZNSAddressResolver, ZNSAddressResolver__factory } from "../typechain";
import { ZNSRegistry, ZNSRegistry__factory } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

/**
 * TODO the registry should have a function for checking isOwnerOrOperator, 
 * rather than the modifier also being added to AddressResolver
 */
describe("ZNSAddressResolver", function () {
    let deployer: SignerWithAddress;
    let znsAddressResolver: ZNSAddressResolver;
    let znsRegistry: ZNSRegistry;
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let operator: SignerWithAddress;
    let mockResolver: SignerWithAddress;
    const rootDomainHash = hre.ethers.constants.HashZero;
    const wilderLabel = hre.ethers.utils.id("wilder");
    const zeroLabel = hre.ethers.utils.id("zero");
    const wilderSubdomainHash = hre.ethers.utils.solidityKeccak256(["bytes32", "bytes32"], [rootDomainHash, wilderLabel]);


    beforeEach(async function () {
        [owner, addr1] = await hre.ethers.getSigners();
        [deployer, operator, mockResolver] = await hre.ethers.getSigners();

        const znsAddressResolverFactory = new ZNSAddressResolver__factory(deployer);
        const znsRegistryFactory = new ZNSRegistry__factory(deployer);

        znsRegistry = await znsRegistryFactory.deploy();
        znsAddressResolver = await znsAddressResolverFactory.deploy(znsRegistry.address);

        await znsRegistry.connect(deployer).initialize(deployer.address);
        await znsRegistry.connect(deployer).setSubdomainRecord(rootDomainHash, wilderLabel, deployer.address, mockResolver.address);
    });

    it("Should have registry address correctly set", async function () {
        expect(await znsAddressResolver.registry()).to.equal(znsRegistry.address);
    });

    it("Should not allow non-owner address to setAddress", async function () {
        const domainNameHash = hre.ethers.utils.solidityKeccak256(["bytes32", "bytes32"], [rootDomainHash, wilderLabel]);
        await expect(znsAddressResolver.connect(addr1).setAddress(domainNameHash, addr1.address)).to.be.revertedWith("ZNS: Not allowed");
    });

    it("Should allow owner to setAddress and emit event", async function () {
        const domainNameHash = hre.ethers.utils.solidityKeccak256(["bytes32", "bytes32"], [rootDomainHash, wilderLabel]);
        await expect(znsAddressResolver.connect(owner).setAddress(domainNameHash, addr1.address)).to.emit(znsAddressResolver, "AddressSet").withArgs(domainNameHash, addr1.address);
    });

    it("Should resolve address correctly", async function () {
        const domainNameHash = hre.ethers.utils.solidityKeccak256(["bytes32", "bytes32"], [rootDomainHash, wilderLabel]);
        await znsAddressResolver.connect(owner).setAddress(domainNameHash, addr1.address);

        const resolvedAddress = await znsAddressResolver.getAddress(domainNameHash);
        expect(resolvedAddress).to.equal(addr1.address);
    });

    it("Should support its own calculated interface ID", async function () {
        const supported = await znsAddressResolver.supportsInterface(znsAddressResolver.calculateSelector());
        expect(supported).to.be.true;
    });

    it("Should not support other interface IDs", async function () {
        const notSupported = await znsAddressResolver.supportsInterface("0xffffffff");
        expect(notSupported).to.be.false;
    });
});