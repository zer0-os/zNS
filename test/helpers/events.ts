/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { TypedContractEvent, TypedEventLog } from "../../typechain/common";
import { IZNSContractsLocal } from "./types";
import { IZNSContracts } from "../../src/deploy/campaign/types";
import * as hre from "hardhat";


export const getDomainRegisteredEvents = async ({
  zns,
  domainHash = undefined,
  tokenId = undefined,
  registrant = undefined,
  blockRange = 50,
} : {
  zns : IZNSContractsLocal;
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
  registrantAddress,
  fromBlock,
} : {
  zns : IZNSContractsLocal | IZNSContracts;
  registrantAddress : string;
  fromBlock ?: number;
}) : Promise<string> => {
  if (!fromBlock && hre.network.name === "hardhat") {
    const latest = await zns.rootRegistrar.runner?.provider?.getBlockNumber();
    fromBlock = latest as number - 50;
  }

  const filter = zns.rootRegistrar.filters.DomainRegistered(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    registrantAddress,
    undefined,
  );

  const events = await zns.rootRegistrar.queryFilter(filter, fromBlock);
  const { args: { domainHash } } = events[events.length - 1];

  return domainHash;
};

export const getEvents = async ({
  contract,
  eventName,
  args,
  fromBlock,
} : {
  contract : any;
  eventName : string;
  args ?: any;
  fromBlock ?: number;
}) : Promise<Array<TypedEventLog<TypedContractEvent>>> => {
  if (!fromBlock && hre.network.name === "hardhat") {
    const latest = await contract.runner.provider.getBlockNumber();
    fromBlock = latest - 50;
  }

  const filter = contract.filters[eventName](args);

  return contract.queryFilter(filter, fromBlock);
};
