import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployRegistrar, deployZNS, getDomainHash, getEvent, getPrice, getTokenId } from "./helpers";
import { ZNSContracts } from "./helpers/types";
import * as ethers from "ethers";
import { defaultRootRegistration, defaultSubdomainRegistration } from "./helpers/registerDomain";
import { ZNSTreasury, ZNSTreasury__factory } from "../typechain";

require("@nomicfoundation/hardhat-chai-matchers");

describe("ZNSTreasury", () => {
  let deployer : SignerWithAddress;
  let user : SignerWithAddress;
  let burn : SignerWithAddress; // TODO fix when decided
  let mockRegistrar : SignerWithAddress;
  let zns : ZNSContracts;

  beforeEach(async () => {
    [deployer, burn, user, mockRegistrar] = await hre.ethers.getSigners();
    zns = await deployZNS(deployer, burn.address);

    // Set the registrar as a mock so that we can call the functions
    await zns.treasury.connect(deployer).setZNSRegistrar(mockRegistrar.address);

    // Give funds to user
    await zns.zeroToken.connect(user).approve(zns.treasury.address, ethers.constants.MaxUint256);
    await zns.zeroToken.transfer(user.address, ethers.utils.parseEther("15"));
  });

  it("Confirms deployment", async () => {
    const registrar = await zns.treasury.znsRegistrar();
    const priceOracle = await zns.treasury.znsPriceOracle();
    const token = await zns.treasury.zeroToken();
    const isAdmin = await zns.treasury.isAdmin(deployer.address);

    expect(registrar).to.eq(mockRegistrar.address);
    expect(priceOracle).to.eq(zns.priceOracle.address);
    expect(token).to.eq(zns.zeroToken.address);
    expect(isAdmin).to.be.true;
  });
  describe("getPriceFee", () => {
    it("Successfully gets the fee for a price", async () => {
      const stake = ethers.utils.parseEther("0.2");
      const fee = await zns.treasury.getPriceFee(stake);
      const expectedFee = stake.mul("222").div("10000");

      expect(fee).to.eq(expectedFee);
    });
  });

  describe("stakeForDomain", () => {
    it("Stakes the correct amount", async () => {
      const domain = "wilder";
      const domainHash = ethers.utils.id(domain);

      await zns.treasury.connect(mockRegistrar).stakeForDomain(
        domainHash,
        domain,
        user.address,
        burn.address,
        true
      );

      const stake = await zns.treasury.stakedForDomain(domainHash);
      const expectedStake = await zns.priceOracle.getPrice(domain, true);
      expect(stake).to.eq(expectedStake);
    });
  });
});