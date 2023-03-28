const { expect } = require("chai");
import * as hre from "hardhat";
//import { Namehash, Namehash__factory } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Namehash", function () {
  let deployer: SignerWithAddress
  
  it("Should normalize the name", async function () {
    const domain = "wilder.world.citizen";
    const domainAbnormal = "Wilder.World.Citizen";
    const name = hre.ethers.utils.namehash(domain);
    const abnormalName = hre.ethers.utils.namehash(domainAbnormal);
    expect(name).to.equal(abnormalName);
  });
});
