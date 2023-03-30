import * as hre from "hardhat";
import { ZNSRegistry, ZNSRegistry__factory } from "../typechain";

async function main() {
  const [deployer, fakeResolver] = await hre.ethers.getSigners();

  const factory = new ZNSRegistry__factory(deployer);
  const registry: ZNSRegistry = await factory.deploy();

  await registry.deployed();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
