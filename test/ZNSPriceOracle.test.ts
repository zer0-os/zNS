import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, ethers } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ZNSContracts } from "./helpers/types";
import { deployZNS, getPrice, MULTIPLIER_OUT_OF_RANGE_ORA_ERR, validateUpgrade } from "./helpers";
import { priceConfigDefault, registrationFeePercDefault } from "./helpers/constants";
import { getAccessRevertMsg } from "./helpers/errors";
import { ADMIN_ROLE, GOVERNOR_ROLE } from "./helpers/access";
import { ZNSPriceOracleUpgradeMock__factory, ZNSPriceOracle__factory } from "../typechain";

require("@nomicfoundation/hardhat-chai-matchers");

describe("ZNSPriceOracle", () => {
  let deployer : SignerWithAddress;
  let user : SignerWithAddress;
  let admin : SignerWithAddress;
  let randomAcc : SignerWithAddress;

  let zns : ZNSContracts;

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

  // TODO reg: add tests for proper fee calcs!

  it("Confirms values were initially set correctly", async () => {
    const valueCalls = [
      zns.priceOracle.feePercentage(),
      zns.priceOracle.priceConfig(),
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
      } = await zns.priceOracle.getPrice("", true);
      expect(totalPrice).to.eq(0);
      expect(domainPrice).to.eq(0);
      expect(fee).to.eq(0);
    });

    it("Returns 0 price for a subdomain name with no length", async () => {
      const {
        totalPrice,
        domainPrice,
        fee,
      } = await zns.priceOracle.getPrice("", false);
      expect(totalPrice).to.eq(0);
      expect(domainPrice).to.eq(0);
      expect(fee).to.eq(0);
    });

    it("Returns the base price for domains that are equal to the base length", async () => {
      // Using the default length of 3
      const domain = "eth";
      const params = await zns.priceOracle.priceConfig();

      const {
        domainPrice,
      } = await zns.priceOracle.getPrice(domain, true);
      expect(domainPrice).to.eq(params.maxRootDomainPrice);
    });

    it("Returns the base price for subdomains that are equal to the base length", async () => {
      const domain = "eth";

      const params = await zns.priceOracle.priceConfig();

      const {
        domainPrice,
      } = await zns.priceOracle.getPrice(domain, false);
      expect(domainPrice).to.eq(params.maxSubdomainPrice);
    });

    it("Returns the base price for domains that are less than the base length", async () => {
      const domainA = "et";
      const domainB = "e";
      const params = await zns.priceOracle.priceConfig();

      // const rootPrice = await zns.priceOracle.rootDomainBasePrice();

      let { domainPrice } = await zns.priceOracle.getPrice(domainA, true);
      expect(domainPrice).to.eq(params.maxRootDomainPrice);

      ({ domainPrice } = await zns.priceOracle.getPrice(domainB, true));
      expect(domainPrice).to.eq(params.maxRootDomainPrice);
    });

    it("Returns the base price for subdomains that are less than the base length", async () => {
      const domainA = "et";
      const domainB = "e";
      const params = await zns.priceOracle.priceConfig();

      let { domainPrice: subdomainPrice } = await zns.priceOracle.getPrice(domainA, false);
      expect(subdomainPrice).to.eq(params.maxSubdomainPrice);

      ({ domainPrice: subdomainPrice } = await zns.priceOracle.getPrice(domainB, false));
      expect(subdomainPrice).to.eq(params.maxSubdomainPrice);
    });

    it("Returns the expected price for a domain greater than the base length", async () => {
      const domain = "wilder";

      const expectedPrice = await getPrice(domain, zns.priceOracle, true);
      const { domainPrice } = await zns.priceOracle.getPrice(domain, true);

      expect(domainPrice).to.eq(expectedPrice);
    });

    it("Returns the expected price for a subdomain greater than the base length", async () => {
      const domain = "wilder";

      const expectedPrice = await getPrice(domain, zns.priceOracle, false);
      const { domainPrice } = await zns.priceOracle.getPrice(domain, false);

      expect(domainPrice).to.eq(expectedPrice);
    });

    it("Returns a price even if the domain name is very long", async () => {
      // 255 length
      const domain = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstu";

      const expectedPrice = await getPrice(domain, zns.priceOracle, true);
      const { domainPrice } = await zns.priceOracle.getPrice(domain, true);

      expect(domainPrice).to.eq(expectedPrice);
    });

    it("Returns a price even if the subdomain name is very long", async () => {
      // 255 length
      const domain = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" +
        "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstu";

      const expectedPrice = await getPrice(domain, zns.priceOracle, false);
      const { domainPrice } = await zns.priceOracle.getPrice(domain, false);

      expect(domainPrice).to.eq(expectedPrice);
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
      const { domainPrice: shortPrice } = await zns.priceOracle.getPrice(short, true);
      expect(expectedShortPrice).to.eq(shortPrice);

      const expectedMediumPrice = await getPrice(medium, zns.priceOracle, true);
      const { domainPrice: mediumPrice } = await zns.priceOracle.getPrice(medium, true);
      expect(expectedMediumPrice).to.eq(mediumPrice);

      const expectedLongPrice = await getPrice(long, zns.priceOracle, true);
      const { domainPrice: longPrice } = await zns.priceOracle.getPrice(long, true);
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
      const { domainPrice: shortPrice } = await zns.priceOracle.getPrice(short, true);
      expect(expectedShortPrice).to.eq(shortPrice);

      const expectedMediumPrice = await getPrice(medium, zns.priceOracle, true);
      const { domainPrice: mediumPrice } = await zns.priceOracle.getPrice(medium, true);
      expect(expectedMediumPrice).to.eq(mediumPrice);

      const expectedLongPrice = await getPrice(long, zns.priceOracle, true);
      const { domainPrice: longPrice } = await zns.priceOracle.getPrice(long, true);
      expect(expectedLongPrice).to.eq(longPrice);
    });

    it("Prices Special Characters Accurately", async () => {
      const domainSpecialCharacterSet1 = "±ƒc¢Ãv";
      const domainSpecialCharacterSet2 = "œ柸þ€§ﾪ";
      const domainWithoutSpecials = "abcdef";
      const expectedPrice = await getPrice(domainWithoutSpecials, zns.priceOracle, false);
      let { domainPrice } = await zns.priceOracle.getPrice(domainSpecialCharacterSet1, false);
      expect(domainPrice).to.eq(expectedPrice);

      ({ domainPrice } = await zns.priceOracle.getPrice(domainSpecialCharacterSet2, false));
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
      const expectedPrice = await getPrice(domain, zns.priceOracle, false);
      const { domainPrice } = await zns.priceOracle.getPrice(domain, false);
      expect(domainPrice).to.eq(expectedPrice);
    });
  });

  describe("#setBasePrice", () => {
    it("Allows an authorized user to set the base price", async () => {
      const newMaxPrice = parseEther("0.7");

      await zns.priceOracle.connect(admin).setMaxPrice(newMaxPrice, true);

      const params = await zns.priceOracle.priceConfig();
      expect(params.maxRootDomainPrice).to.eq(newMaxPrice);
    });

    it("Disallows an unauthorized user to set the base price", async () => {
      const newMaxPrice = parseEther("0.7");

      const tx = zns.priceOracle.connect(user).setMaxPrice(newMaxPrice, true);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });

    it("Allows setting the price to zero", async () => {
      const newMaxPrice = BigNumber.from("0");

      await zns.priceOracle.connect(deployer).setMaxPrice(newMaxPrice, true);
      const params = await zns.priceOracle.priceConfig();

      expect(params.maxRootDomainPrice).to.eq(newMaxPrice);
    });

    it("Correctly sets the root and subdomain base price", async () => {
      const newMaxPrice = parseEther("0.5");
      await zns.priceOracle.connect(deployer).setMaxPrice(newMaxPrice, true);

      const paramsBefore = await zns.priceOracle.priceConfig();
      expect(paramsBefore.maxRootDomainPrice).to.eq(newMaxPrice);

      await zns.priceOracle.connect(deployer).setMaxPrice(newMaxPrice, false);

      const paramsAfter = await zns.priceOracle.priceConfig();
      expect(paramsAfter.maxSubdomainPrice).to.eq(newMaxPrice);
    });

    it("Causes any length domain to have a price of 0 if the basePrice is 0", async () => {
      const newMaxPrice = BigNumber.from("0");

      await zns.priceOracle.connect(deployer).setMaxPrice(newMaxPrice, true);

      const shortDomain = "a";
      const longDomain = "abcdefghijklmnopqrstuvwxyz";

      const { domainPrice: shortPrice } = await zns.priceOracle.getPrice(shortDomain, true);
      const { domainPrice: longPrice } = await zns.priceOracle.getPrice(longDomain, true);

      expect(shortPrice).to.eq(BigNumber.from("0"));
      expect(longPrice).to.eq(BigNumber.from("0"));
    });

    it("The price of a domain is modified relatively when the basePrice is changed", async () => {
      const newMaxPrice = parseEther("0.1");
      const domain = "wilder";

      const expectedPriceBefore = await getPrice(domain, zns.priceOracle, false);
      const { domainPrice: priceBefore } = await zns.priceOracle.getPrice(domain, false);

      expect(expectedPriceBefore).to.eq(priceBefore);

      await zns.priceOracle.connect(deployer).setMaxPrice(newMaxPrice, false);

      const expectedPriceAfter = await getPrice(domain, zns.priceOracle, false);
      const { domainPrice: priceAfter } = await zns.priceOracle.getPrice(domain, false);

      expect(expectedPriceAfter).to.eq(priceAfter);
      expect(expectedPriceAfter).to.be.lt(expectedPriceBefore);
      expect(priceAfter).to.be.lt(priceBefore);
    });
  });

  describe("#setPriceMultiplier", () => {
    it("Allows an authorized user to set the price multiplier", async () => {
      const newMultiplier = BigNumber.from("300");

      await zns.priceOracle.connect(deployer).setPriceMultiplier(newMultiplier);
      const params = await zns.priceOracle.priceConfig();
      expect(params.priceMultiplier).to.eq(newMultiplier);
    });

    it("Disallows an unauthorized user to set the price multiplier", async () => {
      const newMultiplier = BigNumber.from("300");

      const tx = zns.priceOracle.connect(user).setPriceMultiplier(newMultiplier);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });

    it("Fails when setting to a value below the specified range", async () => {
      // Valid range is 300 - 400
      const newMultiplier = BigNumber.from("299");

      const tx = zns.priceOracle.connect(deployer).setPriceMultiplier(newMultiplier);
      await expect(tx).to.be.revertedWith(MULTIPLIER_OUT_OF_RANGE_ORA_ERR);
    });

    it("Fails when setting to a value above the specified range", async () => {
      // Valid range is 300 - 400
      const newMultiplier = BigNumber.from("401");

      const tx = zns.priceOracle.connect(deployer).setPriceMultiplier(newMultiplier);
      await expect(tx).to.be.revertedWith(MULTIPLIER_OUT_OF_RANGE_ORA_ERR);
    });

    it("Succeeds when setting a value within the allowed range", async () => {
      // Valid range is 300 - 400
      const newMultiplier = BigNumber.from("350");

      await zns.priceOracle.connect(deployer).setPriceMultiplier(newMultiplier);

      const params = await zns.priceOracle.priceConfig();
      expect(params.priceMultiplier).to.eq(newMultiplier);
    });
  });

  describe("#setBaseLength(s)", () => {
    it("Allows an authorized user to set the base length", async () => {
      const newLength = 5;

      await zns.priceOracle.connect(deployer).setBaseLength(newLength, true);
      const params = await zns.priceOracle.priceConfig();

      expect(params.baseRootDomainLength).to.eq(newLength);
    });

    it("Disallows an unauthorized user to set the base length", async () => {
      const newLength = 5;

      const tx = zns.priceOracle.connect(user).setBaseLength(newLength, true);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });

    it("Allows setting the base length to zero", async () => {
      const newLength = 0;

      await zns.priceOracle.connect(deployer).setBaseLength(newLength, true);
      const params = await zns.priceOracle.priceConfig();

      expect(params.baseRootDomainLength).to.eq(newLength);
    });

    it("Causes any length domain to cost the base fee when set to max length of 255", async () => {
      const newLength = 255;
      await zns.priceOracle.connect(deployer).setBaseLength(newLength, true);
      const params = await zns.priceOracle.priceConfig();

      const shortDomain = "a";
      const longDomain = "abcdefghijklmnopqrstuvwxyz";

      const { domainPrice: shortPrice } = await zns.priceOracle.getPrice(shortDomain, true);
      const { domainPrice: longPrice } = await zns.priceOracle.getPrice(longDomain, true);

      expect(shortPrice).to.eq(params.maxRootDomainPrice);
      expect(longPrice).to.eq(params.maxRootDomainPrice);
    });

    it("Causes prices to adjust correctly when length is increased", async () => {
      const newLength = 8;
      const domain = "wilder";
      const paramsBefore = await zns.priceOracle.priceConfig();

      const expectedPriceBefore = await getPrice(domain, zns.priceOracle, true);
      const { domainPrice: priceBefore } = await zns.priceOracle.getPrice(domain, true);
      expect(priceBefore).to.eq(expectedPriceBefore);
      expect(priceBefore).to.not.eq(paramsBefore.maxRootDomainPrice);

      await zns.priceOracle.connect(deployer).setBaseLength(newLength, true);

      const paramsAfter = await zns.priceOracle.priceConfig();

      const expectedPriceAfter = await getPrice(domain, zns.priceOracle, true);
      const { domainPrice: priceAfter } = await zns.priceOracle.getPrice(domain, true);
      expect(priceAfter).to.eq(expectedPriceAfter);
      expect(priceAfter).to.eq(paramsAfter.maxRootDomainPrice);
    });

    it("Causes prices to adjust correctly when length is decreased", async () => {
      const length = 8;
      await zns.priceOracle.connect(deployer).setBaseLength(length, true);

      const domain = "wilder";

      // const basePrice = await zns.priceOracle.rootDomainBasePrice();
      const paramsBefore = await zns.priceOracle.priceConfig();

      const expectedPriceBefore = await getPrice(domain, zns.priceOracle, true);
      const { domainPrice: priceBefore } = await zns.priceOracle.getPrice(domain, true);
      expect(priceBefore).to.eq(expectedPriceBefore);
      expect(priceBefore).to.eq(paramsBefore.maxRootDomainPrice);

      const newLength = 3;
      await zns.priceOracle.connect(deployer).setBaseLength(newLength, true);

      const paramsAfter = await zns.priceOracle.priceConfig();

      const expectedPriceAfter = await getPrice(domain, zns.priceOracle, true);
      const { domainPrice: priceAfter } = await zns.priceOracle.getPrice(domain, true);
      expect(priceAfter).to.eq(expectedPriceAfter);
      expect(priceAfter).to.not.eq(paramsAfter.maxRootDomainPrice);
    });

    it("Allows an authorized user to set both base lengths", async () => {
      const newLength = 5;

      await zns.priceOracle.connect(deployer).setBaseLengths(newLength, newLength);

      const params = await zns.priceOracle.priceConfig();
      expect(params.baseRootDomainLength).to.eq(newLength);
      expect(params.baseSubdomainLength).to.eq(newLength);
    });

    it("Disallows an unauthorized user to set both base lengths", async () => {
      const newLength = 5;

      const tx = zns.priceOracle.connect(user).setBaseLengths(newLength, newLength);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });

    it("Adjusts prices correctly when setting base lengths to different values", async () => {
      const newRootLength = 0;
      const newSubdomainLength = 5;

      await zns.priceOracle.connect(deployer).setBaseLengths(newRootLength, newSubdomainLength);

      const domain = "wilder";

      const expectedRootPrice = await getPrice(domain, zns.priceOracle, true);
      const { domainPrice: rootPrice } = await zns.priceOracle.getPrice(domain, true);
      expect(rootPrice).to.eq(expectedRootPrice);

      const expectedSubdomainPrice = await getPrice(domain, zns.priceOracle, false);
      const { domainPrice: subdomainPrice } = await zns.priceOracle.getPrice(domain, false);
      expect(subdomainPrice).to.eq(expectedSubdomainPrice);

      expect(rootPrice).to.not.eq(subdomainPrice);
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
      const tx = zns.priceOracle.connect(user).setRegistrationFeePercentage(newFeePerc);
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

      await zns.priceOracle.connect(deployer).setBaseLength("7", true);
      await zns.priceOracle.connect(deployer).setPriceMultiplier("310");
      await zns.priceOracle.connect(deployer).setMaxPrice(ethers.utils.parseEther("0.7124"), true);

      const contractCalls = [
        zns.priceOracle.priceConfig(),
        zns.priceOracle.feePercentage(),
        zns.priceOracle.getPrice("wilder", true),
      ];

      await validateUpgrade(deployer, zns.priceOracle, newPriceOracle, factory, contractCalls);
    });
  });
});
