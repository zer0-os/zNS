import { ethers } from "ethers";

export const getEther = async (
  walletAddress : string,
  amountHex = ethers.hexValue(100), // hex encoded wei amount
  provider : ethers.providers.JsonRpcProvider,
) : Promise<void> => {
  const params = [
    [walletAddress],
    amountHex,
  ];

  await provider.send("tenderly_addBalance", params);
};