import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "ethers";
import {
  deployZNS,
  getCurvePrice,
  PaymentType,
  INVALID_PRECISION_MULTIPLIER_ERR,
  INVALID_LENGTH_ERR,
  INVALID_LABEL_ERR,
  FEE_TOO_LARGE_ERR,
  INVALID_BASE_OR_MAX_LENGTH_ERR,
  DIVISION_BY_ZERO_ERR,
  encodePriceConfig,
  decodePriceConfig,
  HARDHAT_INFER_ERR,
} from "./helpers";
import {
  AccessType,
  DEFAULT_CURVE_PRICE_CONFIG,
  DEFAULT_CURVE_PRICE_CONFIG_BYTES,
  DEFAULT_FIXED_PRICER_CONFIG_BYTES,
} from "./helpers/constants";
import { registrationWithSetup } from "./helpers/register-setup";
import { IFullDistributionConfig, IZNSContractsLocal } from "./helpers/types";
import { getMongoAdapter } from "@zero-tech/zdc";
import { ICurvePriceConfig } from "../src/deploy/missions/types";

require("@nomicfoundation/hardhat-chai-matchers");


describe("ZNSCurvePricer", () => {
  let deployer : SignerWithAddress;
  let user : SignerWithAddress;
  let admin : SignerWithAddress;
  let randomAcc : SignerWithAddress;

  let zns : IZNSContractsLocal;
  let domainHash : string;

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

    const fullConfig : IFullDistributionConfig = {
      distrConfig: {
        pricerContract: await zns.curvePricer.getAddress(),
        priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
        paymentType: PaymentType.DIRECT,
        accessType: AccessType.OPEN,
      },
      paymentConfig: {
        token: await zns.meowToken.getAddress(),
        beneficiary: user.address,
      },
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

  describe("#encodeConfig and #decodeConfig", () => {
    it("Confirms encoding is the same offchain and onchain", async () => {
      const onchain = await zns.curvePricer.encodeConfig(DEFAULT_CURVE_PRICE_CONFIG);
      const offchain = encodePriceConfig(DEFAULT_CURVE_PRICE_CONFIG);

      expect(onchain).to.eq(offchain);
    });

    it("Confirms decoding is the same offchain and onchain", async () => {
      const onchain = await zns.curvePricer.decodePriceConfig(DEFAULT_CURVE_PRICE_CONFIG_BYTES);
      const offchain = decodePriceConfig(DEFAULT_CURVE_PRICE_CONFIG_BYTES);

      Object.values(offchain).forEach((value, index) => {
        expect(onchain[index]).to.eq(value);
      });
    });
  });

  describe("#getPrice", async () => {
    it("Returns 0 price for a label with no length if label validation is skipped", async () => {
      const {
        price,
        stakeFee,
      } = await zns.curvePricer.getPriceAndFee(
        DEFAULT_CURVE_PRICE_CONFIG_BYTES,
        "",
        true
      );
      expect(price).to.eq(0);
      expect(stakeFee).to.eq(0);
    });

    it("Reverts for a label with no length if label validation is not skipped", async () => {
      await expect(zns.curvePricer.getPrice(DEFAULT_CURVE_PRICE_CONFIG_BYTES, "", false)).to.be.revertedWithCustomError(
        zns.curvePricer,
        INVALID_LENGTH_ERR
      );
    });

    it("Reverts for invalid label if label validation is not skipped", async () => {
      await expect(
        zns.curvePricer.getPrice(DEFAULT_CURVE_PRICE_CONFIG_BYTES, "wilder!", false)
      ).to.be.revertedWithCustomError(
        zns.curvePricer,
        INVALID_LABEL_ERR
      );
    });

    it("Returns the max price for domains that are equal to the base length", async () => {
      // Using the default length of 3
      const domain = "eth";
      const decodedPriceConfig = decodePriceConfig(DEFAULT_CURVE_PRICE_CONFIG_BYTES);

      const domainPrice = await zns.curvePricer.getPrice(DEFAULT_CURVE_PRICE_CONFIG_BYTES, domain, true);
      expect(domainPrice).to.eq((decodedPriceConfig as ICurvePriceConfig).maxPrice);
    });

    it("Returns the max price for domains that are less than the base length", async () => {
      const domainA = "et";
      const domainB = "e";

      const decodedPriceConfig = decodePriceConfig(DEFAULT_CURVE_PRICE_CONFIG_BYTES);

      let domainPrice = await zns.curvePricer.getPrice(DEFAULT_CURVE_PRICE_CONFIG_BYTES, domainA, true);
      expect(domainPrice).to.eq((decodedPriceConfig as ICurvePriceConfig).maxPrice);

      domainPrice = await zns.curvePricer.getPrice(DEFAULT_CURVE_PRICE_CONFIG_BYTES, domainB, true);
      expect(domainPrice).to.eq((decodedPriceConfig as ICurvePriceConfig).maxPrice);
    });

    it("Returns expected prices for a domain greater than the base length", async () => {
      // create a constant string with 22 letters
      const domainOne = "abcdefghijklmnopqrstuv";
      const domainTwo = "akkasddaasdas";

      // these values have been calced separately to validate
      // that both forumlas: SC + helper are correct
      // this value has been calces with the default priceConfig

      const domainOneExpPrice = await getCurvePrice(domainOne, DEFAULT_CURVE_PRICE_CONFIG);
      const domainTwoExpPrice = await getCurvePrice(domainTwo, DEFAULT_CURVE_PRICE_CONFIG);

      const domainOneRefValue = BigInt("4545450000000000000000");
      const domainTwoRefValue = BigInt("7692300000000000000000");

      const domainOnePriceSC = await zns.curvePricer.getPrice(DEFAULT_CURVE_PRICE_CONFIG_BYTES, domainOne, true);
      const domainTwoPriceSC = await zns.curvePricer.getPrice(DEFAULT_CURVE_PRICE_CONFIG_BYTES, domainTwo, true);

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

      const expectedPrice = await getCurvePrice(domain, DEFAULT_CURVE_PRICE_CONFIG);
      const domainPrice = await zns.curvePricer.getPrice(DEFAULT_CURVE_PRICE_CONFIG_BYTES, domain, true);

      expect(domainPrice).to.eq(expectedPrice);
    });

    it("Returns a price for multiple lengths", async () => {
      // Any value less than base length is always base price, so we only check
      // domains that are greater than base length + 1
      const short = "wild";
      const medium = "wilderworld";
      const long = "wilderworldbeastspetsnftscatscalicosteve";

      const expectedShortPrice = await getCurvePrice(short, DEFAULT_CURVE_PRICE_CONFIG);
      const shortPrice = await zns.curvePricer.getPrice(DEFAULT_CURVE_PRICE_CONFIG_BYTES, short, true);
      expect(expectedShortPrice).to.eq(shortPrice);

      const expectedMediumPrice = await getCurvePrice(medium, DEFAULT_CURVE_PRICE_CONFIG);
      const mediumPrice = await zns.curvePricer.getPrice(DEFAULT_CURVE_PRICE_CONFIG_BYTES, medium, true);
      expect(expectedMediumPrice).to.eq(mediumPrice);

      const expectedLongPrice = await getCurvePrice(long, DEFAULT_CURVE_PRICE_CONFIG);
      const longPrice = await zns.curvePricer.getPrice(DEFAULT_CURVE_PRICE_CONFIG_BYTES, long, true);
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
      const expectedPrice = getCurvePrice(domain, DEFAULT_CURVE_PRICE_CONFIG);
      const domainPrice = await zns.curvePricer.getPrice(DEFAULT_CURVE_PRICE_CONFIG_BYTES, domain, true);
      expect(domainPrice).to.eq(expectedPrice);
    });

    it("Can't price a name that has invalid characters", async () => {
      // Valid names must match the pattern [a-z0-9]
      const labelA = "WILDER";
      const labelB = "!?w1Id3r!?";
      const labelC = "!%$#^*?!#👍3^29";
      const labelD = "wo.rld";

      await expect(zns.curvePricer.getPrice(DEFAULT_CURVE_PRICE_CONFIG_BYTES, labelA, false))
        .to.be.revertedWithCustomError(zns.curvePricer, INVALID_LABEL_ERR);
      await expect(zns.curvePricer.getPrice(DEFAULT_CURVE_PRICE_CONFIG_BYTES, labelB, false))
        .to.be.revertedWithCustomError(zns.curvePricer, INVALID_LABEL_ERR);
      await expect(zns.curvePricer.getPrice(DEFAULT_CURVE_PRICE_CONFIG_BYTES, labelC, false))
        .to.be.revertedWithCustomError(zns.curvePricer, INVALID_LABEL_ERR);
      await expect(zns.curvePricer.getPrice(DEFAULT_CURVE_PRICE_CONFIG_BYTES, labelD, false))
        .to.be.revertedWithCustomError(zns.curvePricer, INVALID_LABEL_ERR);
    });
  });

  describe("#validatePriceConfig", () => {
    it("Succeeds when a valid config is provided", async () => {
      await expect(
        await zns.curvePricer.validatePriceConfig(
          DEFAULT_CURVE_PRICE_CONFIG_BYTES
        )).to.not.be.reverted;
    });

    it("Fails when the curve multiplier is 0 and the base length is 0", async () => {
      const localConfig = { ...DEFAULT_CURVE_PRICE_CONFIG };
      localConfig.curveMultiplier = 0n;
      localConfig.baseLength = 0n;

      const asBytes = encodePriceConfig(localConfig);

      try {
        await expect(
          zns.curvePricer.validatePriceConfig(asBytes)
        ).to.be.revertedWith(
          DIVISION_BY_ZERO_ERR
        );
      } catch (e) {
        expect((e as Error).message).to.include(DIVISION_BY_ZERO_ERR);
      }
    });

    it("Fails when max length is less than base length", async () => {
      const localConfig = { ...DEFAULT_CURVE_PRICE_CONFIG };
      localConfig.maxLength = 0n;
      localConfig.baseLength = 100n;

      const asBytes = encodePriceConfig(localConfig);

      try {
        await expect(
          zns.curvePricer.validatePriceConfig(asBytes)
        ).to.be.revertedWith(
          INVALID_BASE_OR_MAX_LENGTH_ERR
        );
      } catch (e) {
        expect((e as Error).message).to.include(INVALID_BASE_OR_MAX_LENGTH_ERR);
      }
    });

    it("Fails when maxLength is 0", async () => {
      const localConfig = { ...DEFAULT_CURVE_PRICE_CONFIG };
      localConfig.baseLength = 0n; // Set baseLength to 0 to avoid maxLength < baseLength failure
      localConfig.maxLength = 0n;

      const asBytes = encodePriceConfig(localConfig);

      try {
        await expect(
          zns.curvePricer.validatePriceConfig(asBytes)
        ).to.be.revertedWith(
          INVALID_BASE_OR_MAX_LENGTH_ERR
        );
      } catch (e) {
        expect((e as Error).message).to.include(INVALID_BASE_OR_MAX_LENGTH_ERR);
      }
    });

    it("Fails when precision muliplier is 0 or greater than 10^18", async () => {
      let localConfig = { ...DEFAULT_CURVE_PRICE_CONFIG };
      localConfig.precisionMultiplier = 0n;

      let asBytes = encodePriceConfig(localConfig);

      try {
        await expect(
          zns.curvePricer.validatePriceConfig(asBytes)
        ).to.be.revertedWith(
          INVALID_PRECISION_MULTIPLIER_ERR
        );
      } catch (e) {
        expect((e as Error).message).to.include(INVALID_PRECISION_MULTIPLIER_ERR);
      }
      localConfig = { ...DEFAULT_CURVE_PRICE_CONFIG };
      localConfig.precisionMultiplier = ethers.parseEther("10");

      asBytes = encodePriceConfig(localConfig);

      try {
        await expect(
          zns.curvePricer.validatePriceConfig(asBytes)
        ).to.be.revertedWith(
          INVALID_PRECISION_MULTIPLIER_ERR
        );
      } catch (e) {
        expect((e as Error).message).to.include(INVALID_PRECISION_MULTIPLIER_ERR);
      }
    });

    it("Fails when fee percentage is greater than 100%", async () => {
      const localConfig = { ...DEFAULT_CURVE_PRICE_CONFIG };
      localConfig.feePercentage = BigInt("10001");

      const asBytes = encodePriceConfig(localConfig);

      try {
        await expect(
          zns.curvePricer.validatePriceConfig(asBytes)
        ).to.be.revertedWith(
          FEE_TOO_LARGE_ERR
        );
      } catch (e) {
        expect((e as Error).message).to.include(FEE_TOO_LARGE_ERR);
      }
    });

    it("Fails when the config is invalid", async () => {
      try {
        await zns.curvePricer.validatePriceConfig(DEFAULT_FIXED_PRICER_CONFIG_BYTES);
      } catch (e) {
        expect((e as Error).message).to.include(HARDHAT_INFER_ERR);
      }
    });
  });

  describe("#getRegistrationFee", () => {
    it("Successfully gets the fee for a price", async () => {
      const stake = ethers.parseEther("0.2");
      const fee = await zns.curvePricer.getFeeForPrice(
        DEFAULT_CURVE_PRICE_CONFIG_BYTES,
        stake
      );
      const expectedFee = stake * 222n / 10000n;

      expect(fee).to.eq(expectedFee);
    });
  });
});