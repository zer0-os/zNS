import * as hre from "hardhat";
import { ZNSRegistry, ZNSRegistry__factory } from "../typechain";

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
async function main () {
  const [deployer] = await hre.ethers.getSigners();

  const factory = new ZNSRegistry__factory(deployer);
  const registry : ZNSRegistry = await factory.deploy();

  await registry.deployed();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
