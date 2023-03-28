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
  it("Gets the number", async () => {
    console.log(await registry.number());
  });
})