import * as hre from "hardhat";
import { SafeKit } from "./safeKit"

// Gnosis Safe Modules
import SafeApiKit, { ProposeTransactionProps } from '@safe-global/api-kit'
import Safe from '@safe-global/protocol-kit'
import { MetaTransactionData, OperationType } from "@safe-global/types-kit";
import { getDBAdapter, getZNSFromDB } from "./database";
import { ROOT_COLL_NAME, ROOT_DOMAIN_BULK_SELECTOR, SUB_COLL_NAME, SUBDOMAIN_BULK_SELECTOR, SAFE_TRANSFER_FROM_SELECTOR } from "./constants";
import { Domain, IRootDomainRegistrationArgs, ISubdomainRegisterArgs, SafeKitConfig } from "./types";
import { connectToDb, createBatches } from "./helpers";
import { ZeroAddress } from "ethers";
import { getZNS } from "./zns-contract-data";

// TEMP DEBUG
import { ERC20Mock__factory, ERC20Mock } from "../../../typechain";

// todo extract db connection to a separate file
// Options
// 1. generate json, upload manually
// 2. generate and propose programmatically
// 3. generate, propose, sign, execute programmatically
// 4. use EOA to form and call to contract directly

// Using Safe API Kit and Protocol Kit
const main = async () => {
  const [ migrationAdmin ] = await hre.ethers.getSigners();

  const config : SafeKitConfig = {
    network : hre.network.name,
    chainId: BigInt(process.env.SEPOLIA_CHAIN_ID!),
    rpcUrl: process.env.SEPOLIA_RPC_URL!,
    safeAddress: process.env.TEST_SAFE_ADDRESS!,
    safeOwnerAddress: migrationAdmin.address,
    // txServiceUrl: process.env.ZCHAIN_TX_SERVICE_URL!,
  }

  const safeKit = await SafeKit.init(config);

  // Confirm connection
  // console.log(await safeKit.apiKit.getServiceInfo());

  // If admin given is not a Safe owner, fail early to avoid unnecessary work
  if (hre.network.name !== "hardhat" && !await safeKit.isOwner(migrationAdmin.address)) {
    throw new Error("Migration admin is not a Safe owner");
  }

  // TODO for testing, get from DB when zns is deployed on zchain
  // let zns : IZNSContractsLocal | IZNSContracts

  // if (hre.network.name === "hardhat") {
  //   const params : DeployZNSParams = {
  //     deployer: migrationAdmin,
  //     governorAddresses: [migrationAdmin.address],
  //     adminAddresses: [migrationAdmin.address],
  //   };

  //   zns = await deployZNS(params);
  // } else {
  //   zns = await getZNS(migrationAdmin, hre.network.name !== "zchain" ? "test" : "prod");
  // }

  // accepted tx on etherscan format
  // [["asdasd","0x635AbDF6E4378f50c3A8D787d7f59340E706ab52","0x635AbDF6E4378f50c3A8D787d7f59340E706ab52","http.123.io",["0x0000000000000000000000000000000000000000",0,0],["0x0000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000"]]]


  // Temp debug testing, hardcode for now
  // TODO fix zdc, use that
  const rootRegistrar = "0xbe15446794E0cEBEC370d00d301A72cb75068838";
  const subRegistrar = "0x6Eb2344b7a1d90B1b23706CC109b55a95d0c5dad";
  const domainToken = "0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c";
  const treasury = "0xC870eC58b6CB64E7E4Ae5770C60d29b0423397dC";
  const meow = "0xe8B51C9dF670361B12F388A9147C952Afc9eA071";

  const factory = new ERC20Mock__factory(migrationAdmin);
  const meowToken = factory.attach(meow) as ERC20Mock;

  // TODO we have to recreate the dist and payment configs
  // for creating subdomains, how will that work if new chain?

  // Give funds to safe
  // TODO checks first
  // on zchain, each tx is 0.1 - 0.25 gas
  // will need 75 (round up) * 0.25 gas
  // const mintTx = await meowToken.mint(config.safeAddress, hre.ethers.parseEther("1000000000"));
  // await mintTx.wait(hre.network.name !== "hardhat" ? 3 : 0);

  // Approve the treasury to spend the Safe's MEOW tokens
  // const approveTx = await meowToken.approve(treasury, hre.ethers.parseEther("1000000000"));
  // await approveTx.wait(hre.network.name !== "hardhat" ? 3 : 0);

  const client = await connectToDb();

  console.log("Getting root domains from db...");
  const rootDomains = await client.collection(ROOT_COLL_NAME).find().toArray() as unknown as Domain[];
  
  // console.log("Getting subdomains from db...");
  // const subdomains = await client.collection(SUB_COLL_NAME).find().sort({ depth: 1, _id: 1}).toArray() as unknown as Domain[];

  console.log("Creating root domain register and transfer batches...");
  const [ rootBatches, rootTransfers ] = createBatches(rootDomains.slice(100,120), ROOT_DOMAIN_BULK_SELECTOR) as [ string[], string [] ];
  
  // console.log("Creating subdomain register and transfer batches...");
  // const [ subBatches, subTransfers ] = createBatches(subdomains, SUBDOMAIN_BULK_SELECTOR) as [ string[], string[] ];

  // The value of what the next nonce should be
  const currentNonce = await safeKit.protocolKit.getNonce();

  // Form tx, sign, and propose each batch to Safe
  console.log("Proposing all batches to Safe...");
  for (const [index, txData] of [ ...rootBatches ].entries()) { //  ...subBatches, ...rootTransfers, ...subTransfers]
    let proposalData : ProposeTransactionProps;

    if (txData.slice(0,10) === ROOT_DOMAIN_BULK_SELECTOR) {
      proposalData = await safeKit.createSignedTx(
        // zns.rootRegistrar.target.toString(),
        rootRegistrar, // to should be... ? safe? registrar?
        txData,
        currentNonce + index,
      );
    // } else if (txData.slice(0,10) === SUBDOMAIN_BULK_SELECTOR) {
    //   proposalData = await safeKit.createSignedTx(
    //     // zns.subRegistrar.target.toString(),
    //     subRegistrar,
    //     txData,
    //     currentNonce + index,

    //   );
    // } else if (txData.slice(0,10) === TRANSFER_FROM_SELECTOR) {
    //   proposalData = await safeKit.createSignedTx(
    //     // zns.domainToken.target.toString(),
    //     domainToken,
    //     txData,
    //     currentNonce + index,
    //   );
    } else {
      throw new Error(`Unknown transaction data selector: ${txData.slice(0,10)}`);
    }

    // if (index % 50 === 0) {
      console.log(`Proposing batch tx: ${index} for: ${txData.slice(0,10)}`);
    // }

    // Successfully created proposal data, but updated zns with bulk func is not on sepolia
    // need to deploy this first

    // Don't bother actually proposing on hardhat, not real
    // if (hre.network.name !== "hardhat") {
      await safeKit.proposeTx(proposalData);
    // }

    console.log(""); // break after first proposal
  }

  console.log("All batches proposed to Safe");
}


main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  process.exit(0);
});