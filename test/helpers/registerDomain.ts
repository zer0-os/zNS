import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSContracts } from "./types";
import { ContractReceipt } from "ethers";

export const defaultRootRegistration = async (
  user : SignerWithAddress,
  zns : ZNSContracts,
  domainName : string
) : Promise<ContractReceipt> => {
  const tx = await zns.registrar.connect(user).registerRootDomain(
    domainName,
    zns.addressResolver.address,
    zns.registrar.address // Arbitrary domainAddress value
  );

  return tx.wait();
};

export const defaultSubdomainRegistration = async (
  user : SignerWithAddress,
  zns : ZNSContracts,
  parentDomainHash : string,
  domainName : string
) : Promise<ContractReceipt> => {
  const tx = await zns.registrar.connect(user).registerSubdomain(
    parentDomainHash,
    domainName,
    user.address,
    zns.addressResolver.address,
    zns.registrar.address
  );

  return tx.wait();
};