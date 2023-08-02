import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSContracts } from "./types";
import { ContractReceipt } from "ethers";

export const defaultRegistration = async (
  user : SignerWithAddress,
  zns : ZNSContracts,
  domainName : string,
  domainContent = zns.registrar.address,
) : Promise<ContractReceipt> => {
  const tx = await zns.registrar.connect(user).registerDomain(
    domainName,
    domainContent // Arbitrary address value
  );

  return tx.wait();
};
