import path from "path";

// ZChain Testnet URLs
export const ZCHAIN_TEST_BRIDGE_API_URL = "https://wilderworld-dev-erigon1-bridge-api.eu-north-2.gateway.fm";
export const ZCHAIN_TEST_RPC_URL = "https://wilderworld-dev-erigon1-rpc.eu-north-2.gateway.fm/";

export const ZCHAIN_TEST_BRIDGE_ADDRESS = "0xbE57e0450ae99b62997f2F4731bF8D950e06D124";

// Bridge API endpoints
export const GET_BRIDGE_DEPOSIT_DATA_EP = "/bridges/";
export const MERKLE_PROOF_EP = "/merkle-proof";

export type TBridgeApiOp = "deposit" | "proof";
export const BridgeApiOps : { [key in TBridgeApiOp] : TBridgeApiOp; } = {
  deposit: "deposit",
  proof: "proof",
};

export const TEMP_DATA_DIR_PATH = path.join(process.cwd(), "./test-data");
export const getTempDataFilePath = (opName : TBridgeApiOp) =>
  path.join(TEMP_DATA_DIR_PATH, `bridge-${opName}.json`);
