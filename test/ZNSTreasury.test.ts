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
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let burn: SignerWithAddress; // TODO fix when decided
  let zns: ZNSContracts;

  beforeEach(async () => {
    [deployer, burn, user] = await hre.ethers.getSigners();
    zns = await deployZNS(deployer, burn.address);

    // Give funds to user
    await zns.zeroToken.connect(user).approve(zns.treasury.address, ethers.constants.MaxUint256)
    await zns.zeroToken.transfer(user.address, ethers.utils.parseEther("15"));
  });
  it("Does a thing", async () => {
    const price = await zns.priceOracle.getPrice("wilder", true);
    const fee = await zns.treasury.getPriceFee(price);

    console.log(price);
    console.log(fee);
  });
});