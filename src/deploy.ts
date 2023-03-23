import * as hre from "hardhat";
import { Registry, Registry__factory } from "../typechain";

async function main() {
  const [deployer, fakeResolver] = await hre.ethers.getSigners();

  const factory = new Registry__factory(deployer);
  const registry: Registry = await factory.deploy();

  await registry.deployed();

  const toBytes = hre.ethers.utils.toUtf8Bytes("WilderWorld");
  const nameHash = hre.ethers.utils.keccak256(toBytes);

  // Set record first    
  await registry.connect(deployer).createDomainRecord(nameHash, fakeResolver.address);

  const gasA = await registry.connect(deployer).testFuncA(nameHash);
  const gasB = await registry.connect(deployer).testFuncB(nameHash);

  // With internall function
  console.log(gasA);

  // With modifier
  console.log(gasB);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
