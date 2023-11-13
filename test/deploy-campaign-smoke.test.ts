import { DeployCampaign } from "../src/deploy/campaign/deploy-campaign";
import { HardhatDeployer } from "../src/deploy/deployer/hardhat-deployer";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { GOVERNOR_ROLE } from "./helpers";
import { expect } from "chai";
// import { FileStorageAdapter } from "../src/deploy/storage/file-storage";
import {
  MeowTokenDM,
  ZNSAccessControllerDM,
  ZNSAddressResolverDM,
  ZNSDomainTokenDM, ZNSCurvePricerDM, ZNSRootRegistrarDM,
  ZNSRegistryDM, ZNSTreasuryDM,
} from "../src/deploy/missions/contracts";
import { znsNames } from "../src/deploy/missions/contracts/names";
import { IDeployCampaignConfig } from "../src/deploy/campaign/types";
import { getConfig } from "../src/deploy/campaign/environments";
import { getMongoAdapter } from "../src/deploy/db/mongo-adapter/get-adapter";


// TODO dep: possibly remove this whole test. it was added as a first check when prototyping
describe("Deploy Campaign Smoke Test", () => {
  let deployAdmin : SignerWithAddress;
  let admin : SignerWithAddress;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let user : SignerWithAddress;
  let governor : SignerWithAddress;
  let zeroVault : SignerWithAddress;

  it("Deploy", async () => {
    [deployAdmin, admin, zeroVault, user, governor, admin] = await hre.ethers.getSigners();

    const deployer = new HardhatDeployer(deployAdmin);
    // TODO Keep the FileStorageAdapter?
    // const dbAdapterIn = new FileStorageAdapter(console);
    const dbAdapterIn = await getMongoAdapter();

    const config : IDeployCampaignConfig = await getConfig(
      deployAdmin,
      zeroVault,
      [deployAdmin.address, governor.address],
      [deployAdmin.address, admin.address],
    );

    const campaign = new DeployCampaign({
      missions: [
        ZNSAccessControllerDM,
        ZNSRegistryDM,
        ZNSDomainTokenDM,
        MeowTokenDM,
        ZNSAddressResolverDM,
        ZNSCurvePricerDM,
        ZNSTreasuryDM,
        ZNSRootRegistrarDM,
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
    const isGovernor = await accessController.hasRole(GOVERNOR_ROLE, deployAdmin.address);
    expect(isGovernor).to.be.true;

    const acFromRegistry = await registry.getAccessController();
    expect(acFromRegistry).to.equal(accessController.address);

    const contractDbDoc = await dbAdapter.getContract(
      znsNames.accessController.contract
    );
    const contract = new hre.ethers.Contract(
      contractDbDoc!.address,
      contractDbDoc!.abi,
      deployAdmin
    );
    const isGovernor2 = await contract.hasRole(GOVERNOR_ROLE, deployAdmin.address);
    console.log("isGovernor2", isGovernor2);
  });
});
