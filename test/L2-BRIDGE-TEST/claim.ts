/* eslint-disable @typescript-eslint/no-var-requires, camelcase */
import * as hre from "hardhat";
import axios from "axios";
import { zChainTestBridgeAddress } from "./deploy";
import { receiverAddress } from "./send";


const mekrleProofString = "/merkle-proof";
const getClaimsFromAcc = "/bridges/";
const zChainBridgeApiUrl = "https://zchain-testnet-bridge.eu-north-2.gateway.fm";

const main = async () => {
  const [deployerZChain] = await hre.ethers.getSigners();

  const bridgeFactory = await hre.ethers.getContractFactory("PolygonZkEVMBridgeV2", deployerZChain);
  const bridgeContract = bridgeFactory.attach(zChainTestBridgeAddress);

  const axio = axios.create({ baseURL: zChainBridgeApiUrl });
  const { data: { deposits } } = await axio.get(
    getClaimsFromAcc + receiverAddress,
    { params: { limit: 100, offset: 0 } }
  );

  const latestDeposit = deposits[deposits.length - 1];
  if (latestDeposit.ready_for_claim) {
    const { data: { proof } } = await axio.get(
      mekrleProofString,
      {
        params: {
          deposit_cnt: latestDeposit.deposit_cnt,
          net_id: latestDeposit.orig_net,
        },
      }
    );

    // claim message
    const tx = await bridgeContract.claimMessage(
      proof.merkle_proof,
      latestDeposit.deposit_cnt,
      proof.main_exit_root,
      proof.rollup_exit_root,
      latestDeposit.orig_net,
      latestDeposit.dest_addr,
      latestDeposit.dest_net,
      latestDeposit.dest_addr,
      latestDeposit.amount,
      latestDeposit.metadata
    );

    console.log(`Claim sent successfully! Tx hash: ${tx.hash}`);
    const rec = await tx.wait();
    console.log(`Claim message mined! Tx receipt: ${rec}`);
  } else {
    console.log("Bridged message NOT ready for claim!");
  }

  console.log("Claim process completed successfully!");
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
