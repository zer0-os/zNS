import { IZNSSigner } from "../src/deploy/campaign/types";
import {
  PolygonZkEVMBridgeV2Mock,
  PolygonZkEVMBridgeV2Mock__factory,
  ZNSAccessController,
  ZNSAccessController__factory,
  ZNSEthereumPortal,
  ZNSEthereumPortal__factory,
} from "../typechain";
import * as hre from "hardhat";
import { expect } from "chai";
import {
  AC_UNAUTHORIZED_ERR,
  DEFAULT_TOKEN_URI,
  hashDomainLabel,
  INITIALIZED_ERR,
  INVALID_CALLER_ERR,
  MESSAGE_FAILED_ERR,
  NETWORK_ID_L1_TEST_DEFAULT,
  NETWORK_ID_L2_TEST_DEFAULT,
  ZERO_ADDRESS_ERR,
} from "./helpers";


describe("ZNSEthereumPortal", () => {
  let deployAdmin : IZNSSigner;
  let randomAcc : IZNSSigner;

  let ethPortal : ZNSEthereumPortal;
  let accessController : ZNSAccessController;
  let bridge : PolygonZkEVMBridgeV2Mock;

  let ethPortalFactory : ZNSEthereumPortal__factory;

  const dummySmtProof = Array.from({ length: 32 }, () => hre.ethers.randomBytes(32));
  let bridgedEventData : {
    leafType : bigint;
    originNetwork : bigint;
    originAddress : string;
    destinationNetwork : bigint;
    destinationAddress : string;
    amount : bigint;
    metadata : string;
    depositCount : bigint;
  };

  before(async () => {
    [deployAdmin, randomAcc] = await hre.ethers.getSigners();

    ethPortalFactory = new ZNSEthereumPortal__factory(deployAdmin);
    const acFactory = new ZNSAccessController__factory(deployAdmin);
    const bridgeFactory = new PolygonZkEVMBridgeV2Mock__factory(deployAdmin);

    bridge = await bridgeFactory.deploy();

    accessController = await acFactory.deploy(
      [deployAdmin.address],
      [deployAdmin.address]
    );

    ethPortal = await hre.upgrades.deployProxy(
      ethPortalFactory,
      [
        accessController.target,
        bridge.target,
        randomAcc.address,
        randomAcc.address,
        randomAcc.address,
        randomAcc.address,
        randomAcc.address,
      ],
      {
        kind: "uups",
      }
    ) as unknown as ZNSEthereumPortal;

    bridgedEventData = {
      leafType : 1n,
      originNetwork: NETWORK_ID_L2_TEST_DEFAULT,
      originAddress : bridge.target as string,
      destinationNetwork : NETWORK_ID_L1_TEST_DEFAULT,
      destinationAddress : ethPortal.target as string,
      amount : 1n,
      metadata : "empty[]",
      depositCount : 1n,
    };
  });

  it("should revert when initialized with 0x0 as any of the addresses", async () => {
    const contracts = new Array(7).fill(randomAcc.address);

    await contracts.reduce(
      async (acc, cur, i) => {
        contracts[i] = hre.ethers.ZeroAddress;

        await expect(
          hre.upgrades.deployProxy(
            ethPortalFactory,
            contracts,
          )
        ).to.be.revertedWithCustomError(ethPortal, ZERO_ADDRESS_ERR);
      }, Promise.resolve()
    );
  });

  it("#setSrcZnsPortal() should revert if called by non-admin", async () => {
    await expect(
      ethPortal.connect(randomAcc).setSrcZnsPortal(randomAcc.address)
    ).to.be.revertedWithCustomError(accessController, AC_UNAUTHORIZED_ERR);
  });

  it("#setSrcZnsPortal() should set the `srcZnsPortal` address", async () => {
    await ethPortal.connect(deployAdmin).setSrcZnsPortal(randomAcc.address);

    const srcZnsPortal = await ethPortal.srcZnsPortal();
    expect(srcZnsPortal).to.eq(randomAcc.address);
  });

  it("#setSrcZnsPortal() should revert when passing 0x0 address", async () => {
    await expect(
      ethPortal.connect(deployAdmin).setSrcZnsPortal(hre.ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(accessController, ZERO_ADDRESS_ERR);
  });


  it("#initialize() should revert when trying to reinitialize", async () => {
    await expect(
      ethPortal.connect(deployAdmin).initialize(
        accessController.target,
        bridge.target,
        randomAcc.address,
        randomAcc.address,
        randomAcc.address,
        randomAcc.address,
        randomAcc.address,
      )
    ).to.be.revertedWithCustomError(ethPortal, INITIALIZED_ERR);
  });

  it("#onMessageReceived() should revert when called by non-ZkEvmBridge", async () => {
    await expect(
      ethPortal.connect(deployAdmin).onMessageReceived(
        bridge.target,
        1n,
        hre.ethers.ZeroHash,
      )
    ).to.be.revertedWithCustomError(ethPortal, INVALID_CALLER_ERR);
  });

  it("#onMessageReceived() should revert when `originAddress` is something OTHER than ZChainPortal", async () => {
    // this will fail with MessageFailed error from the Bridge since it does a `.call()` internally
    await expect(
      // this will call onMessageReceived(), we have to do it like this to avoid
      // reverting on the `InvalidCaller` check
      bridge.connect(deployAdmin).claimMessage(
        dummySmtProof,
        dummySmtProof,
        bridgedEventData.depositCount,
        dummySmtProof[0],
        dummySmtProof[1],
        bridgedEventData.originNetwork,
        bridgedEventData.originAddress,
        bridgedEventData.destinationNetwork,
        bridgedEventData.destinationAddress,
        bridgedEventData.amount,
        dummySmtProof[2],
      )
    ).to.be.revertedWithCustomError(bridge, MESSAGE_FAILED_ERR);
  });

  it("#onMessageReceived() should revert when proof's `domainHash` is incorrect", async () => {
    // make wrong metadata
    const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();
    const wrongMetadata = abiCoder.encode(
      ["tuple(bytes32,bytes32,string,address,string)"],
      [[
        hashDomainLabel("wrong"), // this hashes a different label from the one below
        hre.ethers.ZeroHash,
        "right",
        randomAcc.address,
        DEFAULT_TOKEN_URI,
      ]]
    );

    await expect(
      bridge.claimMessage(
        dummySmtProof,
        dummySmtProof,
        bridgedEventData.depositCount,
        dummySmtProof[0],
        dummySmtProof[1],
        bridgedEventData.originNetwork,
        bridgedEventData.originAddress,
        bridgedEventData.destinationNetwork,
        bridgedEventData.destinationAddress,
        bridgedEventData.amount,
        wrongMetadata,
      )
    ).to.be.revertedWithCustomError(bridge, MESSAGE_FAILED_ERR);
  });
});
