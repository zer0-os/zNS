import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployAddressResolver, deployDomainToken, deployRegistry, deployTreasury, deployZNS, deployZTokenMock } from "./helpers/deployZNS";
import { ZNSContracts } from "./helpers/types";
import { ZeroTokenMock, ZeroTokenMock__factory } from "../typechain";
import { parseEther } from "ethers/lib/utils";

require("@nomicfoundation/hardhat-chai-matchers");

describe("ZNSRegistrar", () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  
  let zeroTokenMock: ZeroTokenMock;
  let zeroTokenMockFactory: ZeroTokenMock__factory;
  let zns: ZNSContracts

  beforeEach(async () => {
    [deployer, user] = await hre.ethers.getSigners();
    zns = await deployZNS(deployer);

    // Give the user 10 ZERO
    await zns.zToken.transfer(user.address, parseEther("10"));
  });
  it("Registers a top level domain", async () => {
    const balance = await zns.zToken.balanceOf(user.address);
    console.log(balance.toString());
  })
})