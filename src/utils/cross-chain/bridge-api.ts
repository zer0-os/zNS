/* eslint-disable @typescript-eslint/no-var-requires, camelcase, no-shadow, @typescript-eslint/no-explicit-any */
import axios from "axios";
import { GET_BRIDGE_DEPOSIT_DATA_EP, MERKLE_PROOF_EP, ZCHAIN_TEST_BRIDGE_API_URL } from "./constants";
import path from "path";
import fs from "fs";


export const baseApiGET = async ({
  apiURL,
  endpoint,
  params,
} : {
  apiURL : string;
  endpoint : string;
  params ?: any;
}) => {
  const axio = axios.create({
    baseURL: apiURL,
  });

  return axio.get(endpoint, { params });
};

export const getBridgeDepositData = async ({
  apiURL = ZCHAIN_TEST_BRIDGE_API_URL,
  endpoint = GET_BRIDGE_DEPOSIT_DATA_EP,
  destAddress,
  params = { limit: 100, offset: 0 },
} : {
  apiURL ?: string;
  endpoint ?: string;
  destAddress : string;
  params ?: any;
}) => {
  const result = await baseApiGET({
    apiURL,
    endpoint: `${endpoint}${destAddress}`,
    params,
  });

  const { data: { deposits } } = result;

  return deposits;
};

export const getMerkeProof = async ({
  apiURL = ZCHAIN_TEST_BRIDGE_API_URL,
  endpoint = MERKLE_PROOF_EP,
  depositCnt,
  netId,
} : {
  apiURL ?: string;
  endpoint ?: string;
  depositCnt : number;
  netId : number;
}) => {
  const result = await baseApiGET({
    apiURL,
    endpoint,
    params: { deposit_cnt: depositCnt, net_id: netId },
  });

  const { data: { proof } } = result;

  return proof;
};

const main = async (args : Array<string>) => {
  let apiDataReturn : string;

  switch (args[0]) {
  case "deposit":
    const destAddress = args[1];

    const deposits = await getBridgeDepositData({ destAddress });
    console.log("Deposits acquired:", JSON.stringify(deposits, null, "\t"));
    apiDataReturn = JSON.stringify(deposits[deposits.length - 1], null, "\t");
    break;

  case "proof":
    const depositCnt = Number(args[1]);
    const netId = Number(args[2]);

    let proof = await getMerkeProof({ depositCnt, netId });
    proof = JSON.stringify(proof, null, "\t");
    console.log("Proof acquired:", proof);
    apiDataReturn = proof;
    break;

  default:
    throw new Error("Invalid arguments!");
  }

  if (args[args.length - 1] === "save" && apiDataReturn) {
    const pathToDir = path.join(process.cwd(), "./test-data");
    const pathToFile = path.join(pathToDir, `bridge-${args[0]}.json`);

    if (!fs.existsSync(pathToDir)) {
      fs.mkdirSync(pathToDir);
    }

    fs.writeFileSync(pathToFile, apiDataReturn);
  }
};

const args = process.argv.slice(2);

main(args)
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
