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
  let random : SignerWithAddress;
  let zeroVault : SignerWithAddress;

  let zns : IZNSContractsLocal;
  let domainHash : string;

  let utils : Utils;

  before(async () => {
    [deployer, admin, user, zeroVault, random] = await hre.ethers.getSigners();

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
    const offchain = decodePriceConfig(DEFAULT_FIXED_PRICER_CONFIG_BYTES);

    expect(Object.keys(onchain)).to.deep.eq(Object.keys(offchain));
    expect(Object.values(onchain)).to.deep.eq(Object.values(offchain));
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
});
