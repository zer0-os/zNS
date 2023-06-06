import { ZNSPriceOracle } from "../../typechain";
import { BigNumber } from "ethers";
import { percentageMulti } from "./constants";

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
  contract : ZNSPriceOracle
) : Promise<BigNumber> => {
  // Get price configuration for contract
  const {
    maxPrice,
    minPrice,
    baseLength,
    maxLength,
    priceMultiplier,
    precisionMultiplier,
  } = await contract.rootDomainPriceConfig();

  if (BigNumber.from(name.length).lte(baseLength)) {
    return maxPrice;
  }

  if (BigNumber.from(name.length).gt(maxLength)) {
    return minPrice;
  }

  const numerator = maxPrice.mul(baseLength).mul(priceMultiplier);
  const denominator = (priceMultiplier.mul(3).add(name.length));

  // TODO ora: test that the calcs here and on contract are correct!!!
  const expectedPrice = numerator.div(denominator)
    .div(percentageMulti.mul(precisionMultiplier))
    .mul(precisionMultiplier);

  return expectedPrice;
};

/**
 * Get the domain name price, the registration fee and the total
 * based on name length when given an already deployed contract
 *
 * @param name Length of the domain name
 * @param contract The deployer ZNSPriceOracle contract
 * @returns The full expected price object for that domain
 */
export const getPriceObject = async (
  name : string,
  contract : ZNSPriceOracle,
) : Promise<{
  totalPrice : BigNumber;
  expectedPrice : BigNumber;
  fee : BigNumber;
}> => {
  const expectedPrice = await getPrice(name, contract);

  const fee = await contract.getRegistrationFee(expectedPrice);
  const totalPrice = expectedPrice.add(fee);

  return {
    totalPrice,
    expectedPrice,
    fee,
  };
};