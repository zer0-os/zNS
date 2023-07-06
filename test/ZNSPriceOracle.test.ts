import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, ethers } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ZNSContracts } from "./helpers/types";
import { deployZNS, getPrice, validateUpgrade } from "./helpers";
import { decimalsDefault, priceConfigDefault, registrationFeePercDefault } from "./helpers/constants";
import {
  MULTIPLIER_BELOW_MIN_ERR,
  NO_ZERO_MULTIPLIER_ERR,
  NO_ZERO_PRECISION_MULTIPLIER_ERR,
  getAccessRevertMsg,
} from "./helpers/errors";
import { ADMIN_ROLE, GOVERNOR_ROLE } from "./helpers/access";
import { ZNSPriceOracleUpgradeMock__factory, ZNSPriceOracle__factory } from "../typechain";

require("@nomicfoundation/hardhat-chai-matchers");


describe("ZNSPriceOracle", () => {
  let deployer : SignerWithAddress;
  let user : SignerWithAddress;
  let admin : SignerWithAddress;
  let randomAcc : SignerWithAddress;

  let zns : ZNSContracts;

  const defaultDomain = "wilder";

  beforeEach(async () => {
    [
      deployer,
      user,
      admin,
      randomAcc,
    ] = await hre.ethers.getSigners();

    zns = await deployZNS({
      deployer,
      governorAddresses: [deployer.address],
      adminAddresses: [admin.address],
    });
  });

  it("Confirms values were initially set correctly", async () => {
    const valueCalls = [
      zns.priceOracle.feePercentage(),
      zns.priceOracle.rootDomainPriceConfig(),
    ];

    const [
      feePercentageFromSC,
      priceConfigFromSC,
    ] = await Promise.all(valueCalls);

    const priceConfigArr = Object.values(priceConfigDefault);

    priceConfigArr.forEach(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      (val, idx) => expect(val).to.eq(priceConfigFromSC[idx])
    );

    expect(feePercentageFromSC).to.eq(registrationFeePercDefault);
  });

  describe("#getPrice", async () => {
    it("Returns 0 price for a root name with no length", async () => {
      const {
        totalPrice,
        domainPrice,
        fee,
      } = await zns.priceOracle.getPrice("");
      expect(totalPrice).to.eq(0);
      expect(domainPrice).to.eq(0);
      expect(fee).to.eq(0);
    });

    it("Returns the base price for domains that are equal to the base length", async () => {
      // Using the default length of 3
      const domain = "eth";
      const params = await zns.priceOracle.rootDomainPriceConfig();

      const {
        domainPrice,
      } = await zns.priceOracle.getPrice(domain);
      expect(domainPrice).to.eq(params.maxPrice);
    });

    it("Returns the base price for domains that are less than the base length", async () => {
      const domainA = "et";
      const domainB = "e";
      const params = await zns.priceOracle.rootDomainPriceConfig();

      let { domainPrice } = await zns.priceOracle.getPrice(domainA);
      expect(domainPrice).to.eq(params.maxPrice);

      ({ domainPrice } = await zns.priceOracle.getPrice(domainB));
      expect(domainPrice).to.eq(params.maxPrice);
    });

    it("Returns expected prices for a domain greater than the base length", async () => {
      // create a constant string with 22 letters
      const domainOne = "abcdefghijklmnopqrstuv";
      const domainTwo = "akkasddaasdas";

      // these values have been calced separately to validate
      // that both forumlas: SC + helper are correct
      // this value has been calces with the default priceConfig
      const domainOneRefValue = BigNumber.from("181810000000000000000");
      const domainTwoRefValue = BigNumber.from("307690000000000000000");

      const domainOneExpPrice = await getPrice(domainOne, zns.priceOracle);
      const domainTwoExpPrice = await getPrice(domainTwo, zns.priceOracle);

      const { domainPrice: domainOnePriceSC } = await zns.priceOracle.getPrice(domainOne);
      const { domainPrice: domainTwoPriceSC } = await zns.priceOracle.getPrice(domainTwo);

      expect(domainOnePriceSC).to.eq(domainOneRefValue);
      expect(domainOnePriceSC).to.eq(domainOneExpPrice);

      expect(domainTwoPriceSC).to.eq(domainTwoRefValue);
      expect(domainTwoPriceSC).to.eq(domainTwoExpPrice);
    });

    it("Returns a price even if the domain name is very long", async () => {
      // 255 length
      const domain = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstu";

      const expectedPrice = await getPrice(domain, zns.priceOracle);
      const { domainPrice } = await zns.priceOracle.getPrice(domain);

      expect(domainPrice).to.eq(expectedPrice);
    });

    it("Returns a price for multiple lengths when the multiplier is min value", async () => {
      const { baseLength } = await zns.priceOracle.rootDomainPriceConfig();

      const minMultiplier = baseLength.add(1);
      await zns.priceOracle.setPriceMultiplier(minMultiplier);

      // Any value less than base length is always base price, so we only check
      // domains that are greater than base length + 1
      const short = "wild";
      const medium = "wilderworld";
      const long = "wilderworld.beasts.pets.nfts.cats.calico.steve";

      const expectedShortPrice = await getPrice(short, zns.priceOracle);
      const { domainPrice: shortPrice } = await zns.priceOracle.getPrice(short);
      expect(expectedShortPrice).to.eq(shortPrice);

      const expectedMediumPrice = await getPrice(medium, zns.priceOracle);
      const { domainPrice: mediumPrice } = await zns.priceOracle.getPrice(medium);
      expect(expectedMediumPrice).to.eq(mediumPrice);

      const expectedLongPrice = await getPrice(long, zns.priceOracle);
      const { domainPrice: longPrice } = await zns.priceOracle.getPrice(long);
      expect(expectedLongPrice).to.eq(longPrice);
    });

    it("Returns a price for multiple lengths when the multiplier is a very large value", async () => {
      const newMultiplier = BigNumber.from("10000000");
      await zns.priceOracle.setPriceMultiplier(newMultiplier);

      // Any value less than base length is always base price, so we only check
      // domains that are greater than base length + 1
      const short = "wild";
      const medium = "wilderworld";
      const long = "wilderworld.beasts.pets.nfts.cats.calico.steve";

      const expectedShortPrice = await getPrice(short, zns.priceOracle);
      const { domainPrice: shortPrice } = await zns.priceOracle.getPrice(short);
      expect(expectedShortPrice).to.eq(shortPrice);

      const expectedMediumPrice = await getPrice(medium, zns.priceOracle);
      const { domainPrice: mediumPrice } = await zns.priceOracle.getPrice(medium);
      expect(expectedMediumPrice).to.eq(mediumPrice);

      const expectedLongPrice = await getPrice(long, zns.priceOracle);
      const { domainPrice: longPrice } = await zns.priceOracle.getPrice(long);
      expect(expectedLongPrice).to.eq(longPrice);
    });

    it("Prices Special Characters Accurately", async () => {
      const domainSpecialCharacterSet1 = "±ƒc¢Ãv";
      const domainSpecialCharacterSet2 = "œ柸þ€§ﾪ";
      const domainWithoutSpecials = "abcdef";
      const expectedPrice = await getPrice(domainWithoutSpecials, zns.priceOracle);
      let { domainPrice } = await zns.priceOracle.getPrice(domainSpecialCharacterSet1);
      expect(domainPrice).to.eq(expectedPrice);

      ({ domainPrice } = await zns.priceOracle.getPrice(domainSpecialCharacterSet2));
      expect(domainPrice).to.eq(expectedPrice);
    });

    it("Can Price Names Longer Than 255 Characters", async () => {
      // 261 length
      const domain = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
      "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
      "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
      "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
      "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
      "a";
      const expectedPrice = await getPrice(domain, zns.priceOracle);
      const { domainPrice } = await zns.priceOracle.getPrice(domain);
      expect(domainPrice).to.eq(expectedPrice);
    });
  });

  describe("#setMaxPrice", () => {
    it("Allows an authorized user to set the max price", async () => {
      const newMaxPrice = parseEther("0.7");

      await zns.priceOracle.connect(admin).setMaxPrice(newMaxPrice);

      const params = await zns.priceOracle.rootDomainPriceConfig();
      expect(params.maxPrice).to.eq(newMaxPrice);
    });

    it("Disallows an unauthorized user to set the max price", async () => {
      const newMaxPrice = parseEther("0.7");

      const tx = zns.priceOracle.connect(user).setMaxPrice(newMaxPrice);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });

    it("Allows setting the price to zero", async () => {
      const newMaxPrice = BigNumber.from("0");

      await zns.priceOracle.connect(deployer).setMaxPrice(newMaxPrice);
      const params = await zns.priceOracle.rootDomainPriceConfig();

      expect(params.maxPrice).to.eq(newMaxPrice);
    });

    it("Correctly sets the root max price", async () => {
      const newMaxPrice = parseEther("0.5");
      await zns.priceOracle.connect(deployer).setMaxPrice(newMaxPrice);

      const params = await zns.priceOracle.rootDomainPriceConfig();
      expect(params.maxPrice).to.eq(newMaxPrice);
    });

    it("Causes any length domain to have a price of 0 if the maxPrice is 0", async () => {
      const newMaxPrice = BigNumber.from("0");

      await zns.priceOracle.connect(deployer).setMaxPrice(newMaxPrice);

      const shortDomain = "a";
      const longDomain = "abcdefghijklmnopqrstuvwxyz";

      const { domainPrice: shortPrice } = await zns.priceOracle.getPrice(shortDomain);
      const { domainPrice: longPrice } = await zns.priceOracle.getPrice(longDomain);

      expect(shortPrice).to.eq(BigNumber.from("0"));
      expect(longPrice).to.eq(BigNumber.from("0"));
    });

    it("The price of a domain is modified relatively when the basePrice is changed", async () => {
      const newMaxPrice = parseEther("0.1");

      const expectedPriceBefore = await getPrice(defaultDomain, zns.priceOracle);
      const { domainPrice: priceBefore } = await zns.priceOracle.getPrice(defaultDomain);

      expect(expectedPriceBefore).to.eq(priceBefore);

      await zns.priceOracle.connect(deployer).setMaxPrice(newMaxPrice);

      const expectedPriceAfter = await getPrice(defaultDomain, zns.priceOracle);
      const { domainPrice: priceAfter } = await zns.priceOracle.getPrice(defaultDomain);

      expect(expectedPriceAfter).to.eq(priceAfter);
      expect(expectedPriceAfter).to.be.lt(expectedPriceBefore);
      expect(priceAfter).to.be.lt(priceBefore);
    });
  });

  describe("#setMinPrice", async () => {
    it("Allows an authorized user to set the min price", async () => {
      const newMinPrice = parseEther("0.1");

      await zns.priceOracle.connect(admin).setMinPrice(newMinPrice);

      const params = await zns.priceOracle.rootDomainPriceConfig();
      expect(params.minPrice).to.eq(newMinPrice);
    });

    it("Disallows an unauthorized user from setting the min price", async () => {
      const newMinPrice = parseEther("0.1");

      const tx = zns.priceOracle.connect(user).setMinPrice(newMinPrice);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });

    it("Allows setting to zero", async () => {
      const zeroPrice = BigNumber.from("0");

      await zns.priceOracle.connect(deployer).setMinPrice(zeroPrice);
      const params = await zns.priceOracle.rootDomainPriceConfig();

      expect(params.minPrice).to.eq(zeroPrice);
    });

    it("Successfully sets the min price correctly", async () => {
      const newMinPrice = parseEther("0.1");
      await zns.priceOracle.connect(deployer).setMinPrice(newMinPrice);

      const params = await zns.priceOracle.rootDomainPriceConfig();
      expect(params.minPrice).to.eq(newMinPrice);
    });

    it("Causes any domain beyond the `maxLength` to always return `minPrice`", async () => {
      // All domains longer than 15 characters are the same price
      await zns.priceOracle.connect(deployer).setMaxLength("15");

      const minPrice = parseEther("50");
      await zns.priceOracle.connect(deployer).setMinPrice(minPrice);

      // 16 characters
      const short = "abcdefghijklmnop";
      // 30 characters
      const medium = "abcdefghijklmnoabcdefghijklmno";
      // 60 characters
      const long = "abcdefghijklmnoabcdefghijklmnoabcdefghijklmnoabcdefghijklmno";

      const priceCalls = [
        zns.priceOracle.getPrice(short),
        zns.priceOracle.getPrice(medium),
        zns.priceOracle.getPrice(long),
      ];

      const [
        shortPrice,
        mediumPrice,
        longPrice,
      ] = await Promise.all(priceCalls);

      expect(shortPrice.domainPrice).to.eq(minPrice);
      expect(mediumPrice.domainPrice).to.eq(minPrice);
      expect(longPrice.domainPrice).to.eq(minPrice);
    });
  });

  describe("#setPriceMultiplier", () => {
    it("Allows setting of a priceMultiplier that is >= baseLength + 1", async () => {
      const config = await zns.priceOracle.rootDomainPriceConfig();
      const newMultiplier = config.baseLength.add(1);

      const tx = zns.priceOracle.connect(deployer).setPriceMultiplier(newMultiplier);
      await expect(tx).to.emit(zns.priceOracle, "PriceMultiplierSet").withArgs(newMultiplier);
    });

    it("Fails when setting priceMultiplier that is < baseLength + 1", async () => {
      const config = await zns.priceOracle.rootDomainPriceConfig();
      const newMultiplier = config.baseLength.sub(1);

      const tx = zns.priceOracle.connect(deployer).setPriceMultiplier(newMultiplier);
      await expect(tx).to.be.revertedWith(MULTIPLIER_BELOW_MIN_ERR);
    });

    it("Fails when setting priceMultiplier that is 0", async () => {
      const newMultiplier = BigNumber.from(0);

      const tx = zns.priceOracle.connect(deployer).setPriceMultiplier(newMultiplier);
      await expect(tx).to.be.revertedWith(NO_ZERO_MULTIPLIER_ERR);
    });

    it("Updates the multiplier automatically if setting a baseLength that would make it invalid", async () => {
      const oldMultiplier = (await zns.priceOracle.rootDomainPriceConfig()).priceMultiplier;

      // Setting the baseLength to the same value as the multiplier would invalidate the function,
      // because the multiplier must always be at least baseLength + 1, so the guard for this
      // should automatically update the multiplier as well
      await zns.priceOracle.connect(deployer).setBaseLength(oldMultiplier);

      const newMultiplier = (await zns.priceOracle.rootDomainPriceConfig()).priceMultiplier;

      expect(newMultiplier).to.eq(oldMultiplier.add(1));
    });

    // TODO ora: decide what to do with this one. unblock if needed
    it("Doesn't create price spikes with any valid combination of values", async () => {
      // Start by expanding the search space to allow for domains that are up to 1000 characters
      await zns.priceOracle.connect(deployer).setMaxLength(BigNumber.from("1000"));

      const promises = [];
      let config = await zns.priceOracle.rootDomainPriceConfig();
      let domain = "a";

      // baseLength = 0 is a special case
      await zns.priceOracle.connect(deployer).setBaseLength(0);
      const zeroPriceTuple = await zns.priceOracle.getPrice(domain);
      expect(zeroPriceTuple.domainPrice).to.eq(config.maxPrice);

      let outer = 1;
      let inner = outer;
      // Long running loops here to iterate all the variations for baseLength and
      while(config.maxLength.gt(outer)) {
        // Reset "domain" to a single character each outer loop
        domain = "a";

        await zns.priceOracle.connect(deployer).setBaseLength(outer);
        config = await zns.priceOracle.rootDomainPriceConfig();

        while (config.maxLength.gt(inner)) {
          const priceTx = zns.priceOracle.getPrice(domain);
          promises.push(priceTx);

          domain += "a";
          inner++;
        }
        outer++;
      }

      const priceTuples = await Promise.all(promises);
      let k = 0;
      while (k < priceTuples.length) {
        expect(priceTuples[k].domainPrice).to.be.lte(config.maxPrice);
        k++;
      }
    });

    it("Allows an authorized user to set the price multiplier", async () => {
      const newMultiplier = BigNumber.from("300");

      await zns.priceOracle.connect(deployer).setPriceMultiplier(newMultiplier);
      const params = await zns.priceOracle.rootDomainPriceConfig();
      expect(params.priceMultiplier).to.eq(newMultiplier);
    });

    it("Disallows an unauthorized user to set the price multiplier", async () => {
      const newMultiplier = BigNumber.from("300");

      const tx = zns.priceOracle.connect(user).setPriceMultiplier(newMultiplier);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });

    it("Succeeds when setting a value within the allowed range", async () => {
      // Valid range is 300 - 400
      const newMultiplier = BigNumber.from("350");

      await zns.priceOracle.connect(deployer).setPriceMultiplier(newMultiplier);

      const params = await zns.priceOracle.rootDomainPriceConfig();
      expect(params.priceMultiplier).to.eq(newMultiplier);
    });
  });

  describe("#setPrecisionMultiplier", () => {
    it("Allows an authorized user to set the precision multiplier", async () => {
      const newMultiplier = BigNumber.from("1");

      await zns.priceOracle.connect(admin).setPrecisionMultiplier(newMultiplier);

      const params = await zns.priceOracle.rootDomainPriceConfig();
      expect(params.precisionMultiplier).to.eq(newMultiplier);
    });

    it("Disallows an unauthorized user from setting the precision multiplier", async () => {
      const newMultiplier = BigNumber.from("1");


      const tx = zns.priceOracle.connect(user).setMinPrice(newMultiplier);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });

    it("Fails when setting to zero", async () => {
      const zeroMultiplier = BigNumber.from("0");

      const tx = zns.priceOracle.connect(deployer).setPrecisionMultiplier(zeroMultiplier);
      await expect(tx).to.be.revertedWith(NO_ZERO_PRECISION_MULTIPLIER_ERR);
    });

    it("Successfuly sets the precision multiplier when above 0", async () => {
      const newMultiplier = BigNumber.from("3");
      await zns.priceOracle.connect(deployer).setPrecisionMultiplier(newMultiplier);

      const params = await zns.priceOracle.rootDomainPriceConfig();
      expect(params.precisionMultiplier).to.eq(newMultiplier);
    });

    it("Verifies new prices are affected after changing the precision multiplier", async () => {
      const atIndex = 5;

      const before = await zns.priceOracle.getPrice(defaultDomain);
      const beforePriceString = before.domainPrice.toString();

      expect(beforePriceString.charAt(atIndex)).to.eq("0");

      // Default precision is 2 decimals, so increasing this value should represent in prices
      // as a non-zero nect decimal place
      const newPrecision = BigNumber.from(3);
      const newPrecisionMultiplier = BigNumber.from(10).pow(decimalsDefault.sub(newPrecision));

      await zns.priceOracle.setPrecisionMultiplier(newPrecisionMultiplier);

      const after = await zns.priceOracle.getPrice(defaultDomain);
      const afterPriceString = after.domainPrice.toString();

      expect(afterPriceString.charAt(atIndex)).to.not.eq("0");

    });
  });

  describe("#setBaseLength", () => {
    it("Allows an authorized user to set the base length", async () => {
      const newLength = 5;

      await zns.priceOracle.connect(deployer).setBaseLength(newLength);
      const params = await zns.priceOracle.rootDomainPriceConfig();

      expect(params.baseLength).to.eq(newLength);
    });

    it("Disallows an unauthorized user to set the base length", async () => {
      const newLength = 5;

      const tx = zns.priceOracle.connect(user).setBaseLength(newLength);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });

    it("Allows setting the base length to zero", async () => {
      const newLength = 0;

      await zns.priceOracle.connect(deployer).setBaseLength(newLength);
      const params = await zns.priceOracle.rootDomainPriceConfig();

      expect(params.baseLength).to.eq(newLength);
    });

    it("Always returns the minPrice if both baseLength and maxLength are their min values", async () => {
      // We use `baseLength == 0` to indicate a special event like a promo or discount and always
      // return `maxPrice` which can be set to whatever we need at the time.
      await zns.priceOracle.connect(deployer).setBaseLength(1);
      await zns.priceOracle.connect(deployer).setMaxLength(0);

      const short = "abc";
      const medium = "abcdefghijklmnop";
      const long = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz";

      const priceCalls = [
        zns.priceOracle.getPrice(short),
        zns.priceOracle.getPrice(medium),
        zns.priceOracle.getPrice(long),
      ];

      const [shortPrice, mediumPrice, longPrice] = await Promise.all(priceCalls);

      expect(shortPrice.domainPrice).to.eq(priceConfigDefault.minPrice);
      expect(mediumPrice.domainPrice).to.eq(priceConfigDefault.minPrice);
      expect(longPrice.domainPrice).to.eq(priceConfigDefault.minPrice);
    });

    it("Causes any length domain to cost the base fee when set to max length of 255", async () => {
      const newLength = 255;
      await zns.priceOracle.connect(deployer).setBaseLength(newLength);
      const params = await zns.priceOracle.rootDomainPriceConfig();

      const shortDomain = "a";
      const longDomain = "abcdefghijklmnopqrstuvwxyz";

      const { domainPrice: shortPrice } = await zns.priceOracle.getPrice(shortDomain);
      const { domainPrice: longPrice } = await zns.priceOracle.getPrice(longDomain);

      expect(shortPrice).to.eq(params.maxPrice);
      expect(longPrice).to.eq(params.maxPrice);
    });

    it("Causes prices to adjust correctly when length is increased", async () => {
      const newLength = 8;
      const paramsBefore = await zns.priceOracle.rootDomainPriceConfig();

      const expectedPriceBefore = await getPrice(defaultDomain, zns.priceOracle);
      const { domainPrice: priceBefore } = await zns.priceOracle.getPrice(defaultDomain);
      expect(priceBefore).to.eq(expectedPriceBefore);
      expect(priceBefore).to.not.eq(paramsBefore.maxPrice);

      await zns.priceOracle.connect(deployer).setBaseLength(newLength);

      const paramsAfter = await zns.priceOracle.rootDomainPriceConfig();

      const expectedPriceAfter = await getPrice(defaultDomain, zns.priceOracle);
      const { domainPrice: priceAfter } = await zns.priceOracle.getPrice(defaultDomain);
      expect(priceAfter).to.eq(expectedPriceAfter);
      expect(priceAfter).to.eq(paramsAfter.maxPrice);
    });

    it("Causes prices to adjust correctly when length is decreased", async () => {
      const length = 8;
      await zns.priceOracle.connect(deployer).setBaseLength(length);

      // const basePrice = await zns.priceOracle.rootDomainBasePrice();
      const paramsBefore = await zns.priceOracle.rootDomainPriceConfig();

      const expectedPriceBefore = await getPrice(defaultDomain, zns.priceOracle);
      const { domainPrice: priceBefore } = await zns.priceOracle.getPrice(defaultDomain);
      expect(priceBefore).to.eq(expectedPriceBefore);
      expect(priceBefore).to.eq(paramsBefore.maxPrice);

      const newLength = 3;
      await zns.priceOracle.connect(deployer).setBaseLength(newLength);

      const paramsAfter = await zns.priceOracle.rootDomainPriceConfig();

      const expectedPriceAfter = await getPrice(defaultDomain, zns.priceOracle);
      const { domainPrice: priceAfter } = await zns.priceOracle.getPrice(defaultDomain);
      expect(priceAfter).to.eq(expectedPriceAfter);
      expect(priceAfter).to.not.eq(paramsAfter.maxPrice);
    });

    it("Returns the maxPrice whenever the baseLength is 0", async () => {
      const newRootLength = 0;
      await zns.priceOracle.connect(deployer).setBaseLength(newRootLength);

      let config = await zns.priceOracle.rootDomainPriceConfig();
      let price = await zns.priceOracle.getPrice(defaultDomain);

      expect(config.maxPrice).to.eq(price.domainPrice);

      // Modify the max price
      await zns.priceOracle.connect(deployer).setMaxPrice(ethers.utils.parseEther("800"));

      config = await zns.priceOracle.rootDomainPriceConfig();
      price = await zns.priceOracle.getPrice(defaultDomain);

      expect(config.maxPrice).to.eq(price.domainPrice);
    });

    it("Adjusts prices correctly when setting base lengths to different values", async () => {
      const newRootLength = 0;
      await zns.priceOracle.connect(deployer).setBaseLength(newRootLength);

      const expectedRootPrice = await getPrice(defaultDomain, zns.priceOracle);
      const { domainPrice: rootPrice } = await zns.priceOracle.getPrice(defaultDomain);

      expect(rootPrice).to.eq(expectedRootPrice);
    });
  });

  describe("#setMaxLength", () => {
    it("Allows an authorized user to set the max length", async () => {
      const newLength = 5;

      await zns.priceOracle.connect(deployer).setMaxLength(newLength);
      const params = await zns.priceOracle.rootDomainPriceConfig();

      expect(params.maxLength).to.eq(newLength);
    });

    it("Disallows an unauthorized user to set the max length", async () => {
      const newLength = 5;

      const tx = zns.priceOracle.connect(user).setMaxLength(newLength);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });

    it("Allows setting the max length to zero", async () => {
      const newLength = 0;

      await zns.priceOracle.connect(deployer).setMaxLength(newLength);
      const params = await zns.priceOracle.rootDomainPriceConfig();

      expect(params.maxLength).to.eq(newLength);
    });

    it("Still returns prices for domains within baseLength if the maxLength is zero", async () => {
      const newLength = 0;

      await zns.priceOracle.connect(deployer).setMaxLength(newLength);

      // Default price config sets baseLength to 4
      const short = "a";
      const long = "abcd";
      const beyondBaseLength = "abcde";

      const priceCalls = [
        zns.priceOracle.getPrice(short),
        zns.priceOracle.getPrice(long),
        zns.priceOracle.getPrice(beyondBaseLength),
      ];

      const [shortPrice, longPrice, beyondPrice] = await Promise.all(priceCalls);

      expect(shortPrice.domainPrice).to.eq(priceConfigDefault.maxPrice);
      expect(longPrice.domainPrice).to.eq(priceConfigDefault.maxPrice);
      expect(beyondPrice.domainPrice).to.eq(priceConfigDefault.minPrice);
    });
  });

  describe("#setRegistrationFeePercentage", () => {
    it("Successfully sets the fee percentage", async () => {
      const newFeePerc = BigNumber.from(222);
      await zns.priceOracle.setRegistrationFeePercentage(newFeePerc);
      const feeFromSC = await zns.priceOracle.feePercentage();

      expect(feeFromSC).to.eq(newFeePerc);
    });

    it("Disallows an unauthorized user to set the fee percentage", async () => {
      const newFeePerc = BigNumber.from(222);
      const tx = zns.priceOracle.connect(user)
        .setRegistrationFeePercentage(newFeePerc);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });
  });

  describe("#getRegistrationFee", () => {
    it("Successfully gets the fee for a price", async () => {
      const stake = ethers.utils.parseEther("0.2");
      const fee = await zns.priceOracle.getRegistrationFee(stake);
      const expectedFee = stake.mul("222").div("10000");

      expect(fee).to.eq(expectedFee);
    });
  });

  describe("#setAccessController", () => {
    it("Successfully sets the access controller", async () => {
      const currentAccessController = await zns.priceOracle.getAccessController();
      expect(currentAccessController).to.not.eq(randomAcc.address);

      const tx = await zns.priceOracle.setAccessController(randomAcc.address);

      const newAccessController = await zns.priceOracle.getAccessController();
      expect(newAccessController).to.eq(randomAcc.address);

      await expect(tx).to.emit(zns.priceOracle, "AccessControllerSet").withArgs(randomAcc.address);
    });

    it("Disallows an unauthorized user to set the access controller", async () => {
      const tx = zns.priceOracle.connect(user).setAccessController(randomAcc.address);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });

    it("Disallows setting the access controller to the zero address", async () => {
      const tx = zns.priceOracle.connect(deployer).setAccessController(ethers.constants.AddressZero);
      await expect(tx).to.be.revertedWith(
        "AC: _accessController is 0x0 address"
      );
    });
  });

  describe("Events", () => {
    it("Emits MaxPriceSet", async () => {
      const newMaxPrice = parseEther("0.7");

      const tx = zns.priceOracle.connect(deployer).setMaxPrice(newMaxPrice);
      await expect(tx).to.emit(zns.priceOracle, "MaxPriceSet").withArgs(newMaxPrice);
    });

    it("Emits PriceMultiplierSet", async () => {
      const newMultiplier = BigNumber.from("350");

      const tx = zns.priceOracle.connect(deployer).setPriceMultiplier(newMultiplier);
      await expect(tx).to.emit(zns.priceOracle, "PriceMultiplierSet").withArgs(newMultiplier);
    });

    it("Emits BaseLengthSet", async () => {
      const newLength = 5;

      const tx = zns.priceOracle.connect(deployer).setBaseLength(newLength);
      await expect(tx).to.emit(zns.priceOracle, "BaseLengthSet").withArgs(newLength);
    });
  });

  describe("UUPS", () => {
    it("Allows an authorized user to upgrade the contract", async () => {
      // PriceOracle to upgrade to
      const factory = new ZNSPriceOracle__factory(deployer);
      const newPriceOracle = await factory.deploy();
      await newPriceOracle.deployed();

      // Confirm the deployer is a governor, as set in `deployZNS` helper
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const tx = zns.priceOracle.connect(deployer).upgradeTo(newPriceOracle.address);
      await expect(tx).to.not.be.reverted;
    });

    it("Fails to upgrade if the caller is not authorized", async () => {
      // PriceOracle to upgrade to
      const factory = new ZNSPriceOracleUpgradeMock__factory(deployer);
      const newPriceOracle = await factory.deploy();
      await newPriceOracle.deployed();

      // Confirm the account is not a governor
      await expect(zns.accessController.checkGovernor(randomAcc.address)).to.be.reverted;

      const tx = zns.priceOracle.connect(randomAcc).upgradeTo(newPriceOracle.address);

      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(randomAcc.address, GOVERNOR_ROLE)
      );
    });

    it("Verifies that variable values are not changed in the upgrade process", async () => {
      const factory = new ZNSPriceOracleUpgradeMock__factory(deployer);
      const newPriceOracle = await factory.deploy();
      await newPriceOracle.deployed();

      await zns.priceOracle.connect(deployer).setBaseLength("7");
      await zns.priceOracle.connect(deployer).setPriceMultiplier("310");
      await zns.priceOracle.connect(deployer).setMaxPrice(ethers.utils.parseEther("0.7124"));

      const contractCalls = [
        zns.priceOracle.rootDomainPriceConfig(),
        zns.priceOracle.feePercentage(),
        zns.priceOracle.getPrice("wilder"),
      ];

      await validateUpgrade(deployer, zns.priceOracle, newPriceOracle, factory, contractCalls);
    });
  });
});
