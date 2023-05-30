import * as hre from "hardhat";
import { deployVerifyZNS } from "../helpers/deploy-verify-zns";
import * as ethers from "ethers";


export const registerDomainOp = async () => {
  const [
    governor,
    user,
  ] = await hre.ethers.getSigners();

  const zns = await deployVerifyZNS({ governor });

  // perform ops
  await zns.zeroToken.connect(user).approve(zns.treasury.address, ethers.constants.MaxUint256);
  await zns.zeroToken.transfer(user.address, ethers.utils.parseEther("15"));

  await zns.registrar.connect(user).registerDomain(
    "wilder",
    user.address,
  );
};


registerDomainOp()
  .then(() => process.exit(0))
  .catch(error => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
