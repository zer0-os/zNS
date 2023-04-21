import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSPriceOracle, ZNSPriceOracle__factory } from "../typechain";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { PriceOracleConfig } from "./helpers/types";
import { getPrice } from "./helpers";

require("@nomicfoundation/hardhat-chai-matchers");

describe("ZNSPriceOracle", () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let mockRegistrar: SignerWithAddress;
  let updatedMockRegistrar: SignerWithAddress;
  let contract: ZNSPriceOracle;
  let factory: ZNSPriceOracle__factory;

  const config: PriceOracleConfig = {
    rootDomainPrice: parseEther("1"),
    subdomainPrice: parseEther("0.2"),
    priceMultiplier: BigNumber.from("390"),
    rootDomainBaseLength: 3,
    subdomainBaseLength: 3,
    registrarAddress: "", // Not declared until `beforeEach` below
  };

  beforeEach(async () => {
    [deployer, user, mockRegistrar, updatedMockRegistrar] = await hre.ethers.getSigners();

    factory = new ZNSPriceOracle__factory(deployer);
    contract = await factory.deploy();

    config.registrarAddress = mockRegistrar.address;

    await contract.initialize(
      config.rootDomainPrice,
      config.subdomainPrice,
      config.priceMultiplier,
      config.rootDomainBaseLength,
      config.subdomainBaseLength,
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

  it("Confirms a random user is not authorized", async () => {
    const authorized = await contract.isAuthorized(user.address);
    expect(authorized).to.be.false;
  });

  it("Confirms values were initially set correctly", async () => {

    const valueCalls = [
      contract.rootDomainBasePrice(),
      contract.subdomainBasePrice(),
      contract.priceMultiplier(),
      contract.rootDomainBaseLength(),
      contract.subdomainBaseLength(),
    ];

    const [
      rootDomainBasePrice,
      subdomainBasePrice,
      multiplier,
      rootDomainBaseLength,
      subdomainBaseLength,
    ] = await Promise.all(valueCalls);

    expect(rootDomainBasePrice).to.eq(config.rootDomainPrice);
    expect(subdomainBasePrice).to.eq(config.subdomainPrice);
    expect(multiplier).to.eq(config.priceMultiplier);
    expect(rootDomainBaseLength).to.eq(config.rootDomainBaseLength);
    expect(subdomainBaseLength).to.eq(config.subdomainBaseLength);
  });

  describe("getPrice", async () => {
    it("Returns 0 price for a root name with no length", async () => {
      const priceRootDomain = await contract.getPrice("", true);
      expect(priceRootDomain).to.eq(0);
    });

    it("Returns 0 price for a subdomain name with no length", async () => {
      const priceSubdomain = await contract.getPrice("", false);
      expect(priceSubdomain).to.eq(0);
    });

    it("Returns the base price for domains that are equal to the base length", async () => {
      // Using the default length of 3
      const domain = "eth";

      const rootPrice = await contract.rootDomainBasePrice();

      const price = await contract.getPrice(domain, true);
      expect(price).to.eq(rootPrice);
    });

    it("Returns the base price for subdomains that are equal to the base length", async () => {
      const domain = "eth";

      const subdomainPrice = await contract.subdomainBasePrice();

      const price = await contract.getPrice(domain, false);
      expect(price).to.eq(subdomainPrice);
    });

    it("Returns the base price for domains that are less than the base length", async () => {
      const domainA = "et";
      const domainB = "e";

      const rootPrice = await contract.rootDomainBasePrice();

      let priceRootDomain = await contract.getPrice(domainA, true);
      expect(priceRootDomain).to.eq(rootPrice);

      priceRootDomain = await contract.getPrice(domainB, true);
      expect(priceRootDomain).to.eq(rootPrice);
    });

    it("Returns the base price for subdomains that are less than the base length", async () => {
      const domainA = "et";
      const domainB = "e";

      const subdomainPrice = await contract.subdomainBasePrice();

      let priceSubdomain = await contract.getPrice(domainA, false);
      expect(priceSubdomain).to.eq(subdomainPrice);

      priceSubdomain = await contract.getPrice(domainB, false);
      expect(priceSubdomain).to.eq(subdomainPrice);
    });

    it("Returns the expected price for a domain greater than the base length", async () => {
      const domain = "wilder";

      const expectedPrice = await getPrice(domain, contract, true);
      const price = await contract.getPrice(domain, true);

      expect(price).to.eq(expectedPrice);
    });

    it("Returns the expected price for a subdomain greater than the base length", async () => {
      const domain = "wilder";

      const expectedPrice = await getPrice(domain, contract, false);
      const price = await contract.getPrice(domain, false);

      expect(price).to.eq(expectedPrice);
    });

    it("Returns a price even if the domain name is very long", async () => {
      // 255 length
      const domain = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstu";

      const expectedPrice = await getPrice(domain, contract, true);
      const price = await contract.getPrice(domain, true);

      expect(price).to.eq(expectedPrice);
    });

    it("Returns a price even if the subdomain name is very long", async () => {
      // 255 length
      const domain = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstu";

      const expectedPrice = await getPrice(domain, contract, false);
      const price = await contract.getPrice(domain, false);

      expect(price).to.eq(expectedPrice);
    });

    it("Returns a price for multiple lengths when the multiplier is min value", async () => {
      const newMultiplier = BigNumber.from("300");
      await contract.setPriceMultiplier(newMultiplier);

      // Any value less than base length is always base price, so we only check
      // domains that are greater than base length + 1
      const short = "wild";
      const medium = "wilderworld";
      const long = "wilderworld.beasts.pets.nfts.cats.calico.steve";

      const expectedShortPrice = await getPrice(short, contract, true);
      const shortPrice = await contract.getPrice(short, true);
      expect(expectedShortPrice).to.eq(shortPrice);

      const expectedMediumPrice = await getPrice(medium, contract, true);
      const mediumPrice = await contract.getPrice(medium, true);
      expect(expectedMediumPrice).to.eq(mediumPrice);

      const expectedLongPrice = await getPrice(long, contract, true);
      const longPrice = await contract.getPrice(long, true);
      expect(expectedLongPrice).to.eq(longPrice);
    });

    it("Returns a price for multiple lengths when the multiplier is max value", async () => {
      const newMultiplier = BigNumber.from("400");
      await contract.setPriceMultiplier(newMultiplier);

      // Any value less than base length is always base price, so we only check
      // domains that are greater than base length + 1
      const short = "wild";
      const medium = "wilderworld";
      const long = "wilderworld.beasts.pets.nfts.cats.calico.steve";

      const expectedShortPrice = await getPrice(short, contract, true);
      const shortPrice = await contract.getPrice(short, true);
      expect(expectedShortPrice).to.eq(shortPrice);

      const expectedMediumPrice = await getPrice(medium, contract, true);
      const mediumPrice = await contract.getPrice(medium, true);
      expect(expectedMediumPrice).to.eq(mediumPrice);

      const expectedLongPrice = await getPrice(long, contract, true);
      const longPrice = await contract.getPrice(long, true);
      expect(expectedLongPrice).to.eq(longPrice);
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

    it("Correctly sets the root and subdomain base price", async () => {
      const newBasePrice = parseEther("0.5");
      await contract.connect(deployer).setBasePrice(newBasePrice, true);

      const rootBasePrice = await contract.rootDomainBasePrice();
      expect(rootBasePrice).to.eq(newBasePrice);

      await contract.connect(deployer).setBasePrice(newBasePrice, false);

      const subdomainBasePrice = await contract.subdomainBasePrice();
      expect(subdomainBasePrice).to.eq(newBasePrice);
    });

    it("Causes any length domain to have a price of 0 if the basePrice is 0", async () => {
      const newBasePrice = BigNumber.from("0");

      await contract.connect(deployer).setBasePrice(newBasePrice, true);

      const shortDomain = "a";
      const longDomain = "abcdefghijklmnopqrstuvwxyz";

      const shortPrice = await contract.getPrice(shortDomain, true);
      const longPrice = await contract.getPrice(longDomain, true);

      expect(shortPrice).to.eq(BigNumber.from("0"));
      expect(longPrice).to.eq(BigNumber.from("0"));
    });

    it("The price of a domain is modified relatively when the basePrice is changed", async () => {
      const newBasePrice = parseEther("0.1");
      const domain = "wilder";

      const expectedPriceBefore = await getPrice(domain, contract, false);
      const priceBefore = await contract.getPrice(domain, false);

      expect(expectedPriceBefore).to.eq(priceBefore);

      await contract.connect(deployer).setBasePrice(newBasePrice, false);

      const expectedPriceAfter = await getPrice(domain, contract, false);
      const priceAfter = await contract.getPrice(domain, false);

      expect(expectedPriceAfter).to.eq(priceAfter);
      expect(expectedPriceAfter).to.be.lt(expectedPriceBefore);
      expect(priceAfter).to.be.lt(priceBefore);
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

  describe("setBaseLength(s)", () => {
    it("Allows an authorized user to set the base length", async () => {
      const newLength = 5;

      await contract.connect(deployer).setBaseLength(newLength, true);

      const updatedLength = await contract.rootDomainBaseLength();
      expect(updatedLength).to.eq(newLength);
    });

    it("Disallows an unauthorized user to set the base length", async () => {
      const newLength = 5;

      const tx = contract.connect(user).setBaseLength(newLength, true);
      expect(tx).to.be.revertedWith("ZNS: Not allowed");
    });

    it("Allows setting the base length to zero", async () => {
      const newLength = 0;

      await contract.connect(deployer).setBaseLength(newLength, true);

      const updatedLength = await contract.rootDomainBaseLength();
      expect(updatedLength).to.eq(newLength);
    });

    it("Causes any length domain to cost the base fee when set to max length of 255", async () => {
      const newLength = 255;
      await contract.connect(deployer).setBaseLength(newLength, true);

      const shortDomain = "a";
      const longDomain = "abcdefghijklmnopqrstuvwxyz";

      const shortPrice = await contract.getPrice(shortDomain, true);
      const longPrice = await contract.getPrice(longDomain, true);

      expect(shortPrice).to.eq(config.rootDomainPrice);
      expect(longPrice).to.eq(config.rootDomainPrice);
    });

    it("Causes prices to adjust correctly when length is increased", async () => {
      const newLength = 8;
      const domain = "wilder";

      const basePrice = await contract.rootDomainBasePrice();

      const expectedPriceBefore = await getPrice(domain, contract, true);
      const priceBefore = await contract.getPrice(domain, true);
      expect(priceBefore).to.eq(expectedPriceBefore);
      expect(priceBefore).to.not.eq(basePrice);

      await contract.connect(deployer).setBaseLength(newLength, true);

      const expectedPriceAfter = await getPrice(domain, contract, true);
      const priceAfter = await contract.getPrice(domain, true);
      expect(priceAfter).to.eq(expectedPriceAfter);
      expect(priceAfter).to.eq(basePrice);
    });

    it("Causes prices to adjust correctly when length is decreased", async () => {
      const length = 8;
      await contract.connect(deployer).setBaseLength(length, true);

      const domain = "wilder";

      const basePrice = await contract.rootDomainBasePrice();

      const expectedPriceBefore = await getPrice(domain, contract, true);
      const priceBefore = await contract.getPrice(domain, true);
      expect(priceBefore).to.eq(expectedPriceBefore);
      expect(priceBefore).to.eq(basePrice);

      const newLength = 3;
      await contract.connect(deployer).setBaseLength(newLength, true);

      const expectedPriceAfter = await getPrice(domain, contract, true);
      const priceAfter = await contract.getPrice(domain, true);
      expect(priceAfter).to.eq(expectedPriceAfter);
      expect(priceAfter).to.not.eq(basePrice);
    });

    it("Allows an authorized user to set both base lengths", async () => {
      const newLength = 5;

      await contract.connect(deployer).setBaseLengths(newLength, newLength);

      const updatedRootLength = await contract.rootDomainBaseLength();
      const updatedSubdomainLength = await contract.subdomainBaseLength();

      expect(updatedRootLength).to.eq(newLength);
      expect(updatedSubdomainLength).to.eq(newLength);
    });

    it("Disallows an unauthorized user to set both base lengths", async () => {
      const newLength = 5;

      const tx = contract.connect(user).setBaseLengths(newLength, newLength);
      expect(tx).to.be.revertedWith("ZNS: Not allowed");
    });

    it("Adjusts prices correctly when setting base lengths to different values", async () => {
      const newRootLength = 0;
      const newSubdomainLength = 5;

      await contract.connect(deployer).setBaseLengths(newRootLength, newSubdomainLength);

      const domain = "wilder";

      const expectedRootPrice = await getPrice(domain, contract, true);
      const rootPrice = await contract.getPrice(domain, true);
      expect(rootPrice).to.eq(expectedRootPrice);

      const expectedSubdomainPrice = await getPrice(domain, contract, false);
      const subdomainPrice = await contract.getPrice(domain, false);
      expect(subdomainPrice).to.eq(expectedSubdomainPrice);

      expect(rootPrice).to.not.eq(subdomainPrice);
    });
  });

  describe("setZNSRegistrar", () => {
    it("Allows an authorized user to modify the registrar address", async () => {
      await contract.connect(deployer).setZNSRegistrar(updatedMockRegistrar.address);

      const newAddress = await contract.znsRegistrar();
      expect(newAddress).to.eq(updatedMockRegistrar.address);
    });

    it("Disallows an authorized user to modify the registrar address", async () => {
      const tx = contract.connect(user).setZNSRegistrar(updatedMockRegistrar.address);

      await expect(tx).to.be.revertedWith("ZNS: Not authorized");
    });

    it("Revokes authorized status from the old registrar when updated", async () => {
      await contract.connect(deployer).setZNSRegistrar(updatedMockRegistrar.address);

      const isOldAuthorized = await contract.isAuthorized(mockRegistrar.address);
      const isNewAuthorized = await contract.isAuthorized(updatedMockRegistrar.address);

      expect(isOldAuthorized).to.be.false;
      expect(isNewAuthorized).to.be.true;
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

      const tx = contract.connect(deployer).setBaseLength(newLength, true);
      await expect(tx).to.emit(contract, "BaseLengthSet").withArgs(newLength, true);
    });
    it("Emits BaseLengthsSet", async () => {
      const newLength = 5;

      const tx = contract.connect(deployer).setBaseLengths(newLength, newLength);
      await expect(tx).to.emit(contract, "BaseLengthsSet").withArgs(newLength, newLength);
    });

    it("Emits ZNSRegistrarSet", async () => {
      const tx = contract.connect(deployer).setZNSRegistrar(updatedMockRegistrar.address);
      await expect(tx).to.emit(contract, "ZNSRegistrarSet").withArgs(updatedMockRegistrar.address);
    });
  });
});