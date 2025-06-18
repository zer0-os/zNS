import *  as hre from "hardhat";
import { IZNSContractsLocal, DeployZNSParams, deployZNS } from "../../../test/helpers";
import { IZNSContracts } from "../campaign/types";
import { ERC20Mock, ERC20Mock__factory } from "../../../typechain";

// Deploy locally or to a testnet using `deployZNS` helper
const main = async () => {
  const [ migrationAdmin ] = await hre.ethers.getSigners();

  const params : DeployZNSParams = {
    deployer: migrationAdmin,
    governorAddresses: [migrationAdmin.address],
    adminAddresses: [migrationAdmin.address],
  };

  const zns = await deployZNS(params);
  console.log("DONE");


  // const factory = new ERC20Mock__factory(deployer);

  // const meowToken = await factory.deploy(
  //   "MEOW",
  //   "MEOW",
  // ) as unknown as ERC20Mock;

  // await meowToken.waitForDeployment();

  // console.log("MEOW Token deployed to:", meowToken.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});