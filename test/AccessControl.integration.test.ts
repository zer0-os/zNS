import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import * as hre from "hardhat";
import { DEFAULT_PRICE_CONFIG, deployZNS, IZNSContractsLocal } from "./helpers";
import { ethers } from "hardhat";


describe.only("AccessControl Integration", () => {
  let deployer : SignerWithAddress;
  let admin : SignerWithAddress;
  let user1 : SignerWithAddress;
  let user2 : SignerWithAddress;
  let zeroVault : SignerWithAddress;

  let zns : IZNSContractsLocal;

  before(async () => {
    [deployer, admin, user1, user2, zeroVault] = await hre.ethers.getSigners();

    zns = await deployZNS({
      deployer,
      governorAddresses: [deployer.address, deployer.address],
      adminAddresses: [admin.address],
      priceConfig: DEFAULT_PRICE_CONFIG,
      zeroVaultAddress: zeroVault.address,
    });
  });

  it("Common Access Control functions", async () => {
    for (
      const [key, contract] of
      Object.entries(zns).filter(([key, c]) =>
        c !== zns.accessController &&
        c !== zns.meowToken &&
        c !== zns.zeroVaultAddress
      )
    ) {
      describe(`${key} #setAccessController`, () => {
        it("should allow ADMIN to set a valid AccessController", async () => {
          await contract.connect(deployer).setAccessController(zns.accessController.target);

          const currentAccessController = await contract.getAccessController();

          expect(currentAccessController).to.equal(zns.accessController.target);
        });

        it("should allow re-setting the AccessController to another valid contract", async () => {
          expect(
            await contract.getAccessController()
          ).to.equal(
            zns.accessController.target
          );

          const ZNSAccessControllerFactory = await ethers.getContractFactory("ZNSAccessController", deployer);
          const newAccessController = await ZNSAccessControllerFactory.deploy(
            [deployer.address],
            [deployer.address]
          );

          // then change the AccessController
          await contract.connect(deployer).setAccessController(newAccessController.target);

          expect(
            await contract.getAccessController()
          ).to.equal(
            newAccessController.target
          );
        });

        it("should emit AccessControllerSet event when setting a valid AccessController", async () => {
          await expect(
            contract.connect(deployer).setAccessController(zns.accessController.target)
          ).to.emit(
            contract,
            "AccessControllerSet"
          ).withArgs(zns.accessController.target);
        });

        it("should revert when a non-ADMIN tries to set AccessController", async () => {
          await expect(
            contract.connect(user2).setAccessController(zns.accessController.target)
          ).to.be.reverted;
        });

        it("should revert when setting an AccessController as EOA address", async () => {
          await expect(
            contract.connect(deployer).setAccessController(user1.address)
          ).to.be.reverted;
        });

        it("should revert when setting an AccessController as another non-AC contract address", async () => {
          await expect(
            contract.connect(deployer).setAccessController(contract.target)
          ).to.be.reverted;
        });

        it("should revert when setting a zero address as AccessController", async () => {
          await expect(
            contract.connect(admin).setAccessController(ethers.ZeroAddress)
          ).to.be.reverted;
        });
      });
    }
  });
});