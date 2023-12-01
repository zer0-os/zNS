import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { CustomDecimalTokenMock__factory } from "../../../typechain";


export const deployCustomDecToken = async (
  deployer : SignerWithAddress,
  decimals : number | string | bigint = 18
) => {
  const tokenFact = new CustomDecimalTokenMock__factory(deployer);
  const token = await tokenFact.deploy(deployer.address, decimals);

  await token.waitForDeployment();

  return token;
};
