// TODO: Move all the Tenderly related logic from here to it's own repo/package

import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const {
  TENDERLY_ACCOUNT_ID,
  TENDERLY_PROJECT_SLUG,
  TENDERLY_ACCESS_KEY,
} = process.env;

const TENDERLY_FORK_API =
  `http://api.tenderly.co/api/v1/account/${TENDERLY_ACCOUNT_ID}/project/${TENDERLY_PROJECT_SLUG}/fork`;

const opts = {
  headers: {
    "X-Access-Key": TENDERLY_ACCESS_KEY as string,
  },
};


export const forkNetwork = async ({
  networkId = "1",
  blockNumber = 14537885,
} = {}) => {
  const body = {
    "network_id": networkId,
    "block_number": blockNumber,
  };

  const {
    data: {
      simulation_fork: {
        id: forkId,
      },
    },
  } = await axios.post(TENDERLY_FORK_API, body, opts);

  const forkURL = `${TENDERLY_FORK_API}/${forkId}`;
  console.log(`FORK URL: ${forkURL}`);

  return forkId;
};

export const deleteFork = async (forkURL : string) =>
  axios.delete(forkURL, opts);
