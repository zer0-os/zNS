/* eslint-disable @typescript-eslint/no-var-requires */
import * as hre from "hardhat";
import path from "path";


const networkIDzChainTest = 1668201165;

const deployData = path.join(__dirname, "./addresses.json");
export const { senderAddress, receiverAddress } = require(deployData);


const main = async () => {
  const [deployerSepolia] = await hre.ethers.getSigners();

  const senderFact = await hre.ethers.getContractFactory("BridgeSender", deployerSepolia);
  const bridgeSender = senderFact.attach(senderAddress);

  const forceUpdateGlobalExitRoot = true; // fast bridge
  const message = "0://zero-bridge";

  const tx = await bridgeSender.bridgeMessage(
    networkIDzChainTest,
    receiverAddress,
    forceUpdateGlobalExitRoot,
    message
  );

  console.log("Transaction receipt:\n", await tx.wait());

  console.log("Message bridged successfully!");
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
