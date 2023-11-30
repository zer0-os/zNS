import { ethers } from "ethers";

export const getEther = async (
  walletAddress : string,
  amountHex = ethers.toBeHex(100), // hex encoded wei amount
  provider : ethers.JsonRpcProvider,
) : Promise<void> => {
  const params = [
    [walletAddress],
    amountHex,
  ];

  await provider.send("tenderly_addBalance", params);
};