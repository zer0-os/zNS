import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSPriceOracle, ZNSPriceOracle__factory } from "../typechain";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { PriceOracleConfig as ZNSPriceOracleConfig } from "./helpers/types";
import { getPrice } from "./helpers";

require("@nomicfoundation/hardhat-chai-matchers");

describe("ZNSPriceOracle", () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let mockRegistrar: SignerWithAddress;
  let contract: ZNSPriceOracle;
  let factory: ZNSPriceOracle__factory;

  const config: ZNSPriceOracleConfig = {
    rootDomainPrice: parseEther("1"),
    subdomainPrice: parseEther("0.2"),
    priceMultiplier: BigNumber.from("390"),
    baseLength: 3,
    registrarAddress: "", // Not declared until `beforeEach` below
  };

  beforeEach(async () => {
    [deployer, user, mockRegistrar] = await hre.ethers.getSigners();

    factory = new ZNSPriceOracle__factory(deployer);
    contract = await factory.deploy();

    config.registrarAddress = mockRegistrar.address;

    await contract.initialize(
      config.rootDomainPrice,
      config.subdomainPrice,
      config.priceMultiplier,
      config.baseLength,
      config.registrarAddress
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

      const expectedPrice = await getPrice(domain.length, contract, true);
      const price = await contract.getPrice(domain.length, true);

      expect(price).to.eq(expectedPrice);
    });

    it("Returns the expected price for a subdomain greater than the base length", async () => {
      const domain = "wilder";

      const expectedPrice = await getPrice(domain.length, contract, false);
      const price = await contract.getPrice(domain.length, false);

      expect(price).to.eq(expectedPrice);
    });

    it("Returns a price even if the domain name is very long", async () => {
      // 255 length
      const domain = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstu";

      const expectedPrice = await getPrice(domain.length, contract, true);
      const price = await contract.getPrice(domain.length, true);

      expect(price).to.eq(expectedPrice);
    });
  });

  describe("setBasePrice", () => {
    it("Allows an authorized user to set the base price", async () => {
      const newBasePrice = parseEther("0.7");

      await contract.connect(deployer).setBasePrice(newBasePrice, true);

      const updatedBasePrice = await contract.rootDomainBasePrice();
      expect(updatedBasePrice).to.eq(newBasePrice);
    });

    it("Disallows an unauthorized user to set the base price", async () => {
      const newBasePrice = parseEther("0.7");

      const tx = contract.connect(user).setBasePrice(newBasePrice, true);
      expect(tx).to.be.revertedWith("ZNS: Not allowed");
    });

    it("Allows setting the price to zero", async () => {
      const newBasePrice = BigNumber.from("0");

      await contract.connect(deployer).setBasePrice(newBasePrice, true);

      const updatedBasePrice = await contract.rootDomainBasePrice();
      expect(updatedBasePrice).to.eq(newBasePrice);
    });

    it("Causes any length domain to have a price of 0 if the basePrice is 0", async () => {
      const newBasePrice = BigNumber.from("0");

      await contract.connect(deployer).setBasePrice(newBasePrice, true);

      const shortDomain = "a";
      const longDomain = "abcdefghijklmnopqrstuvwxyz";

      const shortPrice = await contract.getPrice(shortDomain.length, true);
      const longPrice = await contract.getPrice(longDomain.length, true);

      expect(shortPrice).to.eq(BigNumber.from("0"));
      expect(longPrice).to.eq(BigNumber.from("0"));
    });
  });

  describe("setPriceMultiplier", () => {
    it("Allows an authorized user to set the price multiplier", async () => {
      const newMultiplier = BigNumber.from("300");

      await contract.connect(deployer).setPriceMultiplier(newMultiplier);

      const updatedMultiplier = await contract.priceMultiplier();
      expect(updatedMultiplier).to.eq(newMultiplier);
    });

    it("Disallows an unauthorized user to set the price multiplier", async () => {
      const newMultiplier = BigNumber.from("300");

      const tx = contract.connect(user).setPriceMultiplier(newMultiplier);
      expect(tx).to.be.revertedWith("ZNS: Not allowed");
    });

    it("Fails when setting to a value below the specified range", async () => {
      // Valid range is 300 - 400
      const newMultiplier = BigNumber.from("299");

      const tx = contract.connect(deployer).setPriceMultiplier(newMultiplier);
      await expect(tx).to.be.revertedWith("ZNS: Multiplier out of range");
    });

    it("Fails when setting to a value above the specified range", async () => {
      // Valid range is 300 - 400
      const newMultiplier = BigNumber.from("401");

      const tx = contract.connect(deployer).setPriceMultiplier(newMultiplier);
      await expect(tx).to.be.revertedWith("ZNS: Multiplier out of range");
    });

    it("Succeeds when setting a value within the allowed range", async () => {
      // Valid range is 300 - 400
      const newMultiplier = BigNumber.from("350");

      await contract.connect(deployer).setPriceMultiplier(newMultiplier);

      const multiplier = await contract.priceMultiplier();
      expect(multiplier).to.eq(newMultiplier);
    });
  });

  describe("setBaseLength", () => {
    it("Allows an authorized user to set the length boundary", async () => {
      const newLength = 5;

      await contract.connect(deployer).setBaseLength(newLength);

      const updatedLength = await contract.baseLength();
      expect(updatedLength).to.eq(newLength);
    });

    it("Disallows an unauthorized user to set the base length", async () => {
      const newLength = 5;

      const tx = contract.connect(user).setBaseLength(newLength);
      expect(tx).to.be.revertedWith("ZNS: Not allowed");
    });

    it("Allows setting the base length to zero", async () => {
      const newLength = 0;

      await contract.connect(deployer).setBaseLength(newLength);

      const updatedLength = await contract.baseLength();
      expect(updatedLength).to.eq(newLength);
    });

    it("Causes any length domain to cost the base fee when set to max length of 255", async () => {
      const newLength = 255;
      await contract.connect(deployer).setBaseLength(newLength);

      const shortDomain = "a";
      const longDomain = "abcdefghijklmnopqrstuvwxyz";

      const shortPrice = await contract.getPrice(shortDomain.length, true);
      const longPrice = await contract.getPrice(longDomain.length, true);

      expect(shortPrice).to.eq(config.rootDomainPrice);
      expect(longPrice).to.eq(config.rootDomainPrice);
    });
  });

  describe("Events", () => {
    it("Emits BasePriceSet", async () => {
      const newBasePrice = parseEther("0.7");

      const tx = contract.connect(deployer).setBasePrice(newBasePrice, true);
      await expect(tx).to.emit(contract, "BasePriceSet").withArgs(newBasePrice, true);
    });

    it("Emits PriceMultiplierSet", async () => {
      const newMultiplier = BigNumber.from("350");

      const tx = contract.connect(deployer).setPriceMultiplier(newMultiplier);
      await expect(tx).to.emit(contract, "PriceMultiplierSet").withArgs(newMultiplier);
    });

    it("Emits BaseLengthSet", async () => {
      const newLength = 5;

      const tx = contract.connect(deployer).setBaseLength(newLength);
      await expect(tx).to.emit(contract, "BaseLengthSet").withArgs(newLength);
    });
  });
});