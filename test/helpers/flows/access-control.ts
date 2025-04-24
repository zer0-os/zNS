import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ZNSContract } from "../../../src/deploy/campaign/types";
import { ZNSAccessController } from "../../../typechain";
import { expect } from "chai";
import { ethers } from "hardhat";


export const testSetAC = ({
  contract,
  accessController,
  signers: [
    deployer,
    admin,
    user1,
    user2,
  ],
} : {
  contract : ZNSContract;
  accessController : ZNSAccessController;
  signers : Array<SignerWithAddress>;
}) => {
  describe("#setAccessController", () => {

    it("should allow ADMIN to set a valid AccessController", async () => {
      await contract.connect(deployer).setAccessController(accessController.target);

      const currentAccessController = await contract.getAccessController();

      expect(currentAccessController).to.equal(accessController.target);
    });

    it("should allow re-setting the AccessController to another valid contract", async () => {
      expect(
        await contract.getAccessController()
      ).to.equal(
        accessController.target
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
        contract.connect(deployer).setAccessController(accessController.target)
      ).to.emit(
        contract,
        "AccessControllerSet"
      ).withArgs(accessController.target);
    });

    it("should revert when a non-ADMIN tries to set AccessController", async () => {
      await expect(
        contract.connect(user2).setAccessController(accessController.target)
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
};
