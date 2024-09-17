import path from "path";
import * as hre from "hardhat";
import fs from "fs";


export const sepoliaBridgeAddress = "0x528e26b25a34a4A5d0dbDa1d57D318153d2ED582";
export const zChainTestBridgeAddress = "0x528e26b25a34a4A5d0dbDa1d57D318153d2ED582";
export const zChainRpcUrl = "https://zchain-testnet-rpc.eu-north-2.gateway.fm";


const main = async () => {
  const [deployerSepolia] = await hre.ethers.getSigners();
  const providerZChain = new hre.ethers.JsonRpcProvider(zChainRpcUrl);
  const deployerZChain = new hre.ethers.Wallet(`0x${process.env.Z_CHAIN_PRIVATE_KEY}`, providerZChain);

  // deploy BridgeSender contract
  const senderFactory = await hre.ethers.getContractFactory("BridgeSender", deployerSepolia);
  const senderContract = await senderFactory.deploy(sepoliaBridgeAddress);
  await senderContract.waitForDeployment();
  console.log("BridgeSender deployed to:", senderContract.target);

  // deploy BridgeReceiver contract
  const receiverFactory = await hre.ethers.getContractFactory("BridgeReceiver", deployerZChain);
  const receiverContract = await receiverFactory.deploy(zChainTestBridgeAddress);
  await receiverContract.waitForDeployment();
  console.log("BridgeReceiver deployed to:", receiverContract.target);

  // Write output
  const outputJson = {
    senderAddress: senderContract.target,
    receiverAddress: receiverContract.target,
  };

  const pathOutputJson = path.join(__dirname, "./addresses.json");
  fs.writeFileSync(pathOutputJson, JSON.stringify(outputJson, null, "\t"));
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
