import {BigNumber} from "ethers";
import {ZNSPriceOracle} from "../../typechain";

/**
 * Helper function to get the domain name price base on its length when given
 * an already deployed contract
 *
 * @param name Length of the domain name
 * @param contract The deployer ZNSPriceOracle contract
 */
export const getPrice = async (
  name: string,
  contract: ZNSPriceOracle,
  isRootDomain: boolean
): Promise<BigNumber> => {
  const basePrice = isRootDomain
    ? await contract.rootDomainBasePrice()
    : await contract.subdomainBasePrice();

  const baseLength = isRootDomain
    ? await contract.rootDomainBaseLength()
    : await contract.subdomainBaseLength();

  if (name.length <= baseLength) {
    return basePrice;
  }

  const multiplier = await contract.priceMultiplier();

  const numerator = basePrice
    .mul(baseLength)
    .mul(multiplier);
  const denominator = multiplier.mul(3).add(name.length);

  const expectedPrice = numerator.div(denominator).div(100);
  return expectedPrice;
};

/**
 * The ens lib takes the inverse of our domain name format to 
 * produce the same namehash as the one produced from our 
 * registrar contract, so we need to inverse the input here. 
 * 
 */ 
export const reverseInputName = (name: string) => {
  const splitName = name.split(".");
  const reversedName = splitName.reverse();
  return reversedName.join(".");
};
