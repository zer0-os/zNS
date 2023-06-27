import { DeployCampaign } from "../src/deploy/campaign/deploy-campaign";
import { ZNSAccessControllerDM } from "../src/deploy/missions/contracts/access-controller";
import { Deployer } from "../src/deploy/deployer/deployer";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { GOVERNOR_ROLE, REGISTRAR_ROLE } from "./helpers";
import { ZNSRegistryDM } from "../src/deploy/missions/contracts/registry";
import { expect } from "chai";


describe.only("Deploy Campaign Smoke Test", () => {
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let user : SignerWithAddress;

  it("Deploy", async () => {
    [governor, admin, user] = await hre.ethers.getSigners();

    const deployer = new Deployer();
    const dbAdapterMock = {};
    const config = {
      governorAddresses: [ governor.address ],
      adminAddresses: [ governor.address, admin.address ],
    };

    const campaign = new DeployCampaign({
      missions: [
        ZNSAccessControllerDM,
        ZNSRegistryDM,
      ],
      deployer,
      dbAdapter: dbAdapterMock,
      logger: console,
      config,
    });

    await campaign.execute();

    const { accessController, registry } = campaign.state.contracts;
    const isGovernor = await accessController.hasRole(GOVERNOR_ROLE, governor.address);
    expect(isGovernor).to.be.true;

    const acFromRegistry = await registry.getAccessController();
    expect(acFromRegistry).to.equal(accessController.address);
  });
});
