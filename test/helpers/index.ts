import { BigNumber, ContractReceipt, Event } from "ethers";
import { ZNSPriceOracle } from "../../typechain";

export * from "./deployZNS";
export * from "./toTokenValues";

/**
 * Get the domain name price base on its length when given
 * an already deployed contract
 *
 * @param name Length of the domain name
 * @param contract The deployer ZNSPriceOracle contract
 * @param isRootDomain Flag if this is root or subdomain
 * @returns The expected price for that domain
 */
export const getPrice = async (
  name : string,
  contract : ZNSPriceOracle,
  isRootDomain : boolean
) : Promise<BigNumber> => {
  // Get price configuration for contract
  const params = await contract.priceConfig();

  const maxPrice = isRootDomain
    ? params.maxRootDomainPrice
    : params.maxSubdomainPrice;

  const baseLength = isRootDomain
    ? params.baseRootDomainLength
    : params.baseSubdomainLength;

  if (BigNumber.from(name.length).lte(baseLength)) {
    return maxPrice;
  }

  const maxLength = isRootDomain
    ? params.maxRootDomainLength
    : params.maxSubdomainLength;

  const minPrice = isRootDomain
    ? params.minRootDomainPrice
    : params.minSubdomainPrice;

  if (BigNumber.from(name.length).gt(maxLength)) {
    return minPrice;
  }

  const numerator = maxPrice.mul(baseLength).mul(params.priceMultiplier);
  const denominator = (params.priceMultiplier.mul(3).add(name.length));

  const expectedPrice = numerator.div(denominator).div(100);

  return expectedPrice;
};

/**
 * Get the domain name price, the registration fee and the total
 * based on name length when given an already deployed contract
 *
 * @param name Length of the domain name
 * @param contract The deployer ZNSPriceOracle contract
 * @param isRootDomain Flag if this is root or subdomain
 * @returns The full expected price object for that domain
 */
export const getPriceObject = async (
  name : string,
  contract : ZNSPriceOracle,
  isRootDomain : boolean
) : Promise<{
  totalPrice : BigNumber;
  expectedPrice : BigNumber;
  fee : BigNumber;
}> => {
  const expectedPrice = await getPrice(name, contract, isRootDomain);

  const fee = await contract.getRegistrationFee(expectedPrice);
  const totalPrice = expectedPrice.add(fee);

  return {
    totalPrice,
    expectedPrice,
    fee,
  };
};

/**
 * Get a specific named event from a transaction log
 *
 * @param txReceipt The transaction receipt
 * @param eventName The name of the event to get
 * @returns The event data, if found
 */
export const getEvent = async (
  txReceipt : ContractReceipt,
  eventName : string
) : Promise<Array<Event> | undefined> => {
  const customEvent = txReceipt.events?.filter(event => {
    if (event.event === eventName) return event;
  });

  return customEvent;
};

// TODO need?
// TODO move all hashing to the namehash library
// const hashWithParent = (parentHash: string, domainName: string): string => {
//   const nameBytes = ethers.utils.formatBytes32String(domainName);
//   const nameHash = ethers.utils.solidityKeccak256(["bytes"], [nameBytes]);
//   const packed = ethers.utils.solidityPack(["bytes32", "bytes32"], [parentHash, nameHash]);
//   const hash = ethers.utils.solidityKeccak256(["bytes32"], [packed]);

//   return hash;
// }

export const getDomainHash = async (
  txReceipt : ContractReceipt,
  eventName  = "DomainRegistered"
) : Promise<string> => {
  const customEvent = txReceipt.events?.find(event => {
    if (event.event === eventName) return event;
  });

  if (!customEvent) throw Error("Event not found");

  const domainHash = customEvent.args?.domainHash;

  if (!domainHash) throw Error("No domainHash on event");

  return domainHash;
};

export const getTokenId = async (
  txReceipt : ContractReceipt,
  eventName  = "DomainRegistered"
) : Promise<BigNumber> => {
  const tokenId = await getDomainHash(txReceipt, eventName);
  return BigNumber.from(tokenId);
};