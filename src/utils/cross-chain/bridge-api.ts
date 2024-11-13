import axios from "axios";
import { GET_BRIDGE_DEPOSIT_DATA_EP, MERKLE_PROOF_EP, ZCHAIN_TEST_BRIDGE_API_URL } from "./constants";


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

const args = process.argv.slice(2);

switch (args[0]) {
case "deposit":
  const destAddress = args[1];

  getBridgeDepositData({ destAddress })
    .then(deposits => {
      console.log("Deposits acquired:", JSON.stringify(deposits, null, "\t"));
    })
    .catch(error => {
      console.error("Error acquiring deposits!", error);
    });
  break;

case "proof":
  const depositCnt = Number(args[1]);
  const netId = Number(args[2]);

  getMerkeProof({ depositCnt, netId })
    .then(proof => {
      console.log("Proof acquired:", JSON.stringify(proof, null, "\t"));
    })
    .catch(error => {
      console.error("Error acquiring proof!", error);
    });
  break;

default:
  console.error("Invalid arguments!");
  break;
}
