/* eslint-disable @typescript-eslint/no-var-requires, camelcase */
import * as hre from "hardhat";
import axios from "axios";
import { ErrorDecoder } from "ethers-decode-error";
import { receiverAddress } from "./addresses.json";
import * as ethers from "ethers";
import { ZNSSubRegistrar, ZNSSubRegistrar__factory } from "../../typechain";
import { DEFAULT_TOKEN_URI, distrConfigEmpty, paymentConfigEmpty } from "../helpers";


// TODO multi: make this into something usable or delete
const mekrleProofString = "/merkle-proof";
const getClaimsFromAcc = "/bridges/";
const zChainBridgeApiUrl = "https://zchain-testnet-bridge-api.eu-north-2.gateway.fm/";
const zChainRpcUrl = "https://zchain-testnet-rpc.eu-north-2.gateway.fm/";
const zChainTestBridgeAddress = "0x528e26b25a34a4A5d0dbDa1d57D318153d2ED582";



const main = async () => {
  // launch HH script with "--network zchaintest" flag to get this!
  const [deployerZChain] = await hre.ethers.getSigners();

  // const bridgeArt = require("./PolygonZkEVMBridgeV2.json");
  // const bridgeContract = new hre.ethers.Contract(zChainTestBridgeAddress, bridgeArt.abi, deployerZChain);
  const bridgeFactory = await hre.ethers.getContractFactory("PolygonZkEVMBridgeV2", deployerZChain);
  const bridgeContract = bridgeFactory.attach(zChainTestBridgeAddress) as PolygonZkEVMBridgeV2;

  const axio = axios.create({ baseURL: zChainBridgeApiUrl });
  const result = await axio.get(
    getClaimsFromAcc + receiverAddress,
    { params: { limit: 100, offset: 0 } }
  );

  const { data: { deposits } } = result;

  console.log("Deposits acquired:", JSON.stringify(deposits, null, "\t"));

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

    console.log("Proof acquired:", JSON.stringify(proof, null, "\t"));

    const errorDecoder = ErrorDecoder.create([bridgeContract.interface]);
    let tx;
    try {
      // claim message
      tx = await bridgeContract.claimMessage(
        proof.merkle_proof,
        proof.rollup_merkle_proof,
        latestDeposit.global_index,
        proof.main_exit_root,
        proof.rollup_exit_root,
        latestDeposit.orig_net,
        latestDeposit.orig_addr,
        latestDeposit.dest_net,
        latestDeposit.dest_addr,
        latestDeposit.amount,
        latestDeposit.metadata
      );
    } catch (error) {
      const decoded = await errorDecoder.decode(error);
      console.error("Claim failed!", decoded);
    }

    console.log(`Claim sent successfully! Tx hash: ${tx.hash}`);
    const rec = await tx.wait();
    console.log(`Claim message mined! Tx receipt: ${rec}`);
  } else {
    console.log("Bridged message NOT ready for claim!");
  }

  console.log("Claim process completed successfully!");
};


const register = async () => {
  const [caller] = await hre.ethers.getSigners();
  const fact = new ZNSSubRegistrar__factory(caller);
  const znsSubRegistrar = fact.attach("0x0629076F9851dd5AE881d2d68790E4b7176aB5fd") as ZNSSubRegistrar;

  const parentHash = "0x4d7459e21a4603da1084e91d4d1ec4f0255be54312073d256d7f1881c81c167d";
  const label = "subone";

  const tx = await znsSubRegistrar.registerSubdomain(
    parentHash,
    label,
    caller.address,
    DEFAULT_TOKEN_URI,
    distrConfigEmpty,
    paymentConfigEmpty,
  );
  const receipt = await tx.wait();


  console.log("Subdomain registered successfully!", JSON.stringify(receipt, null, "\t"));
};

// register().catch(error => {
//   console.error(error);
//   process.exit(1);
// });
