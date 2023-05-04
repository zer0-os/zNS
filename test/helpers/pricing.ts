import { ZNSPriceOracle } from "../../typechain";
import { BigNumber } from "ethers";

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
  isRootDomain : boolean,
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
  isRootDomain : boolean,
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