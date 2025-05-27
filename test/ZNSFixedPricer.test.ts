import {
  deployZNS,
  INVALID_LABEL_ERR,
  DEFAULT_PERCENTAGE_BASIS,
  DEFAULT_FIXED_PRICER_CONFIG_BYTES,
  DEFAULT_FIXED_PRICE_CONFIG,
  encodePriceConfig,
  decodePriceConfig,
  DEFAULT_PROTOCOL_FEE_PERCENT,
  IZNSContractsLocal,
  Utils,
  IFixedPriceConfig,
  INVALID_CONFIG_LENGTH_ERR,
  FEE_TOO_LARGE_ERR,
} from "./helpers";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import * as ethers from "ethers";
import { registrationWithSetup } from "./helpers/register-setup";
import { expect } from "chai";


describe("ZNSFixedPricer", () => {
  let deployer : SignerWithAddress;
  let admin : SignerWithAddress;
  let user : SignerWithAddress;
  let zeroVault : SignerWithAddress;

  let zns : IZNSContractsLocal;
  let domainHash : string;

  let utils : Utils;

  before(async () => {
    [deployer, admin, user, zeroVault] = await hre.ethers.getSigners();

    zns = await deployZNS({
      deployer,
      governorAddresses: [deployer.address, deployer.address],
      adminAddresses: [admin.address],
      zeroVaultAddress: zeroVault.address,
    });

    utils = new Utils(hre, zns);

    await zns.meowToken.connect(user).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
    await zns.meowToken.mint(user.address, ethers.parseEther("10000000000000"));

    domainHash = await registrationWithSetup({
      zns,
      user,
      domainLabel: "test",
      fullConfig: await utils.getDefaultFullConfigFixed(user),
    });
  });

  it("Confirms encoding is the same offchain and onchain", async () => {
    const onchain = await zns.fixedPricer.encodeConfig(DEFAULT_FIXED_PRICE_CONFIG);
    const offchain = encodePriceConfig(DEFAULT_FIXED_PRICE_CONFIG);

    expect(onchain).to.eq(offchain);
  });

  it("Confirms decoding is the same offchain and onchain", async () => {
    const onchain = await zns.fixedPricer.decodePriceConfig(DEFAULT_FIXED_PRICER_CONFIG_BYTES);
    const offchain = decodePriceConfig(DEFAULT_FIXED_PRICER_CONFIG_BYTES) as IFixedPriceConfig;

    expect(onchain.price).to.eq(offchain.price);
    expect(onchain.feePercentage).to.eq(offchain.feePercentage);
  });

  it("#getPrice should return the correct price", async () => {
    const newPrice = ethers.parseEther("3213");
    const newConfig = {
      price: newPrice,
      feePercentage: DEFAULT_PROTOCOL_FEE_PERCENT,
    };

    const asBytes = encodePriceConfig(newConfig);

    await zns.subRegistrar.connect(user).setPricerDataForDomain(
      domainHash,
      asBytes,
      zns.fixedPricer.target
    );

    expect(
      await zns.fixedPricer.getPrice(asBytes, "testname", false)
    ).to.equal(newPrice);
  });

  it("#getPrice() should revert for invalid label when not skipping the label validation", async () => {
    await expect(
      zns.fixedPricer.getPrice(domainHash, "tEstname", false)
    ).to.be.revertedWithCustomError(zns.fixedPricer, INVALID_LABEL_ERR);
  });

  it("#getPriceAndFee() should return the correct price and fee", async () => {
    const newPrice = ethers.parseEther("3213");
    const newFee = BigInt(1234);

    const newConfig = {
      price: newPrice,
      feePercentage: newFee,
    };

    const asBytes = encodePriceConfig(newConfig);

    await zns.subRegistrar.connect(user).setPricerDataForDomain(
      domainHash,
      asBytes,
      zns.fixedPricer.target
    );

    const [ price, fee ] = await zns.fixedPricer.getPriceAndFee(
      asBytes,
      "testname",
      false
    );

    expect(price).to.equal(newPrice);
    expect(fee).to.equal(newPrice * newFee / DEFAULT_PERCENTAGE_BASIS);
  });

  it("#getFeeForPrice should return the correct fee for a given price", async () => {
    const newPrice = ethers.parseEther("3213");
    const newFee = BigInt(1234);

    const newConfig = {
      price: newPrice,
      feePercentage: newFee,
    };

    const asBytes = encodePriceConfig(newConfig);

    await zns.subRegistrar.connect(user).setPricerDataForDomain(
      domainHash,
      asBytes,
      zns.fixedPricer.target
    );

    const fee = await zns.fixedPricer.getFeeForPrice(asBytes, newPrice);

    expect(fee).to.equal(newPrice * newFee / DEFAULT_PERCENTAGE_BASIS);
  });

  describe("#validatePriceConfig", () => {
    it("Should pass if price config is valid", async () => {
      const config = {
        price: ethers.parseEther("1000"),
        feePercentage: DEFAULT_PROTOCOL_FEE_PERCENT,
      };

      await expect(
        await zns.fixedPricer.validatePriceConfig(encodePriceConfig(config))
      ).to.not.be.reverted;
    });

    it("should revert if the price config bytes has invalid length", async () => {
      await expect(
        zns.fixedPricer.validatePriceConfig("0x")
      ).to.be.revertedWithCustomError(zns.fixedPricer, INVALID_CONFIG_LENGTH_ERR);
    });

    it("should revert if the fee percentage is too high", async () => {
      const config = {
        price: ethers.parseEther("1000"),
        feePercentage: BigInt(10001),
      };

      await expect(
        zns.fixedPricer.validatePriceConfig(encodePriceConfig(config))
      ).to.be.revertedWithCustomError(zns.fixedPricer, FEE_TOO_LARGE_ERR);
    });
  });
});
