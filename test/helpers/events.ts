import { BigNumber, ContractReceipt, Event } from "ethers";

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

export const getDomainHashFromEvent = async (
  txReceipt : ContractReceipt,
  eventName = "DomainRegistered",
) : Promise<string> => {
  const customEvent = txReceipt.events?.find(event => {
    if (event.event === eventName) return event;
  });

  if (!customEvent) throw Error("Event not found");

  const domainHash = customEvent.args?.domainHash;

  if (!domainHash) throw Error("No domainHash on event");

  return domainHash;
};

export const getTokenIdFromEvent = async (
  txReceipt : ContractReceipt,
  eventName = "DomainRegistered",
) : Promise<BigNumber> => {
  const tokenId = await getDomainHashFromEvent(txReceipt, eventName);
  return BigNumber.from(tokenId);
};