import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { TypedContractEvent, TypedEventLog } from "../../typechain/common";
import { IZNSContractsLocal } from "./types";
import { IZNSContracts } from "../../src/deploy/campaign/types";


export const getDomainRegisteredEvents = async ({
  zns,
  domainHash = undefined,
  tokenId = undefined,
  registrant = undefined,
  blockRange = 50,
} : {
  zns : IZNSContractsLocal | IZNSContracts;
  domainHash ?: string | undefined;
  tokenId ?: bigint | undefined;
  registrant ?: string | undefined;
  blockRange ?: number;
}) : Promise<Array<TypedEventLog<TypedContractEvent>>> => {
  const latestBlock = await time.latestBlock();
  const filter = zns.rootRegistrar.filters.DomainRegistered(
    undefined,
    domainHash,
    undefined,
    tokenId,
    undefined,
    registrant,
    undefined
  );

  return zns.rootRegistrar.queryFilter(filter, latestBlock - blockRange, latestBlock);
};

export const getDomainHashFromEvent = async ({
  zns,
  user,
} : {
  zns : IZNSContractsLocal | IZNSContracts;
  user : SignerWithAddress;
}) : Promise<string> => {
  const latestBlock = await time.latestBlock();
  const filter = zns.rootRegistrar.filters.DomainRegistered(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    user.address,
    undefined,
  );

  const events = await zns.rootRegistrar.queryFilter(filter, latestBlock - 2, latestBlock);
  const { args: { domainHash } } = events[events.length - 1];

  return domainHash;
};
