import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  IZNSContracts,
  ZNSContract,
} from "../../src/deploy/campaign/types";


export const setACTests = ({
  zns,
  contract,
} : {
  zns : IZNSContracts;
  contract : ZNSContract;
}) => {
  let deployer : SignerWithAddress;
  let user : SignerWithAddress;
  let admin : SignerWithAddress;

  describe("#setAccessController", () => {
    beforeEach(async () => {
      [deployer, user, admin] = await ethers.getSigners();
    });

    it("should allow ADMIN to set a valid AccessController", async () => {
      await zns.rootRegistrar.connect(deployer).setAccessController(zns.accessController.target);

      const currentAccessController = await zns.rootRegistrar.getAccessController();

      expect(currentAccessController).to.equal(zns.accessController.target);
    });

    it("should allow re-setting the AccessController to another valid contract", async () => {
      expect(
        await zns.rootRegistrar.getAccessController()
      ).to.equal(
        zns.accessController.target
      );

      const ZNSAccessControllerFactory = await hre.ethers.getContractFactory("ZNSAccessController", deployer);
      const newAccessController = await ZNSAccessControllerFactory.deploy(
        [deployer.address],
        [deployer.address]
      );

      // then change the AccessController
      await zns.rootRegistrar.connect(deployer).setAccessController(newAccessController.target);

      expect(
        await zns.rootRegistrar.getAccessController()
      ).to.equal(
        newAccessController.target
      );
    });

    it("should emit AccessControllerSet event when setting a valid AccessController", async () => {
      await expect(
        zns.rootRegistrar.connect(deployer).setAccessController(zns.accessController.target)
      ).to.emit(
        zns.rootRegistrar,
        "AccessControllerSet"
      ).withArgs(zns.accessController.target);
    });

    it("should revert when a non-ADMIN tries to set AccessController", async () => {
      await expect(
        zns.rootRegistrar.connect(user).setAccessController(zns.accessController.target)
      ).to.be.revertedWithCustomError(
        zns.rootRegistrar,
        AC_UNAUTHORIZED_ERR
      ).withArgs(user.address, ADMIN_ROLE);
    });

    it("should revert when setting an AccessController as EOA address", async () => {
      await expect(
        zns.rootRegistrar.connect(deployer).setAccessController(user.address)
      ).to.be.revertedWithCustomError(
        zns.rootRegistrar,
        AC_WRONGADDRESS_ERR
      ).withArgs(user.address);
    });

    it("should revert when setting an AccessController as another non-AC contract address", async () => {
      await expect(
        zns.rootRegistrar.connect(deployer).setAccessController(zns.rootRegistrar.target)
      ).to.be.revertedWithCustomError(
        zns.rootRegistrar,
        AC_WRONGADDRESS_ERR
      ).withArgs(zns.rootRegistrar.target);
    });

    it("should revert when setting a zero address as AccessController", async () => {
      await expect(
        zns.rootRegistrar.connect(admin).setAccessController(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(
        zns.rootRegistrar,
        AC_WRONGADDRESS_ERR
      ).withArgs(ethers.ZeroAddress);
    });
  });
};