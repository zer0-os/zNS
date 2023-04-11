import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSPriceOracle, ZNSPriceOracle__factory } from "../typechain";
import { BigNumber } from "ethers";

require("@nomicfoundation/hardhat-chai-matchers");

describe("ZNSPriceOracle", () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let mockRegistrar: SignerWithAddress;
  let contract: ZNSPriceOracle;
  let factory: ZNSPriceOracle__factory;

  const priceForRootDomain = hre.ethers.utils.parseEther("1");
  const priceForSubdomain = hre.ethers.utils.parseEther("0.2");

  beforeEach(async () => {
    [deployer, user, mockRegistrar] = await hre.ethers.getSigners();

    factory = new ZNSPriceOracle__factory(deployer);
    contract = await factory.deploy();

    const priceMultiplier = BigNumber.from("39");
    const baseLength = 3;

    await contract.initialize(
      priceForRootDomain,
      priceForSubdomain,
      priceMultiplier,
      baseLength,
      mockRegistrar.address
    );
  });

  it("Confirms the mockRegistrar is authorized", async () => {
    const authorized = await contract.isAuthorized(mockRegistrar.address);
    expect(authorized).to.be.true;
  });

  it("Confirms the deployer is authorized", async () => {
    const authorized = await contract.isAuthorized(deployer.address);
    expect(authorized).to.be.true;
  });

  describe("getPrice", async () => {
    it("Returns 0 price for a root or subdomain name with no length", async () => {
      const priceRootDomain = await contract.getPrice(BigNumber.from("0"), true);
      expect(priceRootDomain).to.eq(0);

      const priceSubdomain = await contract.getPrice(BigNumber.from("0"), false);
      expect(priceSubdomain).to.eq(0);
    });

    it("Returns the base price for domains that are equal to the base length", async () => {
      // Using the default length of 3
      const domain = "eth";

      const rootPrice = await contract.rootDomainBasePrice();

      const price = await contract.getPrice(domain.length, true);
      expect(price).to.eq(rootPrice);
    });

    it("Returns the base price for subdomains that are equal to the base length", async () => {
      const domain = "eth";

      const subdomainPrice = await contract.subdomainBasePrice();

      const price = await contract.getPrice(domain.length, false);
      expect(price).to.eq(subdomainPrice);
    });

    it("Returns the base price for domains that are less than the base length", async () => {
      const domainA = "et";
      const domainB = "e";

      const rootPrice = await contract.rootDomainBasePrice();

      let priceRootDomain = await contract.getPrice(domainA.length, true);
      expect(priceRootDomain).to.eq(rootPrice);

      priceRootDomain = await contract.getPrice(domainB.length, true);
      expect(priceRootDomain).to.eq(rootPrice);
    });

    it("Returns the base price for subdomains that are less than the base length", async () => {
      const domainA = "et";
      const domainB = "e";

      const subdomainPrice = await contract.subdomainBasePrice();

      let priceSubdomain = await contract.getPrice(domainA.length, false);
      expect(priceSubdomain).to.eq(subdomainPrice);

      priceSubdomain = await contract.getPrice(domainB.length, false);
      expect(priceSubdomain).to.eq(subdomainPrice);
    });

    it("Returns the expected price for a domain greater than the base length", async () => {
      const domain = "wilder";
      const defaultRootPrice = await contract.rootDomainBasePrice();
      const defaultMultiplier = await contract.priceMultiplier();

      const expectedPrice = (defaultRootPrice.mul(defaultMultiplier)).div(domain.length).div(10);
      const price = await contract.getPrice(domain.length, true);

      expect(price).to.eq(expectedPrice);
    });

    it("Returns the expected price for a subdomain greater than the base length", async () => {
      const domain = "wilder";
      const defaultSubdomainPrice = await contract.subdomainBasePrice();
      const defaultMultiplier = await contract.priceMultiplier();

      const expectedPrice = (defaultSubdomainPrice.mul(defaultMultiplier)).div(domain.length).div(10);
      const price = await contract.getPrice(domain.length, false);

      expect(price).to.eq(expectedPrice);
    });

    it("Returns a price even if the domain name is very long", async () => {
      // 255 length
      const domain = `abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz` +
        `abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz` +
        `abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz` +
        `abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz` +
        `abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstu`;

      const defaultRootPrice = await contract.rootDomainBasePrice();
      const defaultMultiplier = await contract.priceMultiplier();

      const expectedPrice = (defaultRootPrice.mul(defaultMultiplier)).div(domain.length).div(10);
      const price = await contract.getPrice(domain.length, true);

      expect(price).to.eq(expectedPrice);
    });
  });

  describe("setBasePrice", () => {
    it("Allows an authorized user to set the base price", async () => {
      const newBasePrice = hre.ethers.utils.parseEther("0.7");

      await contract.connect(deployer).setBasePrice(newBasePrice, true);

      const updatedBasePrice = await contract.rootDomainBasePrice();
      expect(updatedBasePrice).to.eq(newBasePrice);
    });

    it("Disallows an unauthorized user to set the base price", async () => {
      const newBasePrice = hre.ethers.utils.parseEther("0.7");

      const tx = contract.connect(user).setBasePrice(newBasePrice, true);
      expect(tx).to.be.revertedWith("ZNS: Not allowed");
    });

    it("Allows setting the price to zero", async () => {
      const newBasePrice = BigNumber.from("0");

      await contract.connect(deployer).setBasePrice(newBasePrice, true);

      const updatedBasePrice = await contract.rootDomainBasePrice();
      expect(updatedBasePrice).to.eq(newBasePrice);
    });
  });

  describe("setPriceMultiplier", () => {
    it("Allows an authorized user to set the price multiplier", async () => {
      const newMultiplier = BigNumber.from("25");

      await contract.connect(deployer).setPriceMultipler(newMultiplier);

      const updatedMultiplier = await contract.priceMultiplier();
      expect(updatedMultiplier).to.eq(newMultiplier);
    });

    it("Disallows an unauthorized user to set the price multiplier", async () => {
      const newMultiplier = BigNumber.from("25");

      const tx = contract.connect(user).setPriceMultipler(newMultiplier);
      expect(tx).to.be.revertedWith("ZNS: Not allowed");
    });

    it("Allows setting the multiplier to zero", async () => {
      const newMultiplier = BigNumber.from("0");

      await contract.connect(deployer).setPriceMultipler(newMultiplier);

      const updatedMultiplier = await contract.priceMultiplier();
      expect(updatedMultiplier).to.eq(newMultiplier);
    });
  });

  describe("setBaseLength", () => {
    it("Allows an authorized user to set the length boundary", async () => {
      const newBoundary = 5;

      await contract.connect(deployer).setBaseLength(newBoundary);

      const updatedBoundary = await contract.baseLength();
      expect(updatedBoundary).to.eq(newBoundary);
    });

    it("Disallows an unauthorized user to set the base length", async () => {
      const newBoundary = 5;

      const tx = contract.connect(user).setBaseLength(newBoundary);
      expect(tx).to.be.revertedWith("ZNS: Not allowed");
    });

    it("Allows setting the boundary to zero", async () => {
      const newBoundary = 0;

      await contract.connect(deployer).setBaseLength(newBoundary);

      const updatedBoundary = await contract.baseLength();
      expect(updatedBoundary).to.eq(newBoundary);
    });
  });

  describe("Events", () => {
    it("Emits BasePriceSet", async () => {
      const newBasePrice = hre.ethers.utils.parseEther("0.7");

      const tx = contract.connect(deployer).setBasePrice(newBasePrice, true);
      await expect(tx).to.emit(contract, "BasePriceSet").withArgs(newBasePrice, true);
    });

    it("Emits PriceMultiplierSet", async () => {
      const newMultiplier = BigNumber.from("25");

      const tx = contract.connect(deployer).setPriceMultipler(newMultiplier);
      await expect(tx).to.emit(contract, "PriceMultiplierSet").withArgs(newMultiplier);
    });

    it("Emits BaseLengthSet", async () => {
      const newLength = 5;

      const tx = contract.connect(deployer).setBaseLength(newLength);
      await expect(tx).to.emit(contract, "BaseLengthSet").withArgs(newLength);
    });
  });
});