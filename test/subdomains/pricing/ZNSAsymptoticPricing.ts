import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, ethers } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ZNSContracts } from "../../helpers/types";
import {
  deployZNS,
  calcAsymptoticPrice,
  NOT_AUTHORIZED_REG_WIRED_ERR,
  precisionMultiDefault,
  PRICING_CONFIG_ERR,
  PRICING_NO_ZERO_PRECISION_MULTIPLIER_ERR, REGISTRAR_ROLE, PaymentType,
} from "../../helpers";
import { decimalsDefault, priceConfigDefault, registrationFeePercDefault } from "../../helpers/constants";
import {
  getAccessRevertMsg,
} from "../../helpers/errors";
import { ADMIN_ROLE } from "../../helpers/access";
import { registrationWithSetup } from "../../helpers/register-setup";

require("@nomicfoundation/hardhat-chai-matchers");


describe("ZNSAsymptoticPricing", () => {
  let deployer : SignerWithAddress;
  let user : SignerWithAddress;
  let admin : SignerWithAddress;
  let randomAcc : SignerWithAddress;
  let mockRegistrar : SignerWithAddress;

  let zns : ZNSContracts;
  let domainHash : string;

  const defaultDomain = "wilder";

  beforeEach(async () => {
    [
      deployer,
      user,
      admin,
      randomAcc,
      mockRegistrar,
    ] = await hre.ethers.getSigners();

    zns = await deployZNS({
      deployer,
      governorAddresses: [deployer.address],
      adminAddresses: [admin.address],
    });

    await zns.zeroToken.connect(user).approve(zns.treasury.address, ethers.constants.MaxUint256);
    await zns.zeroToken.mint(user.address, priceConfigDefault.maxPrice);

    const fullConfig = {
      distrConfig: {
        paymentConfig: {
          paymentType: PaymentType.DIRECT,
          paymentToken: zns.zeroToken.address,
          beneficiary: user.address,
        },
        pricingContract: zns.asPricing.address,
        accessType: 1,
      },
      priceConfig: priceConfigDefault,
    };

    domainHash = await registrationWithSetup({
      zns,
      user,
      domainLabel: "testdomain",
      fullConfig,
      isRootDomain: true,
    });
  });

  it("Confirms values were initially set correctly", async () => {
    const valueCalls = [
      zns.asPricing.priceConfigs(domainHash),
    ];

    const [
      priceConfigFromSC,
    ] = await Promise.all(valueCalls);

    const priceConfigArr = Object.values(priceConfigDefault);

    priceConfigArr.forEach(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      (val, idx) => expect(val).to.eq(priceConfigFromSC[idx])
    );
  });

  describe("#getPrice", async () => {
    it("Returns 0 price for a root name with no length", async () => {
      const {
        price,
        stakeFee,
      } = await zns.asPricing.getPriceAndFee(domainHash, "");
      expect(price).to.eq(0);
      expect(stakeFee).to.eq(0);
    });

    it("Returns the base price for domains that are equal to the base length", async () => {
      // Using the default length of 3
      const domain = "eth";
      const params = await zns.asPricing.priceConfigs(domainHash);

      const domainPrice = await zns.asPricing.getPrice(domainHash, domain);
      expect(domainPrice).to.eq(params.maxPrice);
    });

    it("Returns the base price for domains that are less than the base length", async () => {
      const domainA = "et";
      const domainB = "e";
      const params = await zns.asPricing.priceConfigs(domainHash);

      let domainPrice = await zns.asPricing.getPrice(domainHash, domainA);
      expect(domainPrice).to.eq(params.maxPrice);

      (domainPrice = await zns.asPricing.getPrice(domainHash, domainB));
      expect(domainPrice).to.eq(params.maxPrice);
    });

    it("Returns expected prices for a domain greater than the base length", async () => {
      // create a constant string with 22 letters
      const domainOne = "abcdefghijklmnopqrstuv";
      const domainTwo = "akkasddaasdas";

      // these values have been calced separately to validate
      // that both forumlas: SC + helper are correct
      // this value has been calces with the default priceConfig
      const domainOneRefValue = BigNumber.from("4545450000000000000000");
      const domainTwoRefValue = BigNumber.from("7692300000000000000000");

      const domainOneExpPrice = await calcAsymptoticPrice(domainOne, priceConfigDefault);
      const domainTwoExpPrice = await calcAsymptoticPrice(domainTwo, priceConfigDefault);

      const domainOnePriceSC = await zns.asPricing.getPrice(domainHash, domainOne);
      const domainTwoPriceSC = await zns.asPricing.getPrice(domainHash, domainTwo);

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

      const expectedPrice = await calcAsymptoticPrice(domain, priceConfigDefault);
      const domainPrice = await zns.asPricing.getPrice(domainHash, domain);

      expect(domainPrice).to.eq(expectedPrice);
    });

    it("Returns a price for multiple lengths", async () => {
      // Any value less than base length is always base price, so we only check
      // domains that are greater than base length + 1
      const short = "wild";
      const medium = "wilderworld";
      const long = "wilderworld.beasts.pets.nfts.cats.calico.steve";

      const expectedShortPrice = await calcAsymptoticPrice(short, priceConfigDefault);
      const shortPrice = await zns.asPricing.getPrice(domainHash, short);
      expect(expectedShortPrice).to.eq(shortPrice);

      const expectedMediumPrice = await calcAsymptoticPrice(medium, priceConfigDefault);
      const mediumPrice = await zns.asPricing.getPrice(domainHash, medium);
      expect(expectedMediumPrice).to.eq(mediumPrice);

      const expectedLongPrice = await calcAsymptoticPrice(long, priceConfigDefault);
      const longPrice = await zns.asPricing.getPrice(domainHash, long);
      expect(expectedLongPrice).to.eq(longPrice);
    });

    it("Prices Special Characters Accurately", async () => {
      const domainSpecialCharacterSet1 = "±ƒc¢Ãv";
      const domainSpecialCharacterSet2 = "œ柸þ€§ﾪ";
      const domainWithoutSpecials = "abcdef";
      const expectedPrice = await calcAsymptoticPrice(domainWithoutSpecials, priceConfigDefault);
      let domainPrice = await zns.asPricing.getPrice(domainHash, domainSpecialCharacterSet1);
      expect(domainPrice).to.eq(expectedPrice);

      (domainPrice = await zns.asPricing.getPrice(domainHash, domainSpecialCharacterSet2));
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
      const expectedPrice = await calcAsymptoticPrice(domain, priceConfigDefault);
      const domainPrice = await zns.asPricing.getPrice(domainHash, domain);
      expect(domainPrice).to.eq(expectedPrice);
    });

    // TODO ora: decide what to do with this one. unblock if needed
    // eslint-disable-next-line max-len
    it.skip("Doesn't create price spikes with any valid combination of values (SLOW TEST, ONLY RUN LOCALLY)", async () => {
      // Start by expanding the search space to allow for domains that are up to 1000 characters
      await zns.asPricing.connect(user).setMaxLength(domainHash, BigNumber.from("1000"));

      const promises = [];
      let config = await zns.asPricing.priceConfigs(domainHash);
      let domain = "a";

      // baseLength = 0 is a special case
      await zns.asPricing.connect(user).setBaseLength(domainHash, 0);
      const domainPrice = await zns.asPricing.getPrice(domainHash, domain);
      expect(domainPrice).to.eq(config.maxPrice);

      let outer = 1;
      let inner = outer;
      // Long running loops here to iterate all the variations for baseLength and
      while(config.maxLength.gt(outer)) {
        // Reset "domain" to a single character each outer loop
        domain = "a";

        await zns.asPricing.connect(user).setBaseLength(domainHash, outer);
        config = await zns.asPricing.priceConfigs(domainHash);

        while (config.maxLength.gt(inner)) {
          const priceTx = zns.asPricing.getPrice(domainHash, domain);
          promises.push(priceTx);

          domain += "a";
          inner++;
        }
        outer++;
      }

      const prices = await Promise.all(promises);
      let k = 0;
      while (k < prices.length) {
        expect(prices[k]).to.be.lte(config.maxPrice);
        k++;
      }
    });
  });

  describe("#setPriceConfig", () => {
    it("Should revert if setting a price config where spike is created at maxLength", async () => {
      const newConfig = {
        baseLength: BigNumber.from("6"),
        maxLength: BigNumber.from("20"),
        maxPrice: parseEther("10"),
        minPrice: parseEther("6"),
        precisionMultiplier: precisionMultiDefault,
        feePercentage: registrationFeePercDefault,
      };

      await expect(
        zns.asPricing.connect(user).setPriceConfig(domainHash, newConfig)
      ).to.be.revertedWith(PRICING_CONFIG_ERR);
    });
  });

  describe("#setMaxPrice", () => {
    it("Allows an authorized user to set the max price", async () => {
      const newMaxPrice = priceConfigDefault.maxPrice.add(parseEther("10"));

      await zns.asPricing.connect(user).setMaxPrice(domainHash, newMaxPrice);

      const params = await zns.asPricing.priceConfigs(domainHash);
      expect(params.maxPrice).to.eq(newMaxPrice);
    });

    it("Disallows an unauthorized user to set the max price", async () => {
      const newMaxPrice = parseEther("0.7");

      const tx = zns.asPricing.connect(admin).setMaxPrice(domainHash, newMaxPrice);
      await expect(tx).to.be.revertedWith(NOT_AUTHORIZED_REG_WIRED_ERR);
    });

    it("Allows setting the max price to zero", async () => {
      const newMaxPrice = BigNumber.from("0");

      await zns.asPricing.connect(user).setMaxPrice(domainHash, newMaxPrice);
      const params = await zns.asPricing.priceConfigs(domainHash);

      expect(params.maxPrice).to.eq(newMaxPrice);
    });

    it("Correctly sets max price", async () => {
      const newMaxPrice = priceConfigDefault.maxPrice.add(parseEther("553"));
      await zns.asPricing.connect(user).setMaxPrice(domainHash, newMaxPrice);

      const params = await zns.asPricing.priceConfigs(domainHash);
      expect(params.maxPrice).to.eq(newMaxPrice);
    });

    it("Should revert when setting maxPrice that causes a spike at maxLength", async () => {
      const newMaxPrice = parseEther("500");
      await expect(
        zns.asPricing.connect(user).setMaxPrice(domainHash, newMaxPrice)
      ).to.be.revertedWith(PRICING_CONFIG_ERR);
    });

    it("Causes any length domain to have a price of 0 if the maxPrice is 0", async () => {
      const newMaxPrice = BigNumber.from("0");

      await zns.asPricing.connect(user).setMaxPrice(domainHash, newMaxPrice);

      const shortDomain = "a";
      const longDomain = "abcdefghijklmnopqrstuvwxyz";

      const shortPrice = await zns.asPricing.getPrice(domainHash, shortDomain);
      const longPrice = await zns.asPricing.getPrice(domainHash, longDomain);

      expect(shortPrice).to.eq(BigNumber.from("0"));
      expect(longPrice).to.eq(BigNumber.from("0"));
    });

    it("The price of a domain is modified relatively when the basePrice is changed", async () => {
      const newMaxPrice = priceConfigDefault.maxPrice.add(parseEther("9"));

      const expectedPriceBefore = await calcAsymptoticPrice(defaultDomain, priceConfigDefault);
      const priceBefore= await zns.asPricing.getPrice(domainHash, defaultDomain);

      expect(expectedPriceBefore).to.eq(priceBefore);

      await zns.asPricing.connect(user).setMaxPrice(domainHash, newMaxPrice);

      const newConfig = {
        ...priceConfigDefault,
        maxPrice: newMaxPrice,
      };

      const expectedPriceAfter = await calcAsymptoticPrice(defaultDomain, newConfig);
      const priceAfter = await zns.asPricing.getPrice(domainHash, defaultDomain);

      expect(expectedPriceAfter).to.eq(priceAfter);
      expect(expectedPriceAfter).to.be.gt(expectedPriceBefore);
      expect(priceAfter).to.be.gt(priceBefore);
    });
  });

  describe("#setMinPrice", async () => {
    it("Allows an authorized user to set the min price", async () => {
      const newMinPrice = parseEther("0.1");

      await zns.asPricing.connect(user).setMinPrice(domainHash, newMinPrice);

      const params = await zns.asPricing.priceConfigs(domainHash);
      expect(params.minPrice).to.eq(newMinPrice);
    });

    it("Disallows an unauthorized user from setting the min price", async () => {
      const newMinPrice = parseEther("0.1");

      const tx = zns.asPricing.connect(admin).setMinPrice(domainHash, newMinPrice);
      await expect(tx).to.be.revertedWith(NOT_AUTHORIZED_REG_WIRED_ERR);
    });

    it("Allows setting to zero", async () => {
      const zeroPrice = BigNumber.from("0");

      await zns.asPricing.connect(user).setMinPrice(domainHash, zeroPrice);
      const params = await zns.asPricing.priceConfigs(domainHash);

      expect(params.minPrice).to.eq(zeroPrice);
    });

    it("Successfully sets the min price correctly", async () => {
      const newMinPrice = parseEther("0.1");
      await zns.asPricing.connect(user).setMinPrice(domainHash, newMinPrice);

      const params = await zns.asPricing.priceConfigs(domainHash);
      expect(params.minPrice).to.eq(newMinPrice);
    });

    it("Causes any domain beyond the `maxLength` to always return `minPrice`", async () => {
      // All domains longer than 15 characters are the same price
      await zns.asPricing.connect(user).setMaxLength(domainHash, "15");

      const minPrice = parseEther("50");
      await zns.asPricing.connect(user).setMinPrice(domainHash, minPrice);

      // 16 characters
      const short = "abcdefghijklmnop";
      // 30 characters
      const medium = "abcdefghijklmnoabcdefghijklmno";
      // 60 characters
      const long = "abcdefghijklmnoabcdefghijklmnoabcdefghijklmnoabcdefghijklmno";

      const priceCalls = [
        zns.asPricing.getPrice(domainHash, short),
        zns.asPricing.getPrice(domainHash, medium),
        zns.asPricing.getPrice(domainHash, long),
      ];

      const [
        shortPrice,
        mediumPrice,
        longPrice,
      ] = await Promise.all(priceCalls);

      expect(shortPrice).to.eq(minPrice);
      expect(mediumPrice).to.eq(minPrice);
      expect(longPrice).to.eq(minPrice);
    });

    it("Should revert when setting minPrice that causes a spike at maxLength", async () => {
      const newMinPrice = priceConfigDefault.minPrice.add(parseEther("231"));
      await expect(
        zns.asPricing.connect(user).setMinPrice(domainHash, newMinPrice)
      ).to.be.revertedWith(PRICING_CONFIG_ERR);
    });
  });

  describe("#setPrecisionMultiplier", () => {
    it("Allows an authorized user to set the precision multiplier", async () => {
      const newMultiplier = BigNumber.from("1");

      await zns.asPricing.connect(user).setPrecisionMultiplier(domainHash, newMultiplier);

      const params = await zns.asPricing.priceConfigs(domainHash);
      expect(params.precisionMultiplier).to.eq(newMultiplier);
    });

    it("Disallows an unauthorized user from setting the precision multiplier", async () => {
      const newMultiplier = BigNumber.from("1");


      const tx = zns.asPricing.connect(admin).setMinPrice(domainHash, newMultiplier);
      await expect(tx).to.be.revertedWith(NOT_AUTHORIZED_REG_WIRED_ERR);
    });

    it("Fails when setting to zero", async () => {
      const zeroMultiplier = BigNumber.from("0");

      const tx = zns.asPricing.connect(user).setPrecisionMultiplier(domainHash, zeroMultiplier);
      await expect(tx).to.be.revertedWith(PRICING_NO_ZERO_PRECISION_MULTIPLIER_ERR);
    });

    it("Successfuly sets the precision multiplier when above 0", async () => {
      const newMultiplier = BigNumber.from("3");
      await zns.asPricing.connect(user).setPrecisionMultiplier(domainHash, newMultiplier);

      const params = await zns.asPricing.priceConfigs(domainHash);
      expect(params.precisionMultiplier).to.eq(newMultiplier);
    });

    it("Verifies new prices are affected after changing the precision multiplier", async () => {
      const atIndex = 7;

      const before = await zns.asPricing.getPrice(domainHash, defaultDomain);
      const beforePriceString = before.toString();

      expect(beforePriceString.charAt(atIndex)).to.eq("0");

      // Default precision is 2 decimals, so increasing this value should represent in prices
      // as a non-zero nect decimal place
      const newPrecision = BigNumber.from(3);
      const newPrecisionMultiplier = BigNumber.from(10).pow(decimalsDefault.sub(newPrecision));

      await zns.asPricing.connect(user).setPrecisionMultiplier(domainHash, newPrecisionMultiplier);

      const after = await zns.asPricing.getPrice(domainHash, defaultDomain);
      const afterPriceString = after.toString();

      expect(afterPriceString.charAt(atIndex)).to.not.eq("0");

    });

    it("Should revert when setting precisionMultiplier higher than 10^18", async () => {
      const newMultiplier = parseEther("100");
      await expect(
        zns.asPricing.connect(user).setPrecisionMultiplier(domainHash, newMultiplier)
      ).to.be.revertedWith(
        "ZNSAsymptoticPricing: precisionMultiplier cannot be greater than 10^18"
      );
    });
  });

  describe("#setBaseLength", () => {
    it("Allows an authorized user to set the base length", async () => {
      const newLength = 5;

      await zns.asPricing.connect(user).setBaseLength(domainHash, newLength);
      const params = await zns.asPricing.priceConfigs(domainHash);

      expect(params.baseLength).to.eq(newLength);
    });

    it("Disallows an unauthorized user to set the base length", async () => {
      const newLength = 5;

      const tx = zns.asPricing.connect(admin).setBaseLength(domainHash, newLength);
      await expect(tx).to.be.revertedWith(NOT_AUTHORIZED_REG_WIRED_ERR);
    });

    it("Allows setting the base length to zero", async () => {
      const newLength = 0;

      await zns.asPricing.connect(user).setBaseLength(domainHash, newLength);
      const params = await zns.asPricing.priceConfigs(domainHash);

      expect(params.baseLength).to.eq(newLength);
    });

    it("Always returns the minPrice if both baseLength and maxLength are their min values", async () => {
      const newConfig = {
        baseLength: BigNumber.from(1),
        maxLength: BigNumber.from(1),
        maxPrice: BigNumber.from(100),
        minPrice: BigNumber.from(10),
        precisionMultiplier: precisionMultiDefault,
        feePercentage: registrationFeePercDefault,
      };

      // We use `baseLength == 0` to indicate a special event like a promo or discount and always
      // return `maxPrice` which can be set to whatever we need at the time.
      await zns.asPricing.connect(user).setPriceConfig(domainHash, newConfig);

      const short = "abc";
      const medium = "abcdefghijklmnop";
      const long = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz";

      const priceCalls = [
        zns.asPricing.getPrice(domainHash, short),
        zns.asPricing.getPrice(domainHash, medium),
        zns.asPricing.getPrice(domainHash, long),
      ];

      const [shortPrice, mediumPrice, longPrice] = await Promise.all(priceCalls);

      expect(shortPrice).to.eq(newConfig.minPrice);
      expect(mediumPrice).to.eq(newConfig.minPrice);
      expect(longPrice).to.eq(newConfig.minPrice);
    });

    it("Causes any length domain to cost the base fee when set to max length of 255", async () => {
      const newLength = 255;
      await zns.asPricing.connect(user).setBaseLength(domainHash, newLength);
      const params = await zns.asPricing.priceConfigs(domainHash);

      const shortDomain = "a";
      const longDomain = "abcdefghijklmnopqrstuvwxyz";

      const shortPrice = await zns.asPricing.getPrice(domainHash, shortDomain);
      const longPrice = await zns.asPricing.getPrice(domainHash, longDomain);

      expect(shortPrice).to.eq(params.maxPrice);
      expect(longPrice).to.eq(params.maxPrice);
    });

    it("Causes prices to adjust correctly when length is increased", async () => {
      const newLength = 8;
      const paramsBefore = await zns.asPricing.priceConfigs(domainHash);

      const expectedPriceBefore = await calcAsymptoticPrice(defaultDomain, priceConfigDefault);
      const priceBefore = await zns.asPricing.getPrice(domainHash, defaultDomain);
      expect(priceBefore).to.eq(expectedPriceBefore);
      expect(priceBefore).to.not.eq(paramsBefore.maxPrice);

      await zns.asPricing.connect(user).setBaseLength(domainHash, newLength);

      const paramsAfter = await zns.asPricing.priceConfigs(domainHash);

      const newConfig = {
        ...priceConfigDefault,
        baseLength: BigNumber.from(newLength),
      };

      const expectedPriceAfter = await calcAsymptoticPrice(defaultDomain, newConfig);
      const priceAfter = await zns.asPricing.getPrice(domainHash, defaultDomain);
      expect(priceAfter).to.eq(expectedPriceAfter);
      expect(priceAfter).to.eq(paramsAfter.maxPrice);
    });

    it("Causes prices to adjust correctly when length is decreased", async () => {
      const length = 8;
      await zns.asPricing.connect(user).setBaseLength(domainHash, length);

      const newConfig1 = {
        ...priceConfigDefault,
        baseLength: BigNumber.from(length),
      };

      const paramsBefore = await zns.asPricing.priceConfigs(domainHash);

      const expectedPriceBefore = await calcAsymptoticPrice(defaultDomain, newConfig1);
      const priceBefore = await zns.asPricing.getPrice(domainHash, defaultDomain);
      expect(priceBefore).to.eq(expectedPriceBefore);
      expect(priceBefore).to.eq(paramsBefore.maxPrice);

      const newLength = 5;
      await zns.asPricing.connect(user).setBaseLength(domainHash, newLength);

      const newConfig2 = {
        ...priceConfigDefault,
        baseLength: BigNumber.from(newLength),
      };

      const paramsAfter = await zns.asPricing.priceConfigs(domainHash);

      const expectedPriceAfter = await calcAsymptoticPrice(defaultDomain, newConfig2);
      const priceAfter = await zns.asPricing.getPrice(domainHash, defaultDomain);
      expect(priceAfter).to.eq(expectedPriceAfter);
      expect(priceAfter).to.not.eq(paramsAfter.maxPrice);
    });

    it("Returns the maxPrice whenever the baseLength is 0", async () => {
      const newRootLength = 0;
      await zns.asPricing.connect(user).setBaseLength(domainHash, newRootLength);

      let config = await zns.asPricing.priceConfigs(domainHash);
      let price = await zns.asPricing.getPrice(domainHash, defaultDomain);

      expect(config.maxPrice).to.eq(price);

      // Modify the max price
      await zns.asPricing.connect(user).setMaxPrice(
        domainHash,
        priceConfigDefault.maxPrice.add(15)
      );

      config = await zns.asPricing.priceConfigs(domainHash);
      price = await zns.asPricing.getPrice(domainHash, defaultDomain);

      expect(config.maxPrice).to.eq(price);
    });

    it("Adjusts prices correctly when setting base lengths to different values", async () => {
      const newRootLength = 0;
      await zns.asPricing.connect(user).setBaseLength(domainHash, newRootLength);
      const newConfig = {
        ...priceConfigDefault,
        baseLength: BigNumber.from(newRootLength),
      };

      const expectedRootPrice = await calcAsymptoticPrice(defaultDomain, newConfig);
      const rootPrice = await zns.asPricing.getPrice(domainHash, defaultDomain);

      expect(rootPrice).to.eq(expectedRootPrice);
    });

    it("Should revert when setting baseLength that causes a spike at maxLength", async () => {
      const newBaseLength = priceConfigDefault.baseLength.sub(1);
      await expect(
        zns.asPricing.connect(user).setBaseLength(domainHash, newBaseLength)
      ).to.be.revertedWith(PRICING_CONFIG_ERR);
    });
  });

  describe("#setMaxLength", () => {
    it("Allows an authorized user to set the max length", async () => {
      const newLength = 5;

      await zns.asPricing.connect(user).setMaxLength(domainHash, newLength);
      const params = await zns.asPricing.priceConfigs(domainHash);

      expect(params.maxLength).to.eq(newLength);
    });

    it("Disallows an unauthorized user to set the max length", async () => {
      const newLength = 5;

      const tx = zns.asPricing.connect(admin).setMaxLength(domainHash, newLength);
      await expect(tx).to.be.revertedWith(NOT_AUTHORIZED_REG_WIRED_ERR);
    });

    it("Allows setting the max length to zero", async () => {
      const newLength = 0;

      await zns.asPricing.connect(user).setMaxLength(domainHash, newLength);
      const params = await zns.asPricing.priceConfigs(domainHash);

      expect(params.maxLength).to.eq(newLength);
    });

    it("Still returns prices for domains within baseLength if the maxLength is zero", async () => {
      const newLength = 0;

      await zns.asPricing.connect(user).setMaxLength(domainHash, newLength);

      // Default price config sets baseLength to 4
      const short = "a";
      const long = "abcd";
      const beyondBaseLength = "abcde";

      const priceCalls = [
        zns.asPricing.getPrice(domainHash, short),
        zns.asPricing.getPrice(domainHash, long),
        zns.asPricing.getPrice(domainHash, beyondBaseLength),
      ];

      const [shortPrice, longPrice, beyondPrice] = await Promise.all(priceCalls);

      expect(shortPrice).to.eq(priceConfigDefault.maxPrice);
      expect(longPrice).to.eq(priceConfigDefault.maxPrice);
      expect(beyondPrice).to.eq(priceConfigDefault.minPrice);
    });

    it("Should revert when setting maxLength that causes a spike at maxLength", async () => {
      const newMaxLength = priceConfigDefault.maxLength.add(10);
      await expect(
        zns.asPricing.connect(user).setMaxLength(domainHash, newMaxLength)
      ).to.be.revertedWith(PRICING_CONFIG_ERR);
    });
  });

  describe("#setRegistrationFeePercentage", () => {
    it("Successfully sets the fee percentage", async () => {
      const newFeePerc = BigNumber.from(222);
      await zns.asPricing.connect(user).setFeePercentage(domainHash, newFeePerc);
      const { feePercentage: feeFromSC } = await zns.asPricing.priceConfigs(domainHash);

      expect(feeFromSC).to.eq(newFeePerc);
    });

    it("Disallows an unauthorized user to set the fee percentage", async () => {
      const newFeePerc = BigNumber.from(222);
      const tx = zns.asPricing.connect(admin)
        .setFeePercentage(domainHash, newFeePerc);
      await expect(tx).to.be.revertedWith(NOT_AUTHORIZED_REG_WIRED_ERR);
    });
  });

  describe("#getRegistrationFee", () => {
    it("Successfully gets the fee for a price", async () => {
      const stake = ethers.utils.parseEther("0.2");
      const fee = await zns.asPricing.getFeeForPrice(domainHash, stake);
      const expectedFee = stake.mul("222").div("10000");

      expect(fee).to.eq(expectedFee);
    });
  });

  describe("#setAccessController", () => {
    it("Successfully sets the access controller", async () => {
      const currentAccessController = await zns.asPricing.getAccessController();
      expect(currentAccessController).to.not.eq(randomAcc.address);

      const tx = await zns.asPricing.setAccessController(randomAcc.address);

      const newAccessController = await zns.asPricing.getAccessController();
      expect(newAccessController).to.eq(randomAcc.address);

      await expect(tx).to.emit(zns.asPricing, "AccessControllerSet").withArgs(randomAcc.address);
    });

    it("Disallows an unauthorized user to set the access controller", async () => {
      const tx = zns.asPricing.connect(user).setAccessController(randomAcc.address);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });

    it("Disallows setting the access controller to the zero address", async () => {
      const tx = zns.asPricing.connect(admin).setAccessController(ethers.constants.AddressZero);
      await expect(tx).to.be.revertedWith(
        "AC: _accessController is 0x0 address"
      );
    });
  });

  describe("#setRegistry", () => {
    it("Should successfully set the registry", async () => {
      const currentRegistry = await zns.asPricing.registry();
      expect(currentRegistry).to.not.eq(randomAcc.address);

      const tx = await zns.asPricing.connect(admin).setRegistry(randomAcc.address);

      const newRegistry = await zns.asPricing.registry();
      expect(newRegistry).to.eq(randomAcc.address);

      await expect(tx).to.emit(zns.asPricing, "RegistrySet").withArgs(randomAcc.address);
    });

    it("Should NOT set the registry if called by anyone other than ADMIN_ROLE", async () => {
      const tx = zns.asPricing.connect(user).setRegistry(randomAcc.address);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });
  });

  describe("#revokePrice", () => {
    it("should set maxPrice and minPrice to 0 if called by REGISTRAR_ROLE and fire a #PriceRevoked", async () => {
      const {
        maxPrice: maxPriceBefore,
        minPrice: minPriceBefore,
      } = await zns.asPricing.priceConfigs(domainHash);
      expect(maxPriceBefore).to.eq(priceConfigDefault.maxPrice);
      expect(minPriceBefore).to.eq(priceConfigDefault.minPrice);

      await zns.accessController.connect(admin).grantRole(REGISTRAR_ROLE, mockRegistrar.address);

      const tx = await zns.asPricing.connect(mockRegistrar).revokePrice(domainHash);
      // check event
      await expect(tx).to.emit(zns.asPricing, "PriceRevoked").withArgs(domainHash);

      const {
        maxPrice: maxPriceAfter,
        minPrice: minPriceAfter,
      } = await zns.asPricing.priceConfigs(domainHash);
      expect(maxPriceAfter).to.eq(0);
      expect(minPriceAfter).to.eq(0);
    });

    it("should revert if called by anyone other than REGISTRAR_ROLE", async () => {
      await expect(
        zns.asPricing.connect(user).revokePrice(domainHash)
      ).to.be.revertedWith(
        getAccessRevertMsg(user.address, REGISTRAR_ROLE)
      );
    });

    it("should result in price for any length to be 0", async () => {
      const { maxPrice } = await zns.asPricing.priceConfigs(domainHash);
      expect(maxPrice).to.eq(priceConfigDefault.maxPrice);
      expect(maxPrice).to.not.eq(0);

      await zns.accessController.connect(admin).grantRole(REGISTRAR_ROLE, mockRegistrar.address);

      await zns.asPricing.connect(mockRegistrar).revokePrice(domainHash);

      const labels = [
        "a",
        "abc",
        "abcdefghijklmnop",
        "abcdefghijklmnopqrstuvwxyzalksjdlakssdaasdasljkdbasldkuwgljkabclaksjdgawuet",
      ];

      await labels.reduce(
        async (acc, label) => {
          await acc;
          expect(
            await zns.asPricing.getPrice(domainHash, label)
          ).to.eq(0);
        }, Promise.resolve()
      );
    });
  });

  describe("Events", () => {
    it("Emits MaxPriceSet", async () => {
      const newMaxPrice = priceConfigDefault.maxPrice.add(1);

      const tx = zns.asPricing.connect(user).setMaxPrice(domainHash, newMaxPrice);
      await expect(tx).to.emit(zns.asPricing, "MaxPriceSet").withArgs(domainHash, newMaxPrice);
    });

    it("Emits BaseLengthSet", async () => {
      const newLength = 5;

      const tx = zns.asPricing.connect(user).setBaseLength(domainHash, newLength);
      await expect(tx).to.emit(zns.asPricing, "BaseLengthSet").withArgs(domainHash, newLength);
    });
  });

  // TODO sub: unblock and fix this test when contract is proxied !!
  // describe("UUPS", () => {
  //   it("Allows an authorized user to upgrade the contract", async () => {
  //     // ZNSAsymptoticPricing to upgrade to
  //     const factory = new ZNSAsymptoticPricing__factory(deployer);
  //     const newAsPricing = await factory.deploy();
  //     await newAsPricing.deployed();
  //
  //     // Confirm the deployer is a governor, as set in `deployZNS` helper
  //     await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;
  //
  //     const tx = zns.asPricing.connect(user).upgradeTo(newAsPricing.address);
  //     await expect(tx).to.not.be.reverted;
  //   });
  //
  //   it("Fails to upgrade if the caller is not authorized", async () => {
  //     // ZNSAsymptoticPricing to upgrade to
  //     const factory = new ZNSAsymptoticPricingUpgradeMock__factory(deployer);
  //     const newAsPricing = await factory.deploy();
  //     await newAsPricing.deployed();
  //
  //     // Confirm the account is not a governor
  //     await expect(zns.accessController.checkGovernor(randomAcc.address)).to.be.reverted;
  //
  //     const tx = zns.asPricing.connect(randomAcc).upgradeTo(newAsPricing.address);
  //
  //     await expect(tx).to.be.revertedWith(
  //       getAccessRevertMsg(randomAcc.address, GOVERNOR_ROLE)
  //     );
  //   });
  //
  //   it("Verifies that variable values are not changed in the upgrade process", async () => {
  //     const factory = new ZNSAsymptoticPricingUpgradeMock__factory(deployer);
  //     const newAsPricing = await factory.deploy();
  //     await newAsPricing.deployed();
  //
  //     await zns.asPricing.connect(user).setBaseLength(domainHash, "7");
  //     await zns.asPricing.connect(user).setMaxPrice(
  //       domainHash,
  //       priceConfigDefault.maxPrice.add(15)
  //     );
  //
  //     const contractCalls = [
  //       zns.asPricing.priceConfigs(domainHash),
  //       zns.asPricing.getPrice(domainHash, "wilder"),
  //     ];
  //
  //     await validateUpgrade(deployer, zns.asPricing, newAsPricing, factory, contractCalls);
  //   });
  // });
});
