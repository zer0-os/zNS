const { expect } = require("chai");
const { ethers } = require("hardhat");
import { Contract, Signer } from "ethers";
import { ZNSAddressResolver, ZNSAddressResolver__factory } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("ZNSAddressResolver", function () {
    let znsAddressResolver: ZNSAddressResolver;
    let registry: SignerWithAddress;
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;

    beforeEach(async function () {
        const ZNSAddressResolver = await ethers.getContractFactory("ZNSAddressResolver");
        [owner, registry, addr1] = await ethers.getSigners();
        znsAddressResolver = await ZNSAddressResolver.deploy(registry.address);
    });

    it("Should have registry address correctly set", async function () {
        expect(await znsAddressResolver.registry()).to.equal(registry.address);
    });

    it("Should not allow non-registry address to setAddress", async function () {
        const domainNameHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("wilder"));
        await expect(znsAddressResolver.connect(addr1).setAddress(domainNameHash, addr1.address)).to.be.reverted;
    });

    it("Should allow registry to setAddress and emit event", async function () {
        const domainNameHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("wilder"));
        await expect(znsAddressResolver.connect(registry).setAddress(domainNameHash, addr1.address)).to.emit(znsAddressResolver, "AddressSet").withArgs(domainNameHash, addr1.address);
    });

    it("Should resolve address correctly", async function () {
        const domainNameHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("wilder"));
        await znsAddressResolver.connect(registry).setAddress(domainNameHash, addr1.address);

        const resolvedAddress = await znsAddressResolver.getAddress(domainNameHash);
        expect(resolvedAddress).to.equal(addr1.address);
    });

    it("Should support resolver interface ID", async function () {
        const supported = await znsAddressResolver.supportsInterface("0xe25f0a33");
        expect(supported).to.be.true;
    });

    it("Should not support other interface IDs", async function () {
        const notSupported = await znsAddressResolver.supportsInterface("0xffffffff");
        expect(notSupported).to.be.false;
    });
});