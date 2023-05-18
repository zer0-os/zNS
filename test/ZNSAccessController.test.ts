import * as hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSAccessController } from "../typechain";
import { deployAccessController } from "./helpers";
import { expect } from "chai";
import { ADMIN_ROLE, getAccessRevertMsg, GOVERNOR_ROLE, OPERATOR_ROLE, REGISTRAR_ROLE } from "./helpers/access";


describe("ZNSAccessController", () => {
  let deployer : SignerWithAddress;
  let znsAccessController : ZNSAccessController;
  let governorAccs : Array<SignerWithAddress>;
  let adminAccs : Array<SignerWithAddress>;
  let randomAccs : Array<SignerWithAddress>;

  beforeEach(async () => {
    const accounts = await hre.ethers.getSigners();
    deployer = accounts[0];
    governorAccs = accounts.slice(1, 4);
    adminAccs = accounts.slice(4, 7);
    randomAccs = accounts.slice(7, 10);

    znsAccessController = await deployAccessController({
      deployer,
      governorAddresses: governorAccs.map(acc => acc.address),
      adminAddresses: adminAccs.map(acc => acc.address),
    });
  });

  describe("Initial Setup", () => {
    it("Should assign GOVERNORs correctly", async () => {
      await governorAccs.reduce(
        async (acc, { address } : SignerWithAddress) => {
          const hasRole = await znsAccessController.hasRole(GOVERNOR_ROLE, address);
          expect(hasRole).to.be.true;
        }, Promise.resolve()
      );
    });

    it("Should assign ADMINs correctly", async () => {
      await adminAccs.reduce(
        async (acc, { address } : SignerWithAddress) => {
          const hasRole = await znsAccessController.hasRole(ADMIN_ROLE, address);
          expect(hasRole).to.be.true;
        }, Promise.resolve()
      );
    });
  });

  describe("Role Management from the Initial Setup", () => {
    it("GOVERNOR_ROLE should be able to grant GOVERNOR_ROLE", async () => {
      const [ governor ] = governorAccs;
      const [ { address: newGovernor } ] = randomAccs;
      await znsAccessController.connect(governor).grantRole(GOVERNOR_ROLE, newGovernor);

      const hasRole = await znsAccessController.hasRole(GOVERNOR_ROLE, newGovernor);
      expect(hasRole).to.be.true;
    });

    it("GOVERNOR_ROLE should be able to revoke GOVERNOR_ROLE", async () => {
      const [ governor ] = governorAccs;
      const [ { address: existingGovernor } ] = governorAccs;
      await znsAccessController.connect(governor).revokeRole(GOVERNOR_ROLE, existingGovernor);

      const hasRole = await znsAccessController.hasRole(GOVERNOR_ROLE, existingGovernor);
      expect(hasRole).to.be.false;
    });

    it("GOVERNOR_ROLE should be able to grant ADMIN_ROLE", async () => {
      const [ governor ] = governorAccs;
      const [ { address: newAdmin } ] = randomAccs;
      await znsAccessController.connect(governor).grantRole(ADMIN_ROLE, newAdmin);

      const hasRole = await znsAccessController.hasRole(ADMIN_ROLE, newAdmin);
      expect(hasRole).to.be.true;
    });

    it("GOVERNOR_ROLE should be able to revoke ADMIN_ROLE", async () => {
      const [ governor ] = governorAccs;
      const [ { address: existingAdmin } ] = adminAccs;
      await znsAccessController.connect(governor).revokeRole(ADMIN_ROLE, existingAdmin);

      const hasRole = await znsAccessController.hasRole(ADMIN_ROLE, existingAdmin);
      expect(hasRole).to.be.false;
    });

    it("ADMIN_ROLE should NOT be able to grant ADMIN_ROLE", async () => {
      const [ admin ] = adminAccs;
      const [ { address: newAdmin } ] = randomAccs;
      await expect(
        znsAccessController.connect(admin).grantRole(ADMIN_ROLE, newAdmin)
      ).to.be.revertedWith(
        getAccessRevertMsg(admin.address, GOVERNOR_ROLE)
      );
    });

    it("ADMIN_ROLE should NOT be able to revoke ADMIN_ROLE", async () => {
      const [ admin ] = adminAccs;
      const [ { address: existingAdmin } ] = adminAccs;
      await expect(
        znsAccessController.connect(admin).revokeRole(ADMIN_ROLE, existingAdmin)
      ).to.be.revertedWith(
        getAccessRevertMsg(admin.address, GOVERNOR_ROLE)
      );
    });

    it("ADMIN_ROLE should NOT be able to grant GOVERNOR_ROLE", async () => {
      const [ admin ] = adminAccs;
      const [ { address: newGovernor } ] = randomAccs;
      await expect(
        znsAccessController.connect(admin).grantRole(GOVERNOR_ROLE, newGovernor)
      ).to.be.revertedWith(
        getAccessRevertMsg(admin.address, GOVERNOR_ROLE)
      );
    });

    it("ADMIN_ROLE should NOT be able to revoke GOVERNOR_ROLE", async () => {
      const [ admin ] = adminAccs;
      const [ { address: existingGovernor } ] = governorAccs;
      await expect(
        znsAccessController.connect(admin).revokeRole(GOVERNOR_ROLE, existingGovernor)
      ).to.be.revertedWith(
        getAccessRevertMsg(admin.address, GOVERNOR_ROLE)
      );
    });

    it("ADMIN_ROLE should be able to grant REGISTRAR_ROLE", async () => {
      const [ admin ] = adminAccs;
      const [ { address: newRegistrar } ] = randomAccs;
      await znsAccessController.connect(admin).grantRole(REGISTRAR_ROLE, newRegistrar);
      const has = await znsAccessController.hasRole(REGISTRAR_ROLE, newRegistrar);
      expect(has).to.be.true;
    });

    it("ADMIN_ROLE should be able to revoke REGISTRAR_ROLE", async () => {
      const [ admin ] = adminAccs;
      const [ { address: newRegistrar } ] = randomAccs;
      await znsAccessController.connect(admin).grantRole(REGISTRAR_ROLE, newRegistrar);

      await znsAccessController.connect(admin).revokeRole(REGISTRAR_ROLE, newRegistrar);
      const has = await znsAccessController.hasRole(REGISTRAR_ROLE, newRegistrar);
      expect(has).to.be.false;
    });

    it("GOVERNOR_ROLE should be able to assign new OPERATOR_ROLE as admin for REGISTRAR_ROLE", async () => {
      const [ governor ] = governorAccs;
      await znsAccessController.connect(governor).setRoleAdmin(REGISTRAR_ROLE, OPERATOR_ROLE);

      const registrarAdminRole = await znsAccessController.getRoleAdmin(REGISTRAR_ROLE);
      expect(registrarAdminRole).to.be.equal(OPERATOR_ROLE);
    });

    // eslint-disable-next-line max-len
    it("GOVERNOR_ROLE should be able to make himself a new OPERATOR_ROLE's admin and assign this role to anyone", async () => {
      const [ governor ] = governorAccs;
      const [ { address: newOperator } ] = randomAccs;

      await znsAccessController.connect(governor).setRoleAdmin(OPERATOR_ROLE, GOVERNOR_ROLE);
      const roleAdminFrom = await znsAccessController.getRoleAdmin(OPERATOR_ROLE);
      expect(roleAdminFrom).to.be.equal(GOVERNOR_ROLE);

      await znsAccessController.connect(governor).grantRole(OPERATOR_ROLE, newOperator);
      const has = await znsAccessController.hasRole(OPERATOR_ROLE, newOperator);
      expect(has).to.be.true;
    });
  });
});
