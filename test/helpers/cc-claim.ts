/* eslint-disable camelcase */
import fs from "fs";
import { BridgeApiOps, getTempDataFilePath } from "../../src/utils/cross-chain/constants";
import { getBridgeDepositData, getMerkeProof } from "../../src/utils/cross-chain/bridge-api";


// These helpers only return data for a single deposit only
// they use whatever has been saved last to local files after running `bridge-get` script
export const getSavedBridgeApiData = async ({
  destAddress,
  depositCnt,
} : {
  destAddress ?: string;
  depositCnt ?: string;
}) => {
  let deposit;
  let proof;

  if (!destAddress) {
    const rawDeposit = fs.readFileSync(
      getTempDataFilePath(BridgeApiOps.deposit)
    );
    deposit = JSON.parse(rawDeposit.toString());
    if (depositCnt) {
      deposit = deposit.find((d : { deposit_cnt : string; }) => d.deposit_cnt === depositCnt);
    }

    const rawProof = fs.readFileSync(
      getTempDataFilePath(BridgeApiOps.proof)
    );
    proof = JSON.parse(rawProof.toString());
  } else {
    const deposits = await getBridgeDepositData({ destAddress });
    deposit = deposits[deposits.length - 1];

    const { deposit_cnt, orig_net } = deposit;
    proof = await getMerkeProof({ depositCnt: deposit_cnt, netId: orig_net });
  }

  return {
    deposit,
    proof,
  };
};

export const getClaimArgsFromApi = async ({
  destAddress,
  depositCnt,
} : {
  destAddress ?: string;
  depositCnt ?: string;
}) => {
  const { deposit, proof } = await getSavedBridgeApiData({ destAddress, depositCnt });

  return [
    proof.merkle_proof,
    proof.rollup_merkle_proof,
    deposit.global_index,
    proof.main_exit_root,
    proof.rollup_exit_root,
    deposit.orig_net,
    deposit.orig_addr,
    deposit.dest_net,
    deposit.dest_addr,
    deposit.amount,
    deposit.metadata,
  ];
};
