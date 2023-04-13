import { BigNumber } from "ethers";
import { ZNSPriceOracle } from "../../typechain";

/**
 * Helper function to get the domain name price base on its length when given
 * an already deployed contract
 *
 * @param length Length of the domain name
 * @param contract The deployer ZNSPriceOracle contract
 */
export const getPrice = async (length: number, contract: ZNSPriceOracle, isRootDomain: boolean): Promise<BigNumber> => {

  const basePrice = isRootDomain ? await contract.rootDomainBasePrice() : await contract.subdomainBasePrice();
  const baseLength = await contract.baseLength();
  const multiplier = await contract.priceMultiplier();

  const numerator = basePrice.mul(baseLength).mul(multiplier);
  const denominator = length + (3 * multiplier);

  const expectedPrice = numerator.div(denominator).div(100);
  return expectedPrice;
};