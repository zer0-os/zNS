import { DeployCampaign } from "../src/deploy/campaign/deploy-campaign";
import ZNSAccessControllerDM from "../src/deploy/missions/contracts/access-controller";
import { Deployer } from "../src/deploy/deployer/deployer";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { GOVERNOR_ROLE } from "./helpers";
import ZNSRegistryDM from "../src/deploy/missions/contracts/registry";
import { expect } from "chai";
import { FileStorageAdapter } from "../src/deploy/storage/file-storage";
import { znsNames } from "../src/deploy/constants";


describe.only("Deploy Campaign Smoke Test", () => {
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let user : SignerWithAddress;

  it("Deploy", async () => {
    [governor, admin, user] = await hre.ethers.getSigners();

    const deployer = new Deployer();
    const dbAdapterIn = new FileStorageAdapter(console);
    const config = {
      governorAddresses: [ governor.address ],
      adminAddresses: [ governor.address, admin.address ],
    };

    const campaign = new DeployCampaign({
      missions: [
        ZNSAccessControllerDM,
        ZNSRegistryDM,
        ZNSDomainTokenDM,
      ],
      deployer,
      dbAdapter: dbAdapterIn,
      logger: console,
      config,
    });

    await campaign.execute();

    const {
      accessController,
      registry,
      dbAdapter,
    } = campaign;
    const isGovernor = await accessController.hasRole(GOVERNOR_ROLE, governor.address);
    expect(isGovernor).to.be.true;

    const acFromRegistry = await registry.getAccessController();
    expect(acFromRegistry).to.equal(accessController.address);

    const contractDbDoc = await dbAdapter.getContract(
      znsNames.accessController.contract
    );
    const contract = new hre.ethers.Contract(
      contractDbDoc!.address,
      contractDbDoc!.abi,
      governor
    );
    const isGovernor2 = await contract.hasRole(GOVERNOR_ROLE, governor.address);
    console.log("isGovernor2", isGovernor2);
  });
});
