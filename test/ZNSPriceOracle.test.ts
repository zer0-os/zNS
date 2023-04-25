import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSPriceOracle, ZNSPriceOracle__factory } from "../typechain";
import { BigNumber, Signer } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { PriceParams, ZNSContracts } from "./helpers/types";
import { deployZNS, getPrice } from "./helpers";

require("@nomicfoundation/hardhat-chai-matchers");

describe("ZNSPriceOracle", () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let mockRegistrar: SignerWithAddress;
  let updatedMockRegistrar: SignerWithAddress;
  let burnAddress: SignerWithAddress;

  let zns: ZNSContracts;

  // const config: PriceParams = {
  //   maxroot: parseEther("1"),
  //   subdomainPrice: parseEther("0.2"),
  //   priceMultiplier: BigNumber.from("390"),
  //   rootDomainBaseLength: 3,
  //   subdomainBaseLength: 3,
  //   // registrarAddress: "", // Not declared until `beforeEach` below
  // };

  beforeEach(async () => {
    [
      deployer,
      user,
      mockRegistrar,
      updatedMockRegistrar,
      burnAddress
    ] = await hre.ethers.getSigners();

    zns = await deployZNS(deployer, burnAddress.address);

    await zns.priceOracle.connect(deployer).setZNSRegistrar(mockRegistrar.address)
  });

  it("Confirms the mockRegistrar is authorized", async () => {
    const authorized = await zns.priceOracle.isAuthorized(mockRegistrar.address);
    expect(authorized).to.be.true;
  });

  it("Confirms the deployer is authorized", async () => {
    const authorized = await zns.priceOracle.isAuthorized(deployer.address);
    expect(authorized).to.be.true;
  });

  it("Confirms a random user is not authorized", async () => {
    const authorized = await zns.priceOracle.isAuthorized(user.address);
    expect(authorized).to.be.false;
  });

  it("Confirms values were initially set correctly", async () => {

    // const valueCalls = [
    //   zns.priceOracle.rootDomainBasePrice(),
    //   zns.priceOracle.subdomainBasePrice(),
    //   zns.priceOracle.priceMultiplier(),
    //   zns.priceOracle.rootDomainBaseLength(),
    //   zns.priceOracle.subdomainBaseLength(),
    // ];

    // const [
    //   rootDomainBasePrice,
    //   subdomainBasePrice,
    //   multiplier,
    //   rootDomainBaseLength,
    //   subdomainBaseLength,
    // ] = await Promise.all(valueCalls);

    // expect(rootDomainBasePrice).to.eq(params.maxRootDomainPrice);
    // expect(subdomainBasePrice).to.eq(config.subdomainPrice);
    // expect(multiplier).to.eq(config.priceMultiplier);
    // expect(rootDomainBaseLength).to.eq(config.rootDomainBaseLength);
    // expect(subdomainBaseLength).to.eq(config.subdomainBaseLength);
  });

  describe("getPrice", async () => {
    it("Returns 0 price for a root name with no length", async () => {
      const priceRootDomain = await zns.priceOracle.getPrice("", true);
      expect(priceRootDomain).to.eq(0);
    });

    it("Returns 0 price for a subdomain name with no length", async () => {
      const priceSubdomain = await zns.priceOracle.getPrice("", false);
      expect(priceSubdomain).to.eq(0);
    });

    it("Returns the base price for domains that are equal to the base length", async () => {
      // Using the default length of 3
      const domain = "eth";
      const params = await zns.priceOracle.params();

      const price = await zns.priceOracle.getPrice(domain, true);
      expect(price).to.eq(params.maxRootDomainPrice);
    });

    it("Returns the base price for subdomains that are equal to the base length", async () => {
      const domain = "eth";

      const params = await zns.priceOracle.params();

      // const subdomainPrice = await zns.priceOracle.subdomainBasePrice();

      const price = await zns.priceOracle.getPrice(domain, false);
      expect(price).to.eq(params.maxSubdomainPrice);
    });

    it("Returns the base price for domains that are less than the base length", async () => {
      const domainA = "et";
      const domainB = "e";
      const params = await zns.priceOracle.params();

      // const rootPrice = await zns.priceOracle.rootDomainBasePrice();

      let priceRootDomain = await zns.priceOracle.getPrice(domainA, true);
      expect(priceRootDomain).to.eq(params.maxRootDomainPrice);

      priceRootDomain = await zns.priceOracle.getPrice(domainB, true);
      expect(priceRootDomain).to.eq(params.maxRootDomainPrice);
    });

    it("Returns the base price for subdomains that are less than the base length", async () => {
      const domainA = "et";
      const domainB = "e";
      const params = await zns.priceOracle.params();

      // const subdomainPrice = await zns.priceOracle.subdomainBasePrice();

      let subdomainPrice = await zns.priceOracle.getPrice(domainA, false);
      expect(subdomainPrice).to.eq(params.maxSubdomainPrice);

      subdomainPrice = await zns.priceOracle.getPrice(domainB, false);
      expect(subdomainPrice).to.eq(params.maxSubdomainPrice);
    });

    it("Returns the expected price for a domain greater than the base length", async () => {
      const domain = "wilder";

      const expectedPrice = await getPrice(domain, zns.priceOracle, true);
      const price = await zns.priceOracle.getPrice(domain, true);
      
      expect(price).to.eq(expectedPrice);
    });

    it("Returns the expected price for a subdomain greater than the base length", async () => {
      const domain = "wilder";

      const expectedPrice = await getPrice(domain, zns.priceOracle, false);
      const price = await zns.priceOracle.getPrice(domain, false);

      expect(price).to.eq(expectedPrice);
    });

    it("Returns a price even if the domain name is very long", async () => {
      // 255 length
      const domain = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstu";

      const expectedPrice = await getPrice(domain, zns.priceOracle, true);
      const price = await zns.priceOracle.getPrice(domain, true);

      expect(price).to.eq(expectedPrice);
    });

    it("Returns a price even if the subdomain name is very long", async () => {
      // 255 length
      const domain = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstu";

      const expectedPrice = await getPrice(domain, zns.priceOracle, false);
      const price = await zns.priceOracle.getPrice(domain, false);

      expect(price).to.eq(expectedPrice);
    });

    it("Returns a price for multiple lengths when the multiplier is min value", async () => {
      const newMultiplier = BigNumber.from("300");
      await zns.priceOracle.setPriceMultiplier(newMultiplier);

      // Any value less than base length is always base price, so we only check
      // domains that are greater than base length + 1
      const short = "wild";
      const medium = "wilderworld";
      const long = "wilderworld.beasts.pets.nfts.cats.calico.steve";

      const expectedShortPrice = await getPrice(short, zns.priceOracle, true);
      const shortPrice = await zns.priceOracle.getPrice(short, true);
      expect(expectedShortPrice).to.eq(shortPrice);

      const expectedMediumPrice = await getPrice(medium, zns.priceOracle, true);
      const mediumPrice = await zns.priceOracle.getPrice(medium, true);
      expect(expectedMediumPrice).to.eq(mediumPrice);

      const expectedLongPrice = await getPrice(long, zns.priceOracle, true);
      const longPrice = await zns.priceOracle.getPrice(long, true);
      expect(expectedLongPrice).to.eq(longPrice);
    });

    it("Returns a price for multiple lengths when the multiplier is max value", async () => {
      const newMultiplier = BigNumber.from("400");
      await zns.priceOracle.setPriceMultiplier(newMultiplier);

      // Any value less than base length is always base price, so we only check
      // domains that are greater than base length + 1
      const short = "wild";
      const medium = "wilderworld";
      const long = "wilderworld.beasts.pets.nfts.cats.calico.steve";

      const expectedShortPrice = await getPrice(short, zns.priceOracle, true);
      const shortPrice = await zns.priceOracle.getPrice(short, true);
      expect(expectedShortPrice).to.eq(shortPrice);

      const expectedMediumPrice = await getPrice(medium, zns.priceOracle, true);
      const mediumPrice = await zns.priceOracle.getPrice(medium, true);
      expect(expectedMediumPrice).to.eq(mediumPrice);

      const expectedLongPrice = await getPrice(long, zns.priceOracle, true);
      const longPrice = await zns.priceOracle.getPrice(long, true);
      expect(expectedLongPrice).to.eq(longPrice);
    });

    it("Prices Special Characters Accurately", async () => {
      const domainSpecialCharacterSet1 = "±ƒc¢Ãv";
      const domainSpecialCharacterSet2 = "œ柸þ€§ﾪ";
      const domainWithoutSpecials = "abcdef";
      const expectedPrice = await getPrice(domainWithoutSpecials, zns.priceOracle, false);
      let price = await zns.priceOracle.getPrice(domainSpecialCharacterSet1, false);
      expect(price).to.eq(expectedPrice);

      price = await zns.priceOracle.getPrice(domainSpecialCharacterSet2, false);
      expect(price).to.eq(expectedPrice);
    });

    it("Can Price Names Longer Than 255 Characters", async () => {
      // 261 length
      const domain = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
      "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
      "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
      "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
      "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
      "a";
      const expectedPrice = await getPrice(domain, zns.priceOracle, false);
      const price = await zns.priceOracle.getPrice(domain, false);
      expect(price).to.eq(expectedPrice);
    });
  });

  describe("setBasePrice", () => {
    it("Allows an authorized user to set the base price", async () => {
      const newMaxPrice = parseEther("0.7");

      await zns.priceOracle.connect(deployer).setMaxPrice(newMaxPrice, true);

      const params = await zns.priceOracle.params();
      expect(params.maxRootDomainPrice).to.eq(newMaxPrice);
    });

    it("Disallows an unauthorized user to set the base price", async () => {
      const newMaxPrice = parseEther("0.7");
      const params = await zns.priceOracle.params();

      const tx = zns.priceOracle.connect(user).setMaxPrice(newMaxPrice, true);
      expect(tx).to.be.revertedWith("ZNS: Not allowed");
    });

    it("Allows setting the price to zero", async () => {
      const newMaxPrice = BigNumber.from("0");

      await zns.priceOracle.connect(deployer).setMaxPrice(newMaxPrice, true);
      const params = await zns.priceOracle.params();

      expect(params.maxRootDomainPrice).to.eq(newMaxPrice);
    });

    it("Correctly sets the root and subdomain base price", async () => {
      const newMaxPrice = parseEther("0.5");
      await zns.priceOracle.connect(deployer).setMaxPrice(newMaxPrice, true);

      const paramsBefore = await zns.priceOracle.params();
      expect(paramsBefore.maxRootDomainPrice).to.eq(newMaxPrice);

      await zns.priceOracle.connect(deployer).setMaxPrice(newMaxPrice, false);

      const paramsAfter = await zns.priceOracle.params();
      expect(paramsAfter.maxSubdomainPrice).to.eq(newMaxPrice);
    });

    it("Causes any length domain to have a price of 0 if the basePrice is 0", async () => {
      const newMaxPrice = BigNumber.from("0");
      const params = await zns.priceOracle.params();

      await zns.priceOracle.connect(deployer).setMaxPrice(newMaxPrice, true);

      const shortDomain = "a";
      const longDomain = "abcdefghijklmnopqrstuvwxyz";

      const shortPrice = await zns.priceOracle.getPrice(shortDomain, true);
      const longPrice = await zns.priceOracle.getPrice(longDomain, true);

      expect(shortPrice).to.eq(BigNumber.from("0"));
      expect(longPrice).to.eq(BigNumber.from("0"));
    });

    it("The price of a domain is modified relatively when the basePrice is changed", async () => {
      const newMaxPrice = parseEther("0.1");
      const domain = "wilder";

      const expectedPriceBefore = await getPrice(domain, zns.priceOracle, false);
      const priceBefore = await zns.priceOracle.getPrice(domain, false);

      expect(expectedPriceBefore).to.eq(priceBefore);

      await zns.priceOracle.connect(deployer).setMaxPrice(newMaxPrice, false);

      const expectedPriceAfter = await getPrice(domain, zns.priceOracle, false);
      const priceAfter = await zns.priceOracle.getPrice(domain, false);

      expect(expectedPriceAfter).to.eq(priceAfter);
      expect(expectedPriceAfter).to.be.lt(expectedPriceBefore);
      expect(priceAfter).to.be.lt(priceBefore);
    });
  });

  describe("setPriceMultiplier", () => {
    it("Allows an authorized user to set the price multiplier", async () => {
      const newMultiplier = BigNumber.from("300");

      await zns.priceOracle.connect(deployer).setPriceMultiplier(newMultiplier);
      const params = await zns.priceOracle.params();
      expect(params.priceMultiplier).to.eq(newMultiplier);
    });

    it("Disallows an unauthorized user to set the price multiplier", async () => {
      const newMultiplier = BigNumber.from("300");

      const tx = zns.priceOracle.connect(user).setPriceMultiplier(newMultiplier);
      expect(tx).to.be.revertedWith("ZNS: Not allowed");
    });

    it("Fails when setting to a value below the specified range", async () => {
      // Valid range is 300 - 400
      const newMultiplier = BigNumber.from("299");

      const tx = zns.priceOracle.connect(deployer).setPriceMultiplier(newMultiplier);
      await expect(tx).to.be.revertedWith("ZNS: Multiplier out of range");
    });

    it("Fails when setting to a value above the specified range", async () => {
      // Valid range is 300 - 400
      const newMultiplier = BigNumber.from("401");

      const tx = zns.priceOracle.connect(deployer).setPriceMultiplier(newMultiplier);
      await expect(tx).to.be.revertedWith("ZNS: Multiplier out of range");
    });

    it("Succeeds when setting a value within the allowed range", async () => {
      // Valid range is 300 - 400
      const newMultiplier = BigNumber.from("350");

      await zns.priceOracle.connect(deployer).setPriceMultiplier(newMultiplier);

      const params = await zns.priceOracle.params();
      expect(params.priceMultiplier).to.eq(newMultiplier);
    });
  });

  describe("setBaseLength(s)", () => {
    it("Allows an authorized user to set the base length", async () => {
      const newLength = 5;

      await zns.priceOracle.connect(deployer).setBaseLength(newLength, true);
      const params = await zns.priceOracle.params();

      expect(params.baseRootDomainLength).to.eq(newLength);
    });

    it("Disallows an unauthorized user to set the base length", async () => {
      const newLength = 5;

      const tx = zns.priceOracle.connect(user).setBaseLength(newLength, true);
      expect(tx).to.be.revertedWith("ZNS: Not allowed");
    });

    it("Allows setting the base length to zero", async () => {
      const newLength = 0;

      await zns.priceOracle.connect(deployer).setBaseLength(newLength, true);
      const params = await zns.priceOracle.params();

      expect(params.baseRootDomainLength).to.eq(newLength);
    });

    it("Causes any length domain to cost the base fee when set to max length of 255", async () => {
      const newLength = 255;
      await zns.priceOracle.connect(deployer).setBaseLength(newLength, true);
      const params = await zns.priceOracle.params();

      const shortDomain = "a";
      const longDomain = "abcdefghijklmnopqrstuvwxyz";

      const shortPrice = await zns.priceOracle.getPrice(shortDomain, true);
      const longPrice = await zns.priceOracle.getPrice(longDomain, true);

      expect(shortPrice).to.eq(params.maxRootDomainPrice);
      expect(longPrice).to.eq(params.maxRootDomainPrice);
    });

    it("Causes prices to adjust correctly when length is increased", async () => {
      const newLength = 8;
      const domain = "wilder";
      const paramsBefore = await zns.priceOracle.params();

      const expectedPriceBefore = await getPrice(domain, zns.priceOracle, true);
      const priceBefore = await zns.priceOracle.getPrice(domain, true);
      expect(priceBefore).to.eq(expectedPriceBefore);
      expect(priceBefore).to.not.eq(paramsBefore.maxRootDomainPrice);

      await zns.priceOracle.connect(deployer).setBaseLength(newLength, true);

      const paramsAfter = await zns.priceOracle.params();

      const expectedPriceAfter = await getPrice(domain, zns.priceOracle, true);
      const priceAfter = await zns.priceOracle.getPrice(domain, true);
      expect(priceAfter).to.eq(expectedPriceAfter);
      expect(priceAfter).to.eq(paramsAfter.maxRootDomainPrice);
    });

    it("Causes prices to adjust correctly when length is decreased", async () => {
      const length = 8;
      await zns.priceOracle.connect(deployer).setBaseLength(length, true);

      const domain = "wilder";

      // const basePrice = await zns.priceOracle.rootDomainBasePrice();
      const paramsBefore = await zns.priceOracle.params();

      const expectedPriceBefore = await getPrice(domain, zns.priceOracle, true);
      const priceBefore = await zns.priceOracle.getPrice(domain, true);
      expect(priceBefore).to.eq(expectedPriceBefore);
      expect(priceBefore).to.eq(paramsBefore.maxRootDomainPrice);

      const newLength = 3;
      await zns.priceOracle.connect(deployer).setBaseLength(newLength, true);

      const paramsAfter = await zns.priceOracle.params();

      const expectedPriceAfter = await getPrice(domain, zns.priceOracle, true);
      const priceAfter = await zns.priceOracle.getPrice(domain, true);
      expect(priceAfter).to.eq(expectedPriceAfter);
      expect(priceAfter).to.not.eq(paramsAfter.maxRootDomainPrice);
    });

    it("Allows an authorized user to set both base lengths", async () => {
      const newLength = 5;
      
      await zns.priceOracle.connect(deployer).setBaseLengths(newLength, newLength);
      
      const params = await zns.priceOracle.params();
      expect(params.baseRootDomainLength).to.eq(newLength);
      expect(params.baseSubdomainLength).to.eq(newLength);
    });

    it("Disallows an unauthorized user to set both base lengths", async () => {
      const newLength = 5;

      const tx = zns.priceOracle.connect(user).setBaseLengths(newLength, newLength);
      expect(tx).to.be.revertedWith("ZNS: Not allowed");
    });

    it("Adjusts prices correctly when setting base lengths to different values", async () => {
      const newRootLength = 0;
      const newSubdomainLength = 5;

      await zns.priceOracle.connect(deployer).setBaseLengths(newRootLength, newSubdomainLength);

      const domain = "wilder";

      const expectedRootPrice = await getPrice(domain, zns.priceOracle, true);
      const rootPrice = await zns.priceOracle.getPrice(domain, true);
      expect(rootPrice).to.eq(expectedRootPrice);

      const expectedSubdomainPrice = await getPrice(domain, zns.priceOracle, false);
      const subdomainPrice = await zns.priceOracle.getPrice(domain, false);
      expect(subdomainPrice).to.eq(expectedSubdomainPrice);

      expect(rootPrice).to.not.eq(subdomainPrice);
    });
  });

  describe("setZNSRegistrar", () => {
    it("Allows an authorized user to modify the registrar address", async () => {
      await zns.priceOracle.connect(deployer).setZNSRegistrar(updatedMockRegistrar.address);

      const newAddress = await zns.priceOracle.znsRegistrar();
      expect(newAddress).to.eq(updatedMockRegistrar.address);
    });

    it("Disallows an authorized user to modify the registrar address", async () => {
      const tx = zns.priceOracle.connect(user).setZNSRegistrar(updatedMockRegistrar.address);

      await expect(tx).to.be.revertedWith("ZNS: Not authorized");
    });

    it("Revokes authorized status from the old registrar when updated", async () => {
      await zns.priceOracle.connect(deployer).setZNSRegistrar(updatedMockRegistrar.address);

      const isOldAuthorized = await zns.priceOracle.isAuthorized(mockRegistrar.address);
      const isNewAuthorized = await zns.priceOracle.isAuthorized(updatedMockRegistrar.address);

      expect(isOldAuthorized).to.be.false;
      expect(isNewAuthorized).to.be.true;
    });
  });

  describe("Events", () => {
    it("Emits BasePriceSet", async () => {
      const newMaxPrice = parseEther("0.7");

      const tx = zns.priceOracle.connect(deployer).setMaxPrice(newMaxPrice, true);
      await expect(tx).to.emit(zns.priceOracle, "BasePriceSet").withArgs(newMaxPrice, true);
    });

    it("Emits PriceMultiplierSet", async () => {
      const newMultiplier = BigNumber.from("350");

      const tx = zns.priceOracle.connect(deployer).setPriceMultiplier(newMultiplier);
      await expect(tx).to.emit(zns.priceOracle, "PriceMultiplierSet").withArgs(newMultiplier);
    });

    it("Emits BaseLengthSet", async () => {
      const newLength = 5;

      const tx = zns.priceOracle.connect(deployer).setBaseLength(newLength, true);
      await expect(tx).to.emit(zns.priceOracle, "BaseLengthSet").withArgs(newLength, true);
    });
    it("Emits BaseLengthsSet", async () => {
      const newLength = 5;

      const tx = zns.priceOracle.connect(deployer).setBaseLengths(newLength, newLength);
      await expect(tx).to.emit(zns.priceOracle, "BaseLengthsSet").withArgs(newLength, newLength);
    });

    it("Emits ZNSRegistrarSet", async () => {
      const tx = zns.priceOracle.connect(deployer).setZNSRegistrar(updatedMockRegistrar.address);
      await expect(tx).to.emit(zns.priceOracle, "ZNSRegistrarSet").withArgs(updatedMockRegistrar.address);
    });
  });
});