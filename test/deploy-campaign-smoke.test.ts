import { DeployCampaign } from "../src/deploy/campaign/deploy-campaign";
import { HardhatDeployer } from "../src/deploy/deployer/hardhat-deployer";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  GOVERNOR_ROLE,
  priceConfigDefault, registrationFeePercDefault,
  ZNS_DOMAIN_TOKEN_NAME,
  ZNS_DOMAIN_TOKEN_SYMBOL,
} from "./helpers";
import { expect } from "chai";
import { FileStorageAdapter } from "../src/deploy/storage/file-storage";
import { znsNames } from "../src/deploy/constants";
import {
  ZeroTokenMockDM,
  ZNSAccessControllerDM,
  ZNSAddressResolverDM,
  ZNSDomainTokenDM, ZNSPriceOracleDM, ZNSRegistrarDM,
  ZNSRegistryDM, ZNSTreasuryDM,
} from "../src/deploy/missions/contracts";


describe("Deploy Campaign Smoke Test", () => {
  let deployAdmin : SignerWithAddress;
  let admin : SignerWithAddress;
  let user : SignerWithAddress;
  let zeroVault : SignerWithAddress;

  it("Deploy", async () => {
    [deployAdmin, admin, zeroVault, user] = await hre.ethers.getSigners();

    const deployer = new HardhatDeployer();
    const dbAdapterIn = new FileStorageAdapter(console);
    const config = {
      deployAdmin,
      governorAddresses: [ deployAdmin.address ],
      adminAddresses: [ deployAdmin.address, admin.address ],
      domainToken: {
        name: ZNS_DOMAIN_TOKEN_NAME,
        symbol: ZNS_DOMAIN_TOKEN_SYMBOL,
      },
      priceConfig: priceConfigDefault,
      registrationFee: registrationFeePercDefault,
      zeroVaultAddress: zeroVault.address,
    };

    const campaign = new DeployCampaign({
      missions: [
        ZNSAccessControllerDM,
        ZNSRegistryDM,
        ZNSDomainTokenDM,
        ZeroTokenMockDM,
        ZNSAddressResolverDM,
        ZNSPriceOracleDM,
        ZNSTreasuryDM,
        ZNSRegistrarDM,
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
