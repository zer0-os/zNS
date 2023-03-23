const { expect } = require("chai");
import * as hre from "hardhat";
import { Namehash, Namehash__factory } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Namehash", function () {
  let deployer: SignerWithAddress
  let namehash: Namehash;
    
  beforeEach(async function () {
    [deployer] = await hre.ethers.getSigners();
    const namehashFactory = new Namehash__factory(deployer);
    namehash = await namehashFactory.deploy();
    await namehash.deployed();
  });
  
  it("should return the correct namehash for a given domain", async function () {
    const domain = "example";
    const expectedName = hre.ethers.utils.namehash(`${domain}.eth`);

    const name = await namehash.getNamehash(domain);
    expect(name).to.equal(expectedName);
  });
  it("Should normalize the name", async function () {
    const domain = "wilder.world.citizen";
    const domainAbnormal = "Wilder.World.Citizen";
    const name = hre.ethers.utils.namehash(domain);
    const abnormalName = hre.ethers.utils.namehash(domainAbnormal);
    expect(name).to.equal(abnormalName);
  });
});
