import { IZNSSigner } from "../src/deploy/campaign/types";
import {
  PolygonZkEVMBridgeV2Mock__factory,
  ZNSAccessController,
  ZNSAccessController__factory,
  ZNSEthereumPortal,
  ZNSEthereumPortal__factory,
} from "../typechain";
import * as hre from "hardhat";
import { expect } from "chai";
import { AC_UNAUTHORIZED_ERR, ZERO_ADDRESS_ERR } from "./helpers";


describe("ZNSEthereumPortal", () => {
  let deployAdmin : IZNSSigner;
  let randomAcc : IZNSSigner;

  let ethPortal : ZNSEthereumPortal;
  let accessController : ZNSAccessController;

  let ethPortalFactory : ZNSEthereumPortal__factory;

  before(async () => {
    [deployAdmin, randomAcc] = await hre.ethers.getSigners();

    ethPortalFactory = new ZNSEthereumPortal__factory(deployAdmin);
    const acFactory = new ZNSAccessController__factory(deployAdmin);
    const bridgeFactory = new PolygonZkEVMBridgeV2Mock__factory(deployAdmin);

    const bridge = await bridgeFactory.deploy();

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
});
