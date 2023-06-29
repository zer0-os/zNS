import { DeployCampaign } from "../src/deploy/campaign/deploy-campaign";
import ZNSAccessControllerDM from "../src/deploy/missions/contracts/access-controller";
import { Deployer } from "../src/deploy/deployer/deployer";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  domainTokenName,
  GOVERNOR_ROLE,
  priceConfigDefault, registrationFeePercDefault,
  ZNS_DOMAIN_TOKEN_NAME,
  ZNS_DOMAIN_TOKEN_SYMBOL,
} from "./helpers";
import ZNSRegistryDM from "../src/deploy/missions/contracts/registry";
import { expect } from "chai";
import { FileStorageAdapter } from "../src/deploy/storage/file-storage";
import { znsNames } from "../src/deploy/constants";
import ZNSDomainTokenDM from "../src/deploy/missions/contracts/domain-token";
import ZeroTokenMockDM from "../src/deploy/missions/contracts/mocks/zero-token-mock";
import ZNSAddressResolverDM from "../src/deploy/missions/contracts/address-resolver";
import ZNSPriceOracleDM from "../src/deploy/missions/contracts/price-oracle";
import ZNSTreasuryDM from "../src/deploy/missions/contracts/treasury";
import ZNSRegistrarDM from "../src/deploy/missions/contracts/registrar";


describe.only("Deploy Campaign Smoke Test", () => {
  let deployAdmin : SignerWithAddress;
  let admin : SignerWithAddress;
  let user : SignerWithAddress;
  let zeroVault : SignerWithAddress;

  it("Deploy", async () => {
    [deployAdmin, admin, zeroVault, user] = await hre.ethers.getSigners();

    const deployer = new Deployer();
    const dbAdapterIn = new FileStorageAdapter(console);
    const config = {
      deployer: deployAdmin,
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
