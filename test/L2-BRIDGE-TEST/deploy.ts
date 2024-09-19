import path from "path";
import * as hre from "hardhat";
import fs from "fs";
import { ethers } from "ethers";


const sepoliaBridgeAddress = "0x528e26b25a34a4A5d0dbDa1d57D318153d2ED582";
const zChainTestBridgeAddress = "0x528e26b25a34a4A5d0dbDa1d57D318153d2ED582";
const zChainRpcUrl = "https://zchain-testnet-rpc.eu-north-2.gateway.fm/";


const main = async () => {
  const [deployerSepolia] = await hre.ethers.getSigners();

  const providerZChain = new ethers.JsonRpcProvider(zChainRpcUrl);
  const deployerZChain = new ethers.Wallet(`0x${process.env.TESTNET_PRIVATE_KEY_A}`, providerZChain);

  // deploy BridgeSender contract to Sepolia
  const senderFactory = await hre.ethers.getContractFactory("BridgeSender", deployerSepolia);
  const senderContract = await senderFactory.deploy(sepoliaBridgeAddress);
  await senderContract.waitForDeployment();
  console.log("BridgeSender deployed to:", senderContract.target);

  // deploy BridgeReceiver contract to ZChain
  const receiverFactory = await hre.ethers.getContractFactory("BridgeReceiver", deployerZChain);
  const receiverContract = await receiverFactory.deploy(zChainTestBridgeAddress);
  await receiverContract.waitForDeployment();
  console.log("BridgeReceiver deployed to:", receiverContract.target);

  await hre.run("verify:verify", {
    address: receiverContract.target,
    constructorArguments: [zChainTestBridgeAddress],
  });

  // Write output
  // ! Please note that this will OVERWRITE whatever was in the file,
  // copy the file or change this code to keep the previous data
  // Contract are already deployed and can be accessed by addresses from addresses.json!
  const outputJson = {
    senderAddress: senderContract.target,
    receiverAddress: receiverContract.target,
  };
  console.log(`Contract data: ${JSON.stringify(outputJson, null, "\t")}`);

  const pathOutputJson = path.join(__dirname, "./addresses.json");
  fs.writeFileSync(pathOutputJson, JSON.stringify(outputJson, null, "\t"));
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
