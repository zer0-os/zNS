/* eslint-disable @typescript-eslint/no-var-requires */
import * as hre from "hardhat";
import path from "path";
import { BridgeSender } from "../../typechain";


const networkIDzChainTest = 19n;

const deployData = path.join(__dirname, "./addresses.json");
const { senderAddress, receiverAddress } = require(deployData);


const main = async () => {
  const [deployerSepolia] = await hre.ethers.getSigners();

  const senderFact = await hre.ethers.getContractFactory("BridgeSender", deployerSepolia);
  const bridgeSender = senderFact.attach(senderAddress) as BridgeSender;

  const forceUpdateGlobalExitRoot = true; // fast bridge
  const message = "0://setstatestringdomain"; // change this string for test calls

  const tx = await bridgeSender.bridgeMessage(
    networkIDzChainTest,
    receiverAddress,
    forceUpdateGlobalExitRoot,
    message
  );

  console.log("Transaction receipt:\n", await tx.wait());

  console.log("Message bridged successfully!");
};

// main().catch(error => {
//   console.error(error);
//   process.exit(1);
// });
