import { forkNetwork } from "./fork";
import * as ethers from "ethers";


export const forkRpcUrlBase = "https://rpc.tenderly.co/fork";

export const createPlayground = async ({
  networkId = "1",
  blockNumber = 14537885,
} = {}) => {
  const forkId = await forkNetwork({
    networkId,
    blockNumber,
  });

  const forkURL = `${forkRpcUrlBase}/${forkId}`;

  return new ethers.providers.JsonRpcProvider(forkURL);
};
