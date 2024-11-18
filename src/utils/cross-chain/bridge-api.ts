/* eslint-disable @typescript-eslint/no-var-requires, camelcase, no-shadow, @typescript-eslint/no-explicit-any */
import axios from "axios";
import {
  BridgeApiOps,
  GET_BRIDGE_DEPOSIT_DATA_EP, getTempDataFilePath,
  MERKLE_PROOF_EP, TBridgeApiOp,
  TEMP_DATA_DIR_PATH,
  ZCHAIN_TEST_BRIDGE_API_URL,
} from "./constants";
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
}) : Promise<Array<any>> => {
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

export const getSaveBridgeApiResponse = async (args : Array<string>) => {
  let apiDataReturn : string;
  const op = args[0] as TBridgeApiOp;

  switch (op) {
  case BridgeApiOps.deposit:
    const destAddress = args[1];

    const deposits = await getBridgeDepositData({ destAddress });
    console.log("Deposits acquired:", JSON.stringify(deposits, null, "\t"));
    apiDataReturn = JSON.stringify(deposits, null, "\t");
    break;

  case BridgeApiOps.proof:
    const depositCnt = Number(args[1]);
    const netId = Number(args[2]);

    let proof = await getMerkeProof({ depositCnt, netId });
    proof = JSON.stringify(proof, null, "\t");
    console.log("Proof acquired:", proof);
    apiDataReturn = proof;
    break;

  default:
    throw new Error("Invalid operation argument!");
  }

  if (args[args.length - 1] === "save" && apiDataReturn) {
    const pathToFile = getTempDataFilePath(op);

    if (!fs.existsSync(TEMP_DATA_DIR_PATH)) {
      fs.mkdirSync(TEMP_DATA_DIR_PATH);
    }

    fs.writeFileSync(pathToFile, apiDataReturn);
  }
};
