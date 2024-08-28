import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "ethers";
import {
  deployZNS,
  getCurvePrice,
  DEFAULT_PRECISION_MULTIPLIER,
  validateUpgrade,
  PaymentType,
  NOT_AUTHORIZED_ERR,
  INVALID_MULTIPLIER_ERR,
  INVALID_LENGTH_ERR,
  INVALID_LABEL_ERR, INITIALIZED_ERR, AC_UNAUTHORIZED_ERR, ZERO_ADDRESS_ERR, FEE_TOO_LARGE_ERR,
  INVALID_BASE_OR_MAX_LENGTH_ERR,
  INVALID_MAX_PRICE_ERR,
  DIVISION_BY_ZERO_ERR,
} from "./helpers";
import {
  AccessType,
  DEFAULT_DECIMALS,
  DEFAULT_PRICE_CONFIG,
  DEFAULT_PROTOCOL_FEE_PERCENT,
} from "./helpers/constants";
import { ADMIN_ROLE, GOVERNOR_ROLE } from "../src/deploy/constants";
import { ZNSCurvePricer, ZNSCurvePricerUpgradeMock__factory, ZNSCurvePricer__factory } from "../typechain";
import { registrationWithSetup } from "./helpers/register-setup";
import { getProxyImplAddress, getRandomString } from "./helpers/utils";
import { IZNSContractsLocal } from "./helpers/types";
import { getMongoAdapter } from "@zero-tech/zdc";

require("@nomicfoundation/hardhat-chai-matchers");

const { ZeroHash } = ethers;


describe("ZNSCurvePricer", () => {
  let deployer : SignerWithAddress;
  let user : SignerWithAddress;
  let admin : SignerWithAddress;
  let randomAcc : SignerWithAddress;

  let zns : IZNSContractsLocal;
  let domainHash : string;

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

    await zns.meowToken.connect(user).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
    await zns.meowToken.mint(user.address, 26000000000000000000000n);

    const fullConfig = {
      distrConfig: {
        paymentType: PaymentType.DIRECT,
        pricerContract: await zns.curvePricer.getAddress(),
        accessType: AccessType.OPEN,
      },
      paymentConfig: {
        token: await zns.meowToken.getAddress(),
        beneficiary: user.address,
      },
      priceConfig: DEFAULT_PRICE_CONFIG,
    };

    domainHash = await registrationWithSetup({
      zns,
      user,
      domainLabel: "testdomain",
      fullConfig,
    });
  });

  after(async () => {
    const dbAdapter = await getMongoAdapter();
    await dbAdapter.dropDB();
  });

  it("Should NOT let initialize the implementation contract", async () => {
    const factory = new ZNSCurvePricer__factory(deployer);
    const impl = await getProxyImplAddress(await zns.curvePricer.getAddress());
    const implContract = factory.attach(impl) as ZNSCurvePricer;

    await expect(
      implContract.initialize(
        await zns.accessController.getAddress(),
        await zns.registry.getAddress(),
        DEFAULT_PRICE_CONFIG
      )
    ).to.be.revertedWithCustomError(implContract, INITIALIZED_ERR);
  });

  it("Confirms values were initially set correctly", async () => {
    const valueCalls = [
      zns.curvePricer.priceConfigs(domainHash),
    ];

    const [
      priceConfigFromSC,
    ] = await Promise.all(valueCalls);

    const priceConfigArr = Object.values(DEFAULT_PRICE_CONFIG);

    priceConfigArr.forEach(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      (val, idx) => expect(val).to.eq(priceConfigFromSC[idx])
    );

    const regFromSC = await zns.curvePricer.registry();
    const acFromSC = await zns.curvePricer.getAccessController();

    expect(regFromSC).to.eq(await zns.registry.getAddress());
    expect(acFromSC).to.eq(await zns.accessController.getAddress());
  });

  describe("#getPrice", async () => {
    it("Returns 0 price for a label with no length if label validation is skipped", async () => {
      const {
        price,
        stakeFee,
      } = await zns.curvePricer.getPriceAndFee(domainHash, "", true);
      expect(price).to.eq(0);
      expect(stakeFee).to.eq(0);
    });

    it("Reverts for a label with no length if label validation is not skipped", async () => {
      await expect(zns.curvePricer.getPrice(domainHash, "", false)).to.be.revertedWithCustomError(
        zns.curvePricer,
        INVALID_LENGTH_ERR
      );
    });

    it("Reverts for invalid label if label validation is not skipped", async () => {
      await expect(zns.curvePricer.getPrice(domainHash, "wilder!", false)).to.be.revertedWithCustomError(
        zns.curvePricer,
        INVALID_LABEL_ERR
      );
    });

    it("Returns the base price for domains that are equal to the base length", async () => {
      // Using the default length of 3
      const domain = "eth";
      const params = await zns.curvePricer.priceConfigs(domainHash);

      const domainPrice = await zns.curvePricer.getPrice(domainHash, domain, true);
      expect(domainPrice).to.eq(params.maxPrice);
    });

    it("Returns the base price for domains that are less than the base length", async () => {
      const domainA = "et";
      const domainB = "e";
      const params = await zns.curvePricer.priceConfigs(domainHash);

      let domainPrice = await zns.curvePricer.getPrice(domainHash, domainA, true);
      expect(domainPrice).to.eq(params.maxPrice);

      (domainPrice = await zns.curvePricer.getPrice(domainHash, domainB, true));
      expect(domainPrice).to.eq(params.maxPrice);
    });

    it("Returns expected prices for a domain greater than the base length", async () => {
      // create a constant string with 22 letters
      const domainOne = "abcdefghijklmnopqrstuv";
      const domainTwo = "akkasddaasdas";

      // these values have been calced separately to validate
      // that both forumlas: SC + helper are correct
      // this value has been calces with the default priceConfig

      const domainOneExpPrice = await getCurvePrice(domainOne, DEFAULT_PRICE_CONFIG);
      const domainTwoExpPrice = await getCurvePrice(domainTwo, DEFAULT_PRICE_CONFIG);

      const domainOneRefValue = BigInt("4545450000000000000000");
      const domainTwoRefValue = BigInt("7692300000000000000000");

      const domainOnePriceSC = await zns.curvePricer.getPrice(domainHash, domainOne, true);
      const domainTwoPriceSC = await zns.curvePricer.getPrice(domainHash, domainTwo, true);

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

      const expectedPrice = await getCurvePrice(domain, DEFAULT_PRICE_CONFIG);
      const domainPrice = await zns.curvePricer.getPrice(domainHash, domain, true);

      expect(domainPrice).to.eq(expectedPrice);
    });

    it("Returns a price for multiple lengths", async () => {
      // Any value less than base length is always base price, so we only check
      // domains that are greater than base length + 1
      const short = "wild";
      const medium = "wilderworld";
      const long = "wilderworldbeastspetsnftscatscalicosteve";

      const expectedShortPrice = await getCurvePrice(short, DEFAULT_PRICE_CONFIG);
      const shortPrice = await zns.curvePricer.getPrice(domainHash, short, true);
      expect(expectedShortPrice).to.eq(shortPrice);

      const expectedMediumPrice = await getCurvePrice(medium, DEFAULT_PRICE_CONFIG);
      const mediumPrice = await zns.curvePricer.getPrice(domainHash, medium, true);
      expect(expectedMediumPrice).to.eq(mediumPrice);

      const expectedLongPrice = await getCurvePrice(long, DEFAULT_PRICE_CONFIG);
      const longPrice = await zns.curvePricer.getPrice(domainHash, long, true);
      expect(expectedLongPrice).to.eq(longPrice);
    });

    it("Can Price Names Longer Than 255 Characters", async () => {
      // 261 length
      const domain = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "a";
      const expectedPrice = getCurvePrice(domain, DEFAULT_PRICE_CONFIG);
      const domainPrice = await zns.curvePricer.getPrice(domainHash, domain, true);
      expect(domainPrice).to.eq(expectedPrice);
    });
  });

  describe("#setPriceConfig", () => {
    it("Can't price a name that has invalid characters", async () => {
      // Valid names must match the pattern [a-z0-9]
      const labelA = "WILDER";
      const labelB = "!?w1Id3r!?";
      const labelC = "!%$#^*?!#👍3^29";
      const labelD = "wo.rld";


      await expect(zns.curvePricer.getPrice(domainHash, labelA, false))
        .to.be.revertedWithCustomError(zns.curvePricer, INVALID_LABEL_ERR);
      await expect(zns.curvePricer.getPrice(domainHash, labelB, false))
        .to.be.revertedWithCustomError(zns.curvePricer, INVALID_LABEL_ERR);
      await expect(zns.curvePricer.getPrice(domainHash, labelC, false))
        .to.be.revertedWithCustomError(zns.curvePricer, INVALID_LABEL_ERR);
      await expect(zns.curvePricer.getPrice(domainHash, labelD, false))
        .to.be.revertedWithCustomError(zns.curvePricer, INVALID_LABEL_ERR);
    });

    it("Should set the config for any existing domain hash, including 0x0", async () => {
      const newConfig = {
        baseLength: BigInt("6"),
        maxLength: BigInt("35"),
        maxPrice: ethers.parseEther("150"),
        curveMultiplier: DEFAULT_PRICE_CONFIG.curveMultiplier,
        precisionMultiplier: DEFAULT_PRECISION_MULTIPLIER,
        feePercentage: DEFAULT_PROTOCOL_FEE_PERCENT,
        isSet: true,
      };

      // as a user of "domainHash" that's not 0x0
      await zns.curvePricer.connect(user).setPriceConfig(domainHash, newConfig);

      // as a ZNS deployer who owns the 0x0 hash
      await zns.curvePricer.connect(deployer).setPriceConfig(ZeroHash, newConfig);

      const configUser = await zns.curvePricer.priceConfigs(domainHash);

      expect(configUser.baseLength).to.eq(newConfig.baseLength);
      expect(configUser.maxLength).to.eq(newConfig.maxLength);
      expect(configUser.maxPrice).to.eq(newConfig.maxPrice);
      expect(configUser.curveMultiplier).to.eq(newConfig.curveMultiplier);
      expect(configUser.precisionMultiplier).to.eq(newConfig.precisionMultiplier);
      expect(configUser.feePercentage).to.eq(newConfig.feePercentage);

      const configDeployer = await zns.curvePricer.priceConfigs(ZeroHash);

      expect(configDeployer.baseLength).to.eq(newConfig.baseLength);
      expect(configDeployer.maxLength).to.eq(newConfig.maxLength);
      expect(configDeployer.maxPrice).to.eq(newConfig.maxPrice);
      expect(configDeployer.curveMultiplier).to.eq(newConfig.curveMultiplier);
      expect(configDeployer.precisionMultiplier).to.eq(newConfig.precisionMultiplier);
      expect(configDeployer.feePercentage).to.eq(newConfig.feePercentage);
    });

    it("Should revert if called by anyone other than owner or operator", async () => {
      const newConfig = {
        baseLength: BigInt("6"),
        maxLength: BigInt("20"),
        maxPrice: ethers.parseEther("10"),
        curveMultiplier: DEFAULT_PRICE_CONFIG.curveMultiplier,
        precisionMultiplier: DEFAULT_PRECISION_MULTIPLIER,
        feePercentage: DEFAULT_PROTOCOL_FEE_PERCENT,
        isSet: true,
      };

      await expect(
        zns.curvePricer.connect(randomAcc).setPriceConfig(domainHash, newConfig)
      ).to.be.revertedWithCustomError(
        zns.curvePricer,
        NOT_AUTHORIZED_ERR
      );

      await expect(
        zns.curvePricer.connect(randomAcc).setPriceConfig(ZeroHash, newConfig)
      ).to.be.revertedWithCustomError(
        zns.curvePricer,
        NOT_AUTHORIZED_ERR
      );
    });

    it("Should emit PriceConfigSet event with correct parameters", async () => {
      const newConfig = {
        baseLength: BigInt("6"),
        maxLength: BigInt("35"),
        maxPrice: ethers.parseEther("150"),
        curveMultiplier: DEFAULT_PRICE_CONFIG.curveMultiplier,
        precisionMultiplier: DEFAULT_PRECISION_MULTIPLIER,
        feePercentage: DEFAULT_PROTOCOL_FEE_PERCENT,
        isSet: true,
      };

      const tx = zns.curvePricer.connect(user).setPriceConfig(domainHash, newConfig);

      await expect(tx).to.emit(zns.curvePricer, "PriceConfigSet").withArgs(
        domainHash,
        newConfig.maxPrice,
        newConfig.curveMultiplier,
        newConfig.maxLength,
        newConfig.baseLength,
        newConfig.precisionMultiplier,
        newConfig.feePercentage,
      );
    });
  });

  describe("#setMaxPrice", () => {
    it("Allows an authorized user to set the max price", async () => {
      const newMaxPrice = DEFAULT_PRICE_CONFIG.maxPrice + ethers.parseEther("10");

      await zns.curvePricer.connect(user).setMaxPrice(domainHash, newMaxPrice);

      const params = await zns.curvePricer.priceConfigs(domainHash);
      expect(params.maxPrice).to.eq(newMaxPrice);
    });

    it("Disallows an unauthorized user to set the max price", async () => {
      const newMaxPrice = ethers.parseEther("0.7");

      const tx = zns.curvePricer.connect(admin).setMaxPrice(domainHash, newMaxPrice);
      await expect(tx).to.be.revertedWithCustomError(zns.curvePricer, NOT_AUTHORIZED_ERR);
    });

    it("Allows setting the max price to zero", async () => {
      const newMaxPrice = BigInt("0");

      await zns.curvePricer.connect(user).setMaxPrice(domainHash, newMaxPrice);
      const params = await zns.curvePricer.priceConfigs(domainHash);

      expect(params.maxPrice).to.eq(newMaxPrice);
    });

    it("Correctly sets max price", async () => {
      const newMaxPrice = DEFAULT_PRICE_CONFIG.maxPrice + ethers.parseEther("553");
      await zns.curvePricer.connect(user).setMaxPrice(domainHash, newMaxPrice);

      const params = await zns.curvePricer.priceConfigs(domainHash);
      expect(params.maxPrice).to.eq(newMaxPrice);
    });

    it("Causes any length domain to have a price of 0 if the maxPrice is 0", async () => {
      const newMaxPrice = BigInt("0");

      await zns.curvePricer.connect(user).setMaxPrice(domainHash, newMaxPrice);

      const shortDomain = "a";
      const longDomain = "abcdefghijklmnopqrstuvwxyz";

      const shortPrice = await zns.curvePricer.getPrice(domainHash, shortDomain, true);
      const longPrice = await zns.curvePricer.getPrice(domainHash, longDomain, true);

      expect(shortPrice).to.eq(BigInt("0"));
      expect(longPrice).to.eq(BigInt("0"));
    });

    it("The price of a domain is modified relatively when the basePrice is changed", async () => {
      const newMaxPrice = DEFAULT_PRICE_CONFIG.maxPrice + ethers.parseEther("9");

      const expectedPriceBefore = await getCurvePrice(defaultDomain, DEFAULT_PRICE_CONFIG);
      const priceBefore= await zns.curvePricer.getPrice(domainHash, defaultDomain, true);

      expect(expectedPriceBefore).to.eq(priceBefore);

      await zns.curvePricer.connect(user).setMaxPrice(domainHash, newMaxPrice);

      const newConfig = {
        ...DEFAULT_PRICE_CONFIG,
        maxPrice: newMaxPrice,
      };

      const expectedPriceAfter = await getCurvePrice(defaultDomain, newConfig);
      const priceAfter = await zns.curvePricer.getPrice(domainHash, defaultDomain, true);

      expect(expectedPriceAfter).to.eq(priceAfter);
      expect(expectedPriceAfter).to.be.gt(expectedPriceBefore);
      expect(priceAfter).to.be.gt(priceBefore);
    });
  });

  describe("#setCurveMultiplier", async () => {
    it("Return max price if curve multiplier set to 0", async () => {
      const newMultiplier = BigInt("0");

      await zns.curvePricer.connect(user).setCurveMultiplier(domainHash, newMultiplier);

      for (let i = 1; i < 6; i++) {
        const domainString = getRandomString(i * i);

        const price = await zns.curvePricer.getPrice(
          domainHash,
          domainString,
          false
        );

        await expect(
          price
        ).to.be.equal(
          DEFAULT_PRICE_CONFIG.maxPrice
        );
      }
    });

    it("Reverts when the method is called by a non-owner or operator", async () => {
      await expect(
        zns.curvePricer.connect(deployer).setCurveMultiplier(domainHash, 2000n)
      ).to.be.revertedWithCustomError(
        zns.curvePricer,
        NOT_AUTHORIZED_ERR
      ).withArgs(
        deployer,
        domainHash
      );
    });

    it("Should return max price for base length domain labels and 0 for other, which longer", async () => {
      // Case where we can set domain strings longer than `baseLength` for free
      // (numerator must be less than denominator)

      // constants for playing the scenario (one of many cases):
      // `maxPrice` = 25 000
      // `baseLength` <= 40
      // `curveMultiplier` >= 10 000 000 000

      const newConfig = {
        maxPrice: ethers.parseEther("25000"),
        curveMultiplier: BigInt("10000000000"),
        maxLength: BigInt(100),
        baseLength: BigInt(40),
        precisionMultiplier: DEFAULT_PRECISION_MULTIPLIER,
        feePercentage: DEFAULT_PROTOCOL_FEE_PERCENT,
        isSet: true,
      };

      await zns.curvePricer.connect(user).setPriceConfig(domainHash, newConfig);

      const check = async (label : string, res : bigint) => {
        const price = await zns.curvePricer.getPrice(
          domainHash,
          label,
          false
        );

        expect(
          price
        ).to.equal(
          res
        );
      };

      for (let i = 1; i <= newConfig.baseLength / 10n; i++) {
        await check(
          getRandomString(i * 10),
          DEFAULT_PRICE_CONFIG.maxPrice
        );
      }

      for (let i = 5; i <= 15; i++) {
        await check(
          getRandomString(i * 10),
          0n
        );
      }

      await zns.curvePricer.connect(user).setPriceConfig(domainHash, DEFAULT_PRICE_CONFIG);

    });
  });

  describe("#setPrecisionMultiplier", () => {
    it("Allows an authorized user to set the precision multiplier", async () => {
      const newMultiplier = BigInt("1");

      await zns.curvePricer.connect(user).setPrecisionMultiplier(domainHash, newMultiplier);

      const params = await zns.curvePricer.priceConfigs(domainHash);
      expect(params.precisionMultiplier).to.eq(newMultiplier);
    });

    it("Disallows an unauthorized user from setting the precision multiplier", async () => {
      const newMultiplier = BigInt("2");

      const tx = zns.curvePricer.connect(admin).setCurveMultiplier(domainHash, newMultiplier);
      await expect(tx).to.be.revertedWithCustomError(zns.curvePricer, NOT_AUTHORIZED_ERR);
    });

    it("Fails when setting to zero", async () => {
      const zeroMultiplier = BigInt("0");

      await expect(
        zns.curvePricer.connect(user).setPrecisionMultiplier(
          domainHash,
          zeroMultiplier
        )
      ).to.be.revertedWithCustomError(
        zns.curvePricer,
        INVALID_MULTIPLIER_ERR
      ).withArgs(0n);
    });

    it("Successfuly sets the precision multiplier when above 0", async () => {
      const newMultiplier = BigInt("3");
      await zns.curvePricer.connect(user).setPrecisionMultiplier(domainHash, newMultiplier);

      const params = await zns.curvePricer.priceConfigs(domainHash);
      expect(params.precisionMultiplier).to.eq(newMultiplier);
    });

    it("Verifies new prices are affected after changing the precision multiplier", async () => {
      const atIndex = 7;

      const before = await zns.curvePricer.getPrice(domainHash, defaultDomain, true);
      const beforePriceString = before.toString();

      expect(beforePriceString.charAt(atIndex)).to.eq("0");

      // Default precision is 2 decimals, so increasing this value should represent in prices
      // as a non-zero nect decimal place
      const newPrecision = BigInt(3);
      const newPrecisionMultiplier = BigInt(10) ** DEFAULT_DECIMALS - newPrecision;

      await zns.curvePricer.connect(user).setPrecisionMultiplier(domainHash, newPrecisionMultiplier);

      const after = await zns.curvePricer.getPrice(domainHash, defaultDomain, true);
      const afterPriceString = after.toString();

      expect(afterPriceString.charAt(atIndex)).to.not.eq("0");

    });

    it("Should revert when setting precisionMultiplier higher than 10^18", async () => {
      const newMultiplier = ethers.parseEther("100");
      await expect(
        zns.curvePricer.connect(user).setPrecisionMultiplier(domainHash, newMultiplier)
      ).to.be.revertedWithCustomError(
        zns.curvePricer,
        INVALID_MULTIPLIER_ERR
      );
    });
  });

  describe("#setBaseLength", () => {
    it("Allows an authorized user to set the base length", async () => {
      const newLength = 5;

      await zns.curvePricer.connect(user).setBaseLength(domainHash, newLength);
      const params = await zns.curvePricer.priceConfigs(domainHash);

      expect(params.baseLength).to.eq(newLength);
    });

    it("Disallows an unauthorized user to set the base length", async () => {
      const newLength = 5;

      const tx = zns.curvePricer.connect(admin).setBaseLength(domainHash, newLength);
      await expect(tx).to.be.revertedWithCustomError(zns.curvePricer, NOT_AUTHORIZED_ERR);
    });

    it("Allows setting the base length to zero", async () => {
      const newLength = 0;

      await zns.curvePricer.connect(user).setBaseLength(domainHash, newLength);
      const params = await zns.curvePricer.priceConfigs(domainHash);

      expect(params.baseLength).to.eq(newLength);
    });

    it("Causes any length domain to cost the base fee when set to max length of 255", async () => {
      const newLength = 255;
      // We have to set `maxLength` firstly, cause `baseLength` cannot be bigger than `maxLength`
      await zns.curvePricer.connect(user).setMaxLength(domainHash, newLength);
      await zns.curvePricer.connect(user).setBaseLength(domainHash, newLength);
      const params = await zns.curvePricer.priceConfigs(domainHash);

      const shortDomain = "a";
      const longDomain = "abcdefghijklmnopqrstuvwxyz";

      const shortPrice = await zns.curvePricer.getPrice(domainHash, shortDomain, true);
      const longPrice = await zns.curvePricer.getPrice(domainHash, longDomain, true);

      expect(shortPrice).to.eq(params.maxPrice);
      expect(longPrice).to.eq(params.maxPrice);
    });

    it("Causes prices to adjust correctly when length is increased", async () => {
      const newLength = 8;
      const paramsBefore = await zns.curvePricer.priceConfigs(domainHash);

      const expectedPriceBefore = await getCurvePrice(defaultDomain, DEFAULT_PRICE_CONFIG);
      const priceBefore = await zns.curvePricer.getPrice(domainHash, defaultDomain, true);
      expect(priceBefore).to.eq(expectedPriceBefore);
      expect(priceBefore).to.not.eq(paramsBefore.maxPrice);

      await zns.curvePricer.connect(user).setBaseLength(domainHash, newLength);

      const paramsAfter = await zns.curvePricer.priceConfigs(domainHash);

      const newConfig = {
        ...DEFAULT_PRICE_CONFIG,
        baseLength: BigInt(newLength),
      };

      const expectedPriceAfter = await getCurvePrice(defaultDomain, newConfig);
      const priceAfter = await zns.curvePricer.getPrice(domainHash, defaultDomain, true);
      expect(priceAfter).to.eq(expectedPriceAfter);
      expect(priceAfter).to.eq(paramsAfter.maxPrice);
    });

    it("Causes prices to adjust correctly when length is decreased", async () => {
      const length = 8;
      await zns.curvePricer.connect(user).setBaseLength(domainHash, length);

      const newConfig1 = {
        ...DEFAULT_PRICE_CONFIG,
        baseLength: BigInt(length),
      };

      const paramsBefore = await zns.curvePricer.priceConfigs(domainHash);

      const expectedPriceBefore = await getCurvePrice(defaultDomain, newConfig1);
      const priceBefore = await zns.curvePricer.getPrice(domainHash, defaultDomain, true);
      expect(priceBefore).to.eq(expectedPriceBefore);
      expect(priceBefore).to.eq(paramsBefore.maxPrice);

      const newLength = 5;
      await zns.curvePricer.connect(user).setBaseLength(domainHash, newLength);

      const newConfig2 = {
        ...DEFAULT_PRICE_CONFIG,
        baseLength: BigInt(newLength),
      };

      const paramsAfter = await zns.curvePricer.priceConfigs(domainHash);

      const expectedPriceAfter = await getCurvePrice(defaultDomain, newConfig2);
      const priceAfter = await zns.curvePricer.getPrice(domainHash, defaultDomain, true);
      expect(priceAfter).to.eq(expectedPriceAfter);
      expect(priceAfter).to.not.eq(paramsAfter.maxPrice);
    });

    it("Returns the price = 0 whenever the baseLength is 0", async () => {
      const newRootLength = 0;
      await zns.curvePricer.connect(user).setBaseLength(domainHash, newRootLength);

      const price = await zns.curvePricer.getPrice(domainHash, defaultDomain, true);

      expect(
        price
      ).to.eq(
        0n
      );
    });

    it("Adjusts prices correctly when setting base lengths to different values", async () => {
      for (let i = 0; i < 5; i++) {
        const newRootLength = i * 2;
        await zns.curvePricer.connect(user).setBaseLength(domainHash, newRootLength);
        const newConfig = {
          ...DEFAULT_PRICE_CONFIG,
          baseLength: BigInt(newRootLength),
        };

        const expectedRootPrice = await getCurvePrice(defaultDomain, newConfig);
        const rootPrice = await zns.curvePricer.getPrice(domainHash, defaultDomain, true);

        expect(rootPrice).to.eq(expectedRootPrice);
      }
    });
  });

  describe("#setMaxLength", () => {
    it("Allows an authorized user to set the max length", async () => {
      const newLength = 5;

      await zns.curvePricer.connect(user).setMaxLength(domainHash, newLength);
      const params = await zns.curvePricer.priceConfigs(domainHash);

      expect(params.maxLength).to.eq(newLength);
    });

    it("Disallows an unauthorized user to set the max length", async () => {
      const newLength = 5;

      const tx = zns.curvePricer.connect(admin).setMaxLength(domainHash, newLength);
      await expect(tx).to.be.revertedWithCustomError(zns.curvePricer, NOT_AUTHORIZED_ERR);
    });

    it("Doesn't allow setting the max length to zero", async () => {
      const newLength = 0;

      await expect(
        zns.curvePricer.connect(user).setMaxLength(domainHash, newLength)
      ).to.be.revertedWithCustomError(
        zns.curvePricer,
        INVALID_BASE_OR_MAX_LENGTH_ERR
      ).withArgs(
        domainHash
      );
    });
  });

  describe("#setFeePercentage", () => {
    it("Successfully sets the fee percentage", async () => {
      const newFeePerc = BigInt(222);
      await zns.curvePricer.connect(user).setFeePercentage(domainHash, newFeePerc);
      const { feePercentage: feeFromSC } = await zns.curvePricer.priceConfigs(domainHash);

      expect(feeFromSC).to.eq(newFeePerc);
    });

    it("Disallows an unauthorized user to set the fee percentage", async () => {
      const newFeePerc = BigInt(222);
      const tx = zns.curvePricer.connect(admin)
        .setFeePercentage(domainHash, newFeePerc);
      await expect(tx).to.be.revertedWithCustomError(zns.curvePricer, NOT_AUTHORIZED_ERR);
    });

    it("should revert when trying to set feePercentage higher than PERCENTAGE_BASIS", async () => {
      const newFeePerc = BigInt(10001);
      await expect(
        zns.curvePricer.connect(user).setFeePercentage(domainHash, newFeePerc)
      ).to.be.revertedWithCustomError(
        zns.curvePricer,
        FEE_TOO_LARGE_ERR
      ).withArgs(newFeePerc, 10000n);
    });
  });

  describe("#getRegistrationFee", () => {
    it("Successfully gets the fee for a price", async () => {
      const stake = ethers.parseEther("0.2");
      const fee = await zns.curvePricer.getFeeForPrice(domainHash, stake);
      const expectedFee = stake * 222n / 10000n;

      expect(fee).to.eq(expectedFee);
    });
  });

  describe("#setAccessController", () => {
    it("Successfully sets the access controller", async () => {
      const currentAccessController = await zns.curvePricer.getAccessController();
      expect(currentAccessController).to.not.eq(randomAcc.address);

      const tx = await zns.curvePricer.setAccessController(randomAcc.address);

      const newAccessController = await zns.curvePricer.getAccessController();
      expect(newAccessController).to.eq(randomAcc.address);

      await expect(tx).to.emit(zns.curvePricer, "AccessControllerSet").withArgs(randomAcc.address);
    });

    it("Disallows an unauthorized user to set the access controller", async () => {
      const tx = zns.curvePricer.connect(user).setAccessController(randomAcc.address);
      await expect(tx).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(user.address,ADMIN_ROLE);
    });

    it("Disallows setting the access controller to the zero address", async () => {
      const tx = zns.curvePricer.connect(admin).setAccessController(ethers.ZeroAddress);
      await expect(tx).to.be.revertedWithCustomError(
        zns.curvePricer,
        ZERO_ADDRESS_ERR
      );
    });
  });

  describe("#setRegistry", () => {
    it("Should successfully set the registry", async () => {
      const currentRegistry = await zns.curvePricer.registry();
      expect(currentRegistry).to.not.eq(randomAcc.address);

      const tx = await zns.curvePricer.connect(admin).setRegistry(randomAcc.address);

      const newRegistry = await zns.curvePricer.registry();
      expect(newRegistry).to.eq(randomAcc.address);

      await expect(tx).to.emit(zns.curvePricer, "RegistrySet").withArgs(randomAcc.address);
    });

    it("Should NOT set the registry if called by anyone other than ADMIN_ROLE", async () => {
      const tx = zns.curvePricer.connect(user).setRegistry(randomAcc.address);
      await expect(tx).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(user.address,ADMIN_ROLE);
    });
  });

  describe("#validateConfig", () => {
    it("Should revert when all passed variables are 0", async () => {
      await expect(
        zns.curvePricer.connect(user).setPriceConfig(
          domainHash,
          {
            maxPrice: 0n,
            curveMultiplier: 0n,
            maxLength: 0n,
            baseLength: 0n,
            precisionMultiplier: 0n,
            feePercentage: 0n,
            isSet: true,
          }
        )
      ).to.be.revertedWithCustomError(
        zns.curvePricer,
        INVALID_MAX_PRICE_ERR
      ).withArgs(domainHash);
    });

    it("Should revert when `baseLength` and `maxLength` are 0", async () => {
      await zns.curvePricer.connect(user).setBaseLength(
        domainHash,
        0n
      );

      await expect(
        zns.curvePricer.connect(user).setMaxLength(
          domainHash,
          0n
        )
      ).to.be.revertedWithCustomError(
        zns.curvePricer,
        DIVISION_BY_ZERO_ERR
      );
    });
    it("Should revert when `baseLength` and `curveMultiplier` are 0", async () => {
      await zns.curvePricer.connect(user).setBaseLength(
        domainHash,
        0n
      );

      await expect(
        zns.curvePricer.connect(user).setCurveMultiplier(
          domainHash,
          0n
        )
      ).to.be.revertedWithCustomError(
        zns.curvePricer,
        DIVISION_BY_ZERO_ERR
      );
    });

    it("Should revert when `maxLength` is 0", async () => {
      await expect(
        zns.curvePricer.connect(user).setMaxLength(
          domainHash,
          0n
        )
      ).to.be.revertedWithCustomError(
        zns.curvePricer,
        INVALID_BASE_OR_MAX_LENGTH_ERR
      );
    });

    it("Should revert when `maxPrice`, `baseLength` and `maxLength` are 0", async () => {
      await zns.curvePricer.connect(user).setBaseLength(
        domainHash,
        0n
      );
      await zns.curvePricer.connect(user).setMaxPrice(
        domainHash,
        0n
      );

      await expect(
        zns.curvePricer.connect(user).setMaxLength(
          domainHash,
          0n
        )
      ).to.be.revertedWithCustomError(
        zns.curvePricer,
        INVALID_MAX_PRICE_ERR
      );
    });

    it("Should revert when `maxPrice`, `baseLength` and `curveMultiplier` are 0", async () => {
      await zns.curvePricer.connect(user).setBaseLength(
        domainHash,
        0n
      );
      await zns.curvePricer.connect(user).setMaxPrice(
        domainHash,
        0n
      );

      await expect(
        zns.curvePricer.connect(user).setCurveMultiplier(
          domainHash,
          0n
        )
      ).to.be.revertedWithCustomError(
        zns.curvePricer,
        DIVISION_BY_ZERO_ERR
      );
    });

    it("Should revert when `maxPrice` and `maxLength` are 0", async () => {
      await zns.curvePricer.connect(user).setMaxPrice(
        domainHash,
        0n
      );

      await expect(
        zns.curvePricer.connect(user).setMaxLength(
          domainHash,
          0n
        )
      ).to.be.revertedWithCustomError(
        zns.curvePricer,
        INVALID_BASE_OR_MAX_LENGTH_ERR
      );
    });

    it("Should revert when `maxLength` smaller than `baseLength`", async () => {
      await zns.curvePricer.connect(user).setMaxLength(
        domainHash,
        10n
      );

      await expect(
        zns.curvePricer.connect(user).setBaseLength(
          domainHash,
          20n
        )
      ).to.be.revertedWithCustomError(
        zns.curvePricer,
        INVALID_BASE_OR_MAX_LENGTH_ERR
      );
    });

    it("Should revert when `length` of domain label smaller than `baseLength`", async () => {
      await zns.curvePricer.connect(user).setMaxLength(
        domainHash,
        10n
      );

      await expect(
        zns.curvePricer.connect(user).setBaseLength(
          domainHash,
          20n
        )
      ).to.be.revertedWithCustomError(
        zns.curvePricer,
        INVALID_BASE_OR_MAX_LENGTH_ERR
      );
    });
  });

  describe("Events", () => {
    it("Emits MaxPriceSet", async () => {
      const newMaxPrice = DEFAULT_PRICE_CONFIG.maxPrice + 1n;

      const tx = zns.curvePricer.connect(user).setMaxPrice(domainHash, newMaxPrice);
      await expect(tx).to.emit(zns.curvePricer, "MaxPriceSet").withArgs(domainHash, newMaxPrice);
    });

    it("Emits BaseLengthSet", async () => {
      const newLength = 5;

      const tx = zns.curvePricer.connect(user).setBaseLength(domainHash, newLength);
      await expect(tx).to.emit(zns.curvePricer, "BaseLengthSet").withArgs(domainHash, newLength);
    });
  });

  describe("UUPS", () => {
    it("Allows an authorized user to upgrade the contract", async () => {
      // CurvePricer to upgrade to
      const factory = new ZNSCurvePricer__factory(deployer);
      const newCurvePricer = await factory.deploy();
      await newCurvePricer.waitForDeployment();

      // Confirm the deployer is a governor, as set in `deployZNS` helper
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const tx = zns.curvePricer.connect(deployer).upgradeToAndCall(
        await newCurvePricer.getAddress(),
        "0x"
      );
      await expect(tx).to.not.be.reverted;
    });

    it("Fails to upgrade if the caller is not authorized", async () => {
      // CurvePricer to upgrade to
      const factory = new ZNSCurvePricerUpgradeMock__factory(deployer);
      const newCurvePricer = await factory.deploy();
      await newCurvePricer.waitForDeployment();

      // Confirm the account is not a governor
      await expect(zns.accessController.checkGovernor(randomAcc.address)).to.be.reverted;

      const tx = zns.curvePricer.connect(randomAcc).upgradeToAndCall(
        await newCurvePricer.getAddress(),
        "0x"
      );

      await expect(tx).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(randomAcc.address, GOVERNOR_ROLE);
    });

    it("Verifies that variable values are not changed in the upgrade process", async () => {
      const factory = new ZNSCurvePricerUpgradeMock__factory(deployer);
      const newCurvePricer = await factory.deploy();
      await newCurvePricer.waitForDeployment();

      await zns.curvePricer.connect(user).setBaseLength(domainHash, "7");
      await zns.curvePricer.connect(user).setMaxPrice(
        domainHash,
        DEFAULT_PRICE_CONFIG.maxPrice + 15n
      );

      const contractCalls = [
        zns.curvePricer.registry(),
        zns.curvePricer.getAccessController(),
        zns.curvePricer.priceConfigs(domainHash),
        zns.curvePricer.getPrice(domainHash, "wilder", true),
      ];

      await validateUpgrade(deployer, zns.curvePricer, newCurvePricer, factory, contractCalls);
    });
  });
});