import * as hre from "hardhat";
import { expect } from "chai";
import { DEFAULT_TOKEN_URI, DEST_PORTAL_NOT_SET_ERR, ZERO_ADDRESS_ERR } from "./helpers";
import { IZNSSigner } from "../src/deploy/campaign/types";
import { ZNSZChainPortal, ZNSZChainPortal__factory } from "../typechain";


// TODO multi: add more tests here !!
describe("ZNSZChainPortal", () => {
  let deployAdmin : IZNSSigner;
  let randomAcc : IZNSSigner;

  let zChainPortal : ZNSZChainPortal;

  let zChainPortalFactory : ZNSZChainPortal__factory;

  before(async () => {
    [deployAdmin, randomAcc] = await hre.ethers.getSigners();

    zChainPortalFactory = await hre.ethers.getContractFactory("ZNSZChainPortal");
    zChainPortal = await hre.upgrades.deployProxy(
      zChainPortalFactory,
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

  it("should revert when initialized with 0x0 as any of the addresses", async () => {
    const contracts = {
      accessController: randomAcc.address,
      registry: randomAcc.address,
      chainResolver: randomAcc.address,
      treasury: randomAcc.address,
      rootRegistrar: randomAcc.address,
      subRegistrar: randomAcc.address,
    };

    await expect(
      hre.upgrades.deployProxy(
        zChainPortalFactory,
        [
          1n,
          "test",
          2n,
          hre.ethers.ZeroAddress,
          contracts,
        ]
      )
    ).to.be.revertedWithCustomError(zChainPortal, ZERO_ADDRESS_ERR);

    await Object.keys(contracts).reduce(
      async (acc, key) => {
        await acc;

        await expect(
          hre.upgrades.deployProxy(
            zChainPortalFactory,
            [
              1n,
              "test",
              2n,
              hre.ethers.ZeroAddress,
              {
                ...contracts,
                [key]: hre.ethers.ZeroAddress,
              },
            ]
          )
        ).to.be.revertedWithCustomError(zChainPortal, ZERO_ADDRESS_ERR);
      }, Promise.resolve()
    );
  });
});
