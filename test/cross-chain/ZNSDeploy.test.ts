import assert from "assert";
import { expect } from "chai";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSCampaignConfig, IZNSContracts } from "../../src/deploy/campaign/types";
import { MongoDBAdapter, resetMongoAdapter } from "@zero-tech/zdc";
import { Wallet } from "ethers";
import { getConfig } from "../../src/deploy/campaign/environments";
import { runZnsCampaign } from "../../src/deploy/zns-campaign";
import { SupportedChains } from "../../src/deploy/missions/contracts/cross-chain/portals/get-portal-dm";
import { PolygonZkEVMBridgeV2Mock } from "../../typechain";
import { setDefaultEnvironment } from "../../src/environment/set-env";


export const NETWORK_ID_L1_TEST_DEFAULT = 0n;
export const NETWORK_ID_L2_TEST_DEFAULT = 1n;
export const ZCHAIN_ID_TEST_DEFAULT = 2012605151n;

describe("ZNS Cross-Chain Deploy Test", () => {
  let znsL1 : IZNSContracts;
  let znsL2 : IZNSContracts;

  let configL1 : IZNSCampaignConfig<SignerWithAddress | Wallet>;
  let configL2 : IZNSCampaignConfig<Wallet | SignerWithAddress>;

  let dbAdapter1 : MongoDBAdapter;
  let dbAdapter2 : MongoDBAdapter;

  let deployAdmin : SignerWithAddress;

  let predeployedBridge : PolygonZkEVMBridgeV2Mock;

  before(async () => {
    [ deployAdmin ] = await hre.ethers.getSigners();

    // set ENV vars for the Ethereum ZNS deployment
    process.env.SRC_CHAIN_NAME = SupportedChains.eth;
    process.env.MOCK_ZKEVM_BRIDGE = "true";
    process.env.NETWORK_ID = NETWORK_ID_L1_TEST_DEFAULT.toString();
    process.env.BRIDGE_TOKEN = hre.ethers.ZeroAddress;
    process.env.DEST_NETWORK_ID = NETWORK_ID_L2_TEST_DEFAULT.toString();
    process.env.DEST_CHAIN_NAME = SupportedChains.z;
    process.env.DEST_CHAIN_ID = ZCHAIN_ID_TEST_DEFAULT.toString();

    // L1 run
    configL1 = await getConfig({
      deployer: deployAdmin,
      zeroVaultAddress: deployAdmin.address,
    });

    const campaignL1 = await runZnsCampaign({ config: configL1 });

    ({
      state: {
        contracts: znsL1,
      },
      dbAdapter: dbAdapter1,
    } = campaignL1);

    // TODO multi: do we need to break this up into 2 DBs or make 2 collections for one DB ??
    //  so we don't have to specify the ENV var every time? or is it fine as is ??
    resetMongoAdapter();

    // set ENV vars for ZChain ZNS deployment
    process.env.SRC_CHAIN_NAME = SupportedChains.z;
    process.env.SRC_ZNS_PORTAL = znsL1.zChainPortal.target as string;
    process.env.MONGO_DB_NAME = "zns-l2";

    // for L2 we are deploying the Bridge separately, so that we can test
    // that the L2 campaign properly picks up the deployed Bridge from chain
    const bridgeFact = await hre.ethers.getContractFactory("PolygonZkEVMBridgeV2Mock");
    predeployedBridge = await hre.upgrades.deployProxy(
      bridgeFact,
      [
        NETWORK_ID_L2_TEST_DEFAULT,
        deployAdmin.address,
      ]
    ) as unknown as PolygonZkEVMBridgeV2Mock;
    // now we need to set the proper ENV vars so that it's picked up by the L2 campaign
    process.env.MOCK_ZKEVM_BRIDGE = "false";
    process.env.ZK_EVM_BRIDGE = predeployedBridge.target as string;
    // we are setting these as such to make sure state is set from the parameters passed
    // to the individual deploy above
    process.env.NETWORK_ID = "";
    process.env.BRIDGE_TOKEN = "";

    // L2 run
    configL2 = await getConfig({
      deployer: deployAdmin,
      zeroVaultAddress: deployAdmin.address,
    });

    // emulating L2 here by deploying to the same network
    const campaignL2 = await runZnsCampaign({ config: configL2 });

    ({
      state: {
        contracts: znsL2,
      },
      dbAdapter: dbAdapter2,
    } = campaignL2);
  });

  after(async () => {
    await dbAdapter1.dropDB();
    await dbAdapter2.dropDB();
    setDefaultEnvironment();
  });

  it("should deploy a mocked zkEVM Bridge if MOCK_ZKEVM_BRIDGE is 'true'", async () => {
    // this happens in znsL1 deploy
    assert.ok(configL1.crosschain.mockZkEvmBridge, "mockZkEvmBridge for L1 is set incorrectly!");

    const { zkEvmBridge } = znsL1;
    expect(zkEvmBridge.target).to.not.be.undefined;

    const networkIdFromBridge = await zkEvmBridge.networkID();
    const tokenFromBridge = await zkEvmBridge.WETHToken();

    // same params as set in the ENV before deploying znsL1
    expect(networkIdFromBridge).to.equal(NETWORK_ID_L1_TEST_DEFAULT);
    expect(tokenFromBridge).to.equal(hre.ethers.ZeroAddress);
  });

  it("should pick up an already deployed zkEVM Bridge from chain if MOCK_ZKEVM_BRIDGE is 'false'", async () => {
    // this happens in znsL2 deploy
    assert.ok(!configL2.crosschain.mockZkEvmBridge, "mockZkEvmBridge for L2 is set incorrectly!");

    const { zkEvmBridge } = znsL2;
    expect(zkEvmBridge.target).to.eq(predeployedBridge.target);

    const networkIdFromBridge = await zkEvmBridge.networkID();
    const tokenFromBridge = await zkEvmBridge.WETHToken();

    // same params as passed to the `deployProxy` call above
    // where we separately deploy the Bridge before running the L2 campaign
    expect(networkIdFromBridge).to.equal(NETWORK_ID_L2_TEST_DEFAULT);
    expect(tokenFromBridge).to.equal(deployAdmin.address);
  });
});
