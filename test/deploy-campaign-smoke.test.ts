import { DeployCampaign } from "../src/deploy/campaign/deploy-campaign";
import { AccessControllerDM } from "../src/deploy/missions/contracts/access-controller";
import { Deployer } from "../src/deploy/deployer/deployer";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { GOVERNOR_ROLE, REGISTRAR_ROLE } from "./helpers";


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
      missions: [ AccessControllerDM ],
      deployer,
      dbAdapter: dbAdapterMock,
      logger: console,
      config,
    });

    await campaign.execute();

    const { accessController } = campaign.state.contracts;
    const isGovernor = await accessController.hasRole(GOVERNOR_ROLE, governor.address);
    console.log("isGovernor", isGovernor);
  });
});
