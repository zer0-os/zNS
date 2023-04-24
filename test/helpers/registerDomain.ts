import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSContracts } from "./types";
import { ContractTransaction } from "ethers";
import { getDomainHash } from ".";

export const defaultRootRegistration = async (
  user: SignerWithAddress,
  zns: ZNSContracts,
  domain: string
): Promise<ContractTransaction> => {
  const tx = await zns.registrar.connect(user).registerRootDomain(
    domain,
    zns.addressResolver.address,
    zns.registrar.address // Arbitrary domainAddress value
  );

  return tx;
}

export const defaultSubdomainRegistration = async (
  user: SignerWithAddress,
  zns: ZNSContracts,
  parentDomainHash: string,
  domain: string
): Promise<ContractTransaction> => {
  const tx = await zns.registrar.connect(user).registerSubdomain(
    parentDomainHash,
    domain,
    user.address,
    zns.addressResolver.address,
    zns.registrar.address
  );

  return tx;
}