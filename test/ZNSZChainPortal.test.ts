import * as hre from "hardhat";
import { expect } from "chai";
import { DEFAULT_TOKEN_URI, DEST_PORTAL_NOT_SET_ERR } from "./helpers";
import { IZNSSigner } from "../src/deploy/campaign/types";
import { ZNSZChainPortal } from "../typechain";


// TODO multi: add more tests here !!
describe("ZNSZChainPortal", () => {
  let deployAdmin : IZNSSigner;
  let randomAcc : IZNSSigner;

  let zChainPortal : ZNSZChainPortal;

  before(async () => {
    [deployAdmin, randomAcc] = await hre.ethers.getSigners();

    const fact = await hre.ethers.getContractFactory("ZNSZChainPortal");
    zChainPortal = await hre.upgrades.deployProxy(
      fact,
      [
        1n,
        "test",
        2n,
        randomAcc.address,
        {
          accessController: randomAcc.address,
          registry: randomAcc.address,
          chainResolver: randomAcc.address,
          treasury: randomAcc.address,
          rootRegistrar: randomAcc.address,
          subRegistrar: randomAcc.address,
        },
      ]
    ) as unknown as ZNSZChainPortal;
  });

  it("#registerAndBridgeDomain() should revert if `destZnsPortal` is not set", async () => {
    const curPortal = await zChainPortal.destZnsPortal();

    expect(curPortal).to.eq(hre.ethers.ZeroAddress);

    await expect(
      zChainPortal.connect(deployAdmin).registerAndBridgeDomain(
        hre.ethers.ZeroHash,
        "test",
        DEFAULT_TOKEN_URI,
      )
    ).to.be.revertedWithCustomError(zChainPortal, DEST_PORTAL_NOT_SET_ERR);
  });
});
