import * as hre from "hardhat";
import { expect } from "chai";
import {
  AC_UNAUTHORIZED_ERR,
  DEFAULT_TOKEN_URI,
  DEST_PORTAL_NOT_SET_ERR,
  INITIALIZED_ERR,
  ZERO_ADDRESS_ERR,
} from "./helpers";
import { IZNSSigner } from "../src/deploy/campaign/types";
import {
  ZNSAccessController,
  ZNSAccessController__factory,
  ZNSZChainPortal,
  ZNSZChainPortal__factory,
} from "../typechain";


// TODO multi: add more tests here !!
describe("ZNSZChainPortal", () => {
  let deployAdmin : IZNSSigner;
  let randomAcc : IZNSSigner;
  let gov;

  let zChainPortal : ZNSZChainPortal;
  let zAccessController : ZNSAccessController;

  let zChainPortalFactory : ZNSZChainPortal__factory;
  let zAccessControllerFactory : ZNSAccessController__factory;


  before(async () => {
    [deployAdmin, randomAcc, gov] = await hre.ethers.getSigners();

    zAccessControllerFactory = await hre.ethers.getContractFactory("ZNSAccessController");
    zAccessController = await zAccessControllerFactory.deploy(
      [gov],
      [deployAdmin]
    );

    zChainPortalFactory = await hre.ethers.getContractFactory("ZNSZChainPortal");
    zChainPortal = await hre.upgrades.deployProxy(
      zChainPortalFactory,
      [
        1n,
        "test",
        2n,
        randomAcc.address,
        {
          accessController: await zAccessController.getAddress(),
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

  it("#initialize() should revert when trying to reinitialize", async () => {
    await expect(
      zChainPortal.initialize(
        "1",
        "Z",
        "1",
        hre.ethers.ZeroAddress,
        {
          accessController: randomAcc.address,
          registry: randomAcc.address,
          chainResolver: randomAcc.address,
          treasury: randomAcc.address,
          rootRegistrar: randomAcc.address,
          subRegistrar: randomAcc.address,
        },
      )
    ).to.be.revertedWithCustomError(zChainPortal, INITIALIZED_ERR);
  });

  it("#setDestZnsPortal() should revert when called by non-ADMIN", async () => {
    await expect(
      zChainPortal.connect(randomAcc).setDestZnsPortal(randomAcc)
    ).to.be.revertedWithCustomError(zAccessController, AC_UNAUTHORIZED_ERR);
  });

  it("#setDestZnsPortal() should revert when setting 0x0 address", async () => {
    await expect(
      zChainPortal.connect(deployAdmin).setDestZnsPortal(hre.ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(zChainPortal, ZERO_ADDRESS_ERR);
  });

  it("#setDestZnsPortal() should set the destination portal address", async () => {
    await zChainPortal.connect(deployAdmin).setDestZnsPortal(randomAcc.address);

    const destPortal = await zChainPortal.destZnsPortal();
    expect(
      destPortal
    ).to.equal(
      randomAcc.address
    );
  });
});
