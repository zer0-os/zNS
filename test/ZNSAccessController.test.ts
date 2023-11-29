import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ZNSAccessController } from "../typechain";
import { deployAccessController } from "./helpers";
import { expect } from "chai";
import { getAccessRevertMsg } from "./helpers/errors";
import { ADMIN_ROLE, EXECUTOR_ROLE, GOVERNOR_ROLE, REGISTRAR_ROLE } from "../src/deploy/constants";
import { ethers } from "hardhat";


describe("ZNSAccessController", () => {
  let deployer : SignerWithAddress;
  let accessController : ZNSAccessController;
  let governorAccs : Array<SignerWithAddress>;
  let adminAccs : Array<SignerWithAddress>;
  let randomAccs : Array<SignerWithAddress>;

  beforeEach(async () => {
    const accounts = await hre.ethers.getSigners();
    deployer = accounts[0];
    governorAccs = accounts.slice(1, 4);
    adminAccs = accounts.slice(4, 7);
    randomAccs = accounts.slice(7, 10);

    accessController = await deployAccessController({
      deployer,
      governorAddresses: governorAccs.map(acc => acc.address),
      adminAddresses: adminAccs.map(acc => acc.address),
    });
  });

  describe("Initial Setup", () => {
    it("Should assign GOVERNORs correctly", async () => {
      await governorAccs.reduce(
        async (acc, { address } : SignerWithAddress) => {
          const hasRole = await accessController.hasRole(GOVERNOR_ROLE, address);
          expect(hasRole).to.be.true;
        }, Promise.resolve()
      );
    });

    it("Should assign ADMINs correctly", async () => {
      await adminAccs.reduce(
        async (acc, { address } : SignerWithAddress) => {
          const hasRole = await accessController.hasRole(ADMIN_ROLE, address);
          expect(hasRole).to.be.true;
        }, Promise.resolve()
      );
    });

    it("Should revert when passing 0x0 address to assing roles", async () => {
      await expect(
        deployAccessController({
          deployer,
          governorAddresses: [ ethers.ZeroAddress ],
          adminAddresses: [ ethers.ZeroAddress ],
        })
      ).to.be.revertedWith("ZNSAccessController: Can't grant role to zero address");
    });
  });

  describe("Role Management from the Initial Setup", () => {
    it("GOVERNOR_ROLE should be able to grant GOVERNOR_ROLE", async () => {
      const [ governor ] = governorAccs;
      const [ { address: newGovernor } ] = randomAccs;
      await accessController.connect(governor).grantRole(GOVERNOR_ROLE, newGovernor);

      const hasRole = await accessController.hasRole(GOVERNOR_ROLE, newGovernor);
      expect(hasRole).to.be.true;
    });

    it("GOVERNOR_ROLE should be able to revoke GOVERNOR_ROLE", async () => {
      const [ governor ] = governorAccs;
      const [ { address: existingGovernor } ] = governorAccs;
      await accessController.connect(governor).revokeRole(GOVERNOR_ROLE, existingGovernor);

      const hasRole = await accessController.hasRole(GOVERNOR_ROLE, existingGovernor);
      expect(hasRole).to.be.false;
    });

    it("GOVERNOR_ROLE should be able to grant ADMIN_ROLE", async () => {
      const [ governor ] = governorAccs;
      const [ { address: newAdmin } ] = randomAccs;
      await accessController.connect(governor).grantRole(ADMIN_ROLE, newAdmin);

      const hasRole = await accessController.hasRole(ADMIN_ROLE, newAdmin);
      expect(hasRole).to.be.true;
    });

    it("GOVERNOR_ROLE should be able to revoke ADMIN_ROLE", async () => {
      const [ governor ] = governorAccs;
      const [ { address: existingAdmin } ] = adminAccs;
      await accessController.connect(governor).revokeRole(ADMIN_ROLE, existingAdmin);

      const hasRole = await accessController.hasRole(ADMIN_ROLE, existingAdmin);
      expect(hasRole).to.be.false;
    });

    it("ADMIN_ROLE should NOT be able to grant ADMIN_ROLE", async () => {
      const [ admin ] = adminAccs;
      const [ { address: newAdmin } ] = randomAccs;
      await expect(
        accessController.connect(admin).grantRole(ADMIN_ROLE, newAdmin)
      ).to.be.revertedWith(
        getAccessRevertMsg(admin.address, GOVERNOR_ROLE)
      );
    });

    it("ADMIN_ROLE should NOT be able to revoke ADMIN_ROLE", async () => {
      const [ admin ] = adminAccs;
      const [ { address: existingAdmin } ] = adminAccs;
      await expect(
        accessController.connect(admin).revokeRole(ADMIN_ROLE, existingAdmin)
      ).to.be.revertedWith(
        getAccessRevertMsg(admin.address, GOVERNOR_ROLE)
      );
    });

    it("ADMIN_ROLE should NOT be able to grant GOVERNOR_ROLE", async () => {
      const [ admin ] = adminAccs;
      const [ { address: newGovernor } ] = randomAccs;
      await expect(
        accessController.connect(admin).grantRole(GOVERNOR_ROLE, newGovernor)
      ).to.be.revertedWith(
        getAccessRevertMsg(admin.address, GOVERNOR_ROLE)
      );
    });

    it("ADMIN_ROLE should NOT be able to revoke GOVERNOR_ROLE", async () => {
      const [ admin ] = adminAccs;
      const [ { address: existingGovernor } ] = governorAccs;
      await expect(
        accessController.connect(admin).revokeRole(GOVERNOR_ROLE, existingGovernor)
      ).to.be.revertedWith(
        getAccessRevertMsg(admin.address, GOVERNOR_ROLE)
      );
    });

    it("ADMIN_ROLE should be able to grant REGISTRAR_ROLE", async () => {
      const [ admin ] = adminAccs;
      const [ { address: newRegistrar } ] = randomAccs;
      await accessController.connect(admin).grantRole(REGISTRAR_ROLE, newRegistrar);
      const has = await accessController.hasRole(REGISTRAR_ROLE, newRegistrar);
      expect(has).to.be.true;
    });

    it("ADMIN_ROLE should be able to revoke REGISTRAR_ROLE", async () => {
      const [ admin ] = adminAccs;
      const [ { address: newRegistrar } ] = randomAccs;
      await accessController.connect(admin).grantRole(REGISTRAR_ROLE, newRegistrar);

      await accessController.connect(admin).revokeRole(REGISTRAR_ROLE, newRegistrar);
      const has = await accessController.hasRole(REGISTRAR_ROLE, newRegistrar);
      expect(has).to.be.false;
    });

    it("GOVERNOR_ROLE should be able to assign new EXECUTOR_ROLE as admin for REGISTRAR_ROLE", async () => {
      const [ governor ] = governorAccs;
      await accessController.connect(governor).setRoleAdmin(REGISTRAR_ROLE, EXECUTOR_ROLE);

      const registrarAdminRole = await accessController.getRoleAdmin(REGISTRAR_ROLE);
      expect(registrarAdminRole).to.be.equal(EXECUTOR_ROLE);
    });

    // eslint-disable-next-line max-len
    it("GOVERNOR_ROLE should be able to make himself a new EXECUTOR_ROLE's admin and assign this role to anyone", async () => {
      const [ governor ] = governorAccs;
      const [ { address: newOperator } ] = randomAccs;

      await accessController.connect(governor).setRoleAdmin(EXECUTOR_ROLE, GOVERNOR_ROLE);
      const roleAdminFrom = await accessController.getRoleAdmin(EXECUTOR_ROLE);
      expect(roleAdminFrom).to.be.equal(GOVERNOR_ROLE);

      await accessController.connect(governor).grantRole(EXECUTOR_ROLE, newOperator);
      const has = await accessController.hasRole(EXECUTOR_ROLE, newOperator);
      expect(has).to.be.true;
    });

    it("Should revert when setting role admin without GOVERNOR_ROLE", async () => {
      const [ { address: random } ] = randomAccs;
      await expect(
        accessController.connect(random).setRoleAdmin(REGISTRAR_ROLE, EXECUTOR_ROLE)
      ).to.be.revertedWith(
        getAccessRevertMsg(random, GOVERNOR_ROLE)
      );
    });
  });

  describe("Role Validator Functions", () => {
    it("#isAdmin() should return true for ADMIN_ROLE", async () => {
      const [ admin ] = adminAccs;
      const isAdmin = await accessController.isAdmin(admin.address);
      expect(isAdmin).to.be.true;
    });

    it("#isRegistrar() should return true for REGISTRAR_ROLE", async () => {
      const [ registrar ] = randomAccs;
      await accessController.connect(adminAccs[0]).grantRole(REGISTRAR_ROLE, registrar.address);
      const isRegistrar = await accessController.isRegistrar(registrar.address);
      expect(isRegistrar).to.be.true;
    });

    it("#isGovernor() should return true for GOVERNOR_ROLE", async () => {
      const [ governor ] = governorAccs;
      const isGovernor = await accessController.isGovernor(governor.address);
      expect(isGovernor).to.be.true;
    });

    it("#isExecutor() should return true for EXECUTOR_ROLE", async () => {
      const [ executor ] = randomAccs;
      await accessController.connect(governorAccs[0]).setRoleAdmin(EXECUTOR_ROLE, GOVERNOR_ROLE);
      await accessController.connect(governorAccs[0]).grantRole(EXECUTOR_ROLE, executor.address);
      const isExecutor = await accessController.isExecutor(executor.address);
      expect(isExecutor).to.be.true;
    });

    it("Should revert if account does not have GOVERNOR_ROLE", async () => {
      const [ { address: random } ] = randomAccs;
      await expect(
        accessController.connect(random).checkGovernor(random)
      ).to.be.revertedWith(
        getAccessRevertMsg(random, GOVERNOR_ROLE)
      );
    });

    it("Should revert if account does not have ADMIN_ROLE", async () => {
      const [ { address: random } ] = randomAccs;
      await expect(
        accessController.connect(random).checkAdmin(random)
      ).to.be.revertedWith(
        getAccessRevertMsg(random, ADMIN_ROLE)
      );
    });

    it("Should revert if account does not have REGISTRAR_ROLE", async () => {
      const [ { address: random } ] = randomAccs;
      await expect(
        accessController.connect(random).checkRegistrar(random)
      ).to.be.revertedWith(
        getAccessRevertMsg(random, REGISTRAR_ROLE)
      );
    });

    it("Should revert if account does not have EXECUTOR_ROLE", async () => {
      const [ { address: random } ] = randomAccs;
      await expect(
        accessController.connect(random).checkExecutor(random)
      ).to.be.revertedWith(
        getAccessRevertMsg(random, EXECUTOR_ROLE)
      );
    });
  });
});
