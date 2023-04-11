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

  const defaultPrice = isRootDomain ? await contract.rootDomainBasePrice() : await contract.subdomainBasePrice();
  const defaultMultiplier = await contract.priceMultiplier();

  const expectedPrice = (defaultPrice.mul(defaultMultiplier)).div(length).div(10);
  return expectedPrice;
};