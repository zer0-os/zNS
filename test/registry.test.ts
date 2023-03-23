import * as hre from "hardhat";
import { Registry, Registry__factory } from "../typechain";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Initial test setup", () => {
  let deployer: SignerWithAddress
  let registry: Registry;

  beforeEach(async () => {
    [deployer] = await hre.ethers.getSigners();
    const registryFactory = new Registry__factory(deployer);

    registry = await registryFactory.deploy();
  })
  it ("Gets the number", async () => {
    console.log(await registry.number());
  });
  it ("Registers the name wilder.world.citizen, and retreives the address", async () => {
    let name = "wilder.world.citizen";
    let namehash = hre.ethers.utils.namehash(name);
    await registry.register(namehash, deployer.address);

    let retreived = await registry.getAddressByNamehash(namehash);
    expect(retreived).to.equal(deployer.address);
  });
})