import * as hre from 'hardhat';

import { SafeKit } from "./safeKit"
import { Domain, SafeKitConfig } from './types';
import { ROOT_COLL_NAME } from './constants';
import { connect } from './helpers';

import { createSafeClient } from '@safe-global/sdk-starter-kit'
import { ERC20Mock, ERC20Mock__factory, ZNSRootRegistrar__factory } from '../../../typechain';
import assert from 'assert';
import { ZeroAddress, zeroPadBytes } from 'ethers';

import Safe, * as protoKit from '@safe-global/protocol-kit';
import { ZERO_VALUE_FIXED_PRICE_CONFIG_BYTES } from '../../../test/helpers';
import { getZNS } from './zns-contract-data';

// const rootRegistrar = "0xbe15446794E0cEBEC370d00d301A72cb75068838";
// const subRegistrar = "0x6Eb2344b7a1d90B1b23706CC109b55a95d0c5dad";
// const domainToken = "0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c";
// const treasury = "0xC870eC58b6CB64E7E4Ae5770C60d29b0423397dC";
// const meowToken = "0xe8B51C9dF670361B12F388A9147C952Afc9eA071";

const main = async () => {
  const [ safeOwnerAdmin ] = await hre.ethers.getSigners();
  const safeAddress = process.env.TEST_SAFE_ADDRESS!;
  const config : SafeKitConfig = {
    network : hre.network.name,
    chainId: BigInt(process.env.SEPOLIA_CHAIN_ID!),
    rpcUrl: process.env.SEPOLIA_RPC_URL!,
    safeAddress,
    safeOwnerAddress: safeOwnerAdmin.address,
    // txServiceUrl: process.env.ZCHAIN_TX_SERVICE_URL!,
  }

  const safeKit = await SafeKit.init(config);


  // const zns = await getZNS(safeOwnerAdmin, "test");

  // Also for comparison, using the safe core sdk client
  const safeClient = await createSafeClient({
    provider: config.rpcUrl,
    signer: process.env.TEST_SAFE_OWNER!, // private key
    safeAddress: config.safeAddress,
  });

  // const factory = new ERC20Mock__factory(safeOwnerAdmin);
  // const meowTokenContract = factory.attach(meowToken) as ERC20Mock;

  // const balanceBefore = await meowTokenContract.balanceOf(safeOwnerAdmin.address);


  const client = await connect();

  // console.log("Getting root domains from db...");
  // const rootDomains = await client.collection(ROOT_COLL_NAME).find().toArray() as unknown as Domain[];
  // const domainA = rootDomains[55]; // manually minted 0 domain // For now, just take the first one
  // const domainB = rootDomains[1]; // For now, just take the first one
  const domain1 = {
    name: "1aslkasdawdlkajhge",
    domainAddress: safeOwnerAdmin.address,
    tokenOwner: safeOwnerAdmin.address,
    tokenURI: "https://example.com/metadata/1",
    distrConfig: {
      pricerContract: ZeroAddress,
      paymentType: 0,
      accessType: 1,
      priceConfig: "0x"
    },
    paymentConfig: {
      token: ZeroAddress,
      beneficiary: ZeroAddress
    }
  }


   // is issue coming from setting of root price config?
   // we minted yesterday though...?

  const domain2 = {
    name: "2asdukhgialkj",
    domainAddress: safeOwnerAdmin.address,
    tokenOwner: safeOwnerAdmin.address,
    tokenURI: "https://example.com/metadata/1",
    distrConfig: {
      pricerContract: ZeroAddress,
      paymentType: 0,
      accessType: 1,
      priceConfig: "0x",  
    },
    paymentConfig: {
      token: ZeroAddress,
      beneficiary: ZeroAddress
    }
  }

  const txDataBulk = ZNSRootRegistrar__factory.createInterface().encodeFunctionData(
    "registerRootDomainBulk",
    [
      [ domain1, domain2 ] // try one or multiple
    ]
  );

  const txDataSingle = ZNSRootRegistrar__factory.createInterface().encodeFunctionData(
    "registerRootDomain",
    [
      domain1
    ]
  );

  const rootReg = "0xDA82a047B77F945454b49ad6C6Da34A6141AB118"

  const transactions = [{
    // to: await zns.rootRegistrar.getAddress(),
    // rootRegister
    to: rootReg,
    data: txDataSingle,
    value: '0'
  }];

  const protocolKit = await Safe.init({
    provider: config.rpcUrl,
    signer: process.env.TEST_SAFE_OWNER!,
    safeAddress: config.safeAddress
  });

  const safeTx = await protocolKit.createTransaction({
    transactions,
  });

  const safeTxHash = await protocolKit.getTransactionHash(safeTx);
  const signature = await protocolKit.signHash(safeTxHash);

  // const estimatedGas = await hre.ethers.provider.estimateGas({
  //   from: safeAddress,
  //   to: rootReg,
  //   data: safeTx.data.data,
  // });

  // try propose, then try execute?
  // console.log("Proposing transaction...");
  //   await safeKit.apiKit.proposeTransaction({
  //     safeAddress: process.env.TEST_SAFE_ADDRESS!,
  //     safeTransactionData: safeTx.data,
  //     safeTxHash,
  //     senderAddress: config.safeOwnerAddress, // safe itself?
  //     senderSignature: signature.data
  //   });

  const response = await protocolKit.executeTransaction(safeTx);

    // await apiKit.proposeTransaction(txProposeData);



  // const multiSendData = protoKit.encodeMultiSendData(transactions);

  // const multiContract = await protoKit.getMultiSendContract

  // const txResult = await safeClient.send({ transactions })

  // const safeTxHash = txResult.transactions?.safeTxHash;

  // const balanceAfter = await meowTokenContract.balanceOf(safeOwnerAdmin.address);

  
  process.exit(0);
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  process.exit(0);
});