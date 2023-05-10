import * as hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSAccessController } from "../typechain";
import { deployAccessController } from "./helpers";
import { expect } from "chai";
import { ADMIN_ROLE, GOVERNOR_ROLE } from "./helpers/access";


// TODO AC: test the full setup and that fact that role admins work properly
//  test different configurations of roles
describe("ZNSAccessController", () => {
  let deployer : SignerWithAddress;
  let znsAccessController : ZNSAccessController;
  let governorAddresses : Array<string>;
  let adminAddresses : Array<string>;

  beforeEach(async () => {
    const accounts = await hre.ethers.getSigners();
    deployer = accounts[0];
    governorAddresses = accounts.slice(1, 4).map(
      account => account.address
    );
    adminAddresses = accounts.slice(4, 7).map(
      account => account.address
    );

    znsAccessController = await deployAccessController({
      deployer,
      governorAddresses,
      adminAddresses,
    });
  });

  it("Should assign governors correctly", async () => {
    await governorAddresses.reduce(
      async (acc, address : string) => {
        const hasRole = await znsAccessController.hasRole(GOVERNOR_ROLE, address);
        expect(hasRole).to.be.true;
      }, Promise.resolve()
    );
  });

  it("Should assign admins correctly", async () => {
    await adminAddresses.reduce(
      async (acc, address : string) => {
        const hasRole = await znsAccessController.hasRole(ADMIN_ROLE, address);
        expect(hasRole).to.be.true;
      }, Promise.resolve()
    );
  });
});
