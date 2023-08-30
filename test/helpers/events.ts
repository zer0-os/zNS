import { BigNumber, ContractReceipt, Event } from "ethers";
import { ZNSContracts } from "./types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * Get a specific named event from a transaction log
 *
 * @param txReceipt The transaction receipt
 * @param eventName The name of the event to get
 * @returns The event data, if found
 */
export const getEvent = async (
  txReceipt : ContractReceipt,
  eventName : string,
) : Promise<Array<Event> | undefined> => {
  const customEvent = txReceipt.events?.filter(event => {
    if (event.event === eventName) return event;
  });

  return customEvent;
};

export const getDomainHashFromReceipt = async (
  txReceipt : ContractReceipt,
  eventName = "DomainRegistered",
) : Promise<string> => {
  const customEvent = txReceipt.events?.find(event => {
    if (event.event === eventName) return event;
  });

  if (!customEvent) throw Error("Event not found");

  let domainHash = customEvent.args?.domainHash;

  if (!domainHash) {
    domainHash = customEvent.args?.subdomainHash;
  }

  if (!domainHash) throw Error("Domain hash not found");

  return domainHash;
};

export const getTokenIdFromReceipt = async (
  txReceipt : ContractReceipt,
  eventName = "DomainRegistered",
) : Promise<BigNumber> => {
  const tokenId = await getDomainHashFromReceipt(txReceipt, eventName);
  return BigNumber.from(tokenId);
};

export const getDomainRegisteredEvents = async ({
  zns,
  domainHash = null,
  tokenId = null,
  registrant = null,
  blockRange = 50,
} : {
  zns : ZNSContracts;
  domainHash ?: string | null;
  tokenId ?: BigNumber | null;
  registrant ?: string | null;
  blockRange ?: number;
}) : Promise<Array<Event>> => {
  const latestBlock = await time.latestBlock();
  const filter = zns.registrar.filters.DomainRegistered(
    null,
    domainHash,
    tokenId,
    null,
    registrant
  );

  return zns.registrar.queryFilter(filter, latestBlock - blockRange, latestBlock);
};

export const getDomainHashFromEvent = async ({
  zns,
  user,
} : {
  zns : ZNSContracts;
  user : SignerWithAddress;
}) : Promise<string> => {
  const latestBlock = await time.latestBlock();
  const filter = zns.registrar.filters.DomainRegistered(
    null,
    null,
    null,
    null,
    user.address
  );

  const [
    {
      args: { domainHash },
    },
  ] = await zns.registrar.queryFilter(filter, latestBlock - 2, latestBlock);

  return domainHash;
};
