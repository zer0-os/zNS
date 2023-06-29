import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractReceipt } from "ethers";
import { IZNSContracts } from "../../src/deploy/missions/types";

export const defaultRegistration = async (
  user : SignerWithAddress,
  zns : IZNSContracts,
  domainName : string,
  domainContent = zns.registrar.address,
) : Promise<ContractReceipt> => {
  const tx = await zns.registrar.connect(user).registerDomain(
    domainName,
    domainContent // Arbitrary address value
  );

  return tx.wait();
};
