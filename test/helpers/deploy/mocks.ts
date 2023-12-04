import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { CustomDecimalTokenMock__factory } from "../../../typechain";
import { BigNumber } from "ethers";


export const deployCustomDecToken = async (
  deployer : SignerWithAddress,
  decimals : number | string | BigNumber = 18
) => {
  const tokenFact = new CustomDecimalTokenMock__factory(deployer);
  const token = await tokenFact.deploy(deployer.address, decimals);

  await token.deployed();

  return token;
};
