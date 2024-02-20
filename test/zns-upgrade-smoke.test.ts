import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSContracts } from "../src/deploy/campaign/types";
import { getCampaignConfig } from "../src/deploy/campaign/environments";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { setDefaultEnv, setEnvVars } from "./helpers/env";
import { DeployCampaign, getLogger, HardhatDeployer, MongoDBAdapter } from "@zero-tech/zdc";
import { getZnsMongoAdapter } from "../src/deploy/mongo";
import { DefenderRelayProvider } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import {
  MeowTokenDM,
  ZNSAccessControllerDM,
  ZNSAddressResolverDM, ZNSCurvePricerDM,
  ZNSFixedPricerDM,
  ZNSSubRegistrarDM, ZNSTreasuryDM,
} from "../src/deploy/missions/contracts";
import {
  ZNSDomainTokenUpgradeMockDM,
  ZNSRootRegistrarUpgradeMockDM,
  ZNSRegistryUpgradeMockDM,
} from "./helpers/upgrade/mock-dms";
import { expect } from "chai";

describe("ZNS Upgrade Smoke Test", () => {
  let deployAdmin : SignerWithAddress;
  let user : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let zeroVault : SignerWithAddress;

  let znsInitial : IZNSContracts;
  let znsUpgraded : IZNSContracts;

  let dbAdapter : MongoDBAdapter;
  let campaignInitial : DeployCampaign<DefenderRelayProvider, IZNSContracts>;
  let campaignUpgraded : DeployCampaign<DefenderRelayProvider, IZNSContracts>;

  before(async () => {
    setEnvVars({
      UPGRADE: "false",
      ARCHIVE_PREVIOUS_DB_VERSION: "true",
    });

    [deployAdmin, zeroVault, user, governor, admin] = await hre.ethers.getSigners();

    const config = await getCampaignConfig({
      deployer: deployAdmin,
      zeroVaultAddress: zeroVault.address,
      governors: [deployAdmin.address, governor.address],
      admins: [deployAdmin.address, admin.address],
    });

    campaignInitial = await runZnsCampaign({
      config,
    });

    znsInitial = campaignInitial.state.contracts;

    process.env.UPGRADE = "true";

    // make upgrade campaign
    const logger = getLogger();

    const deployer = new HardhatDeployer({
      hre,
      signer: config.deployAdmin,
      env: config.env,
    });

    dbAdapter = await getZnsMongoAdapter();

    campaignUpgraded = new DeployCampaign<
    DefenderRelayProvider,
    IZNSContracts
    >({
      missions: [
        ZNSAccessControllerDM,
        ZNSRegistryUpgradeMockDM, // this is new contract
        ZNSDomainTokenUpgradeMockDM, // this is new contract
        MeowTokenDM,
        ZNSAddressResolverDM,
        ZNSCurvePricerDM,
        ZNSTreasuryDM,
        ZNSRootRegistrarUpgradeMockDM, // this is new contract
        ZNSFixedPricerDM,
        ZNSSubRegistrarDM,
      ],
      deployer,
      dbAdapter,
      logger,
      config,
    });

    await campaignUpgraded.execute();

    await dbAdapter.finalize();

    znsUpgraded = campaignUpgraded.state.contracts;
  });

  after(async () => {
    setDefaultEnv();
  });

  it.only("smoke test", async () => {
    await [
      "registry",
      "domainToken",
      "rootRegistrar",
    ].reduce(async (acc, instName) => {
      await acc;

      expect(await znsInitial[instName].getAddress()).to.equal(await znsUpgraded[instName].getAddress());

      const {
        state: {
          instances : {
            [instName]: {
              contractName: contractNameInitial,
            },
          },
        },
      } = campaignInitial;

      const {
        state: {
          instances : {
            [instName]: {
              contractName: contractNameUpgraded,
            },
          },
        },
      } = campaignUpgraded;

      expect(contractNameInitial).to.equal(contractNameUpgraded);

      const versions = await campaignUpgraded.dbAdapter.versioner.getAllVersions();
      console.log(versions);

      // const {
      //   implementation: implAddressInitial,
      // } = await campaignInitial.dbAdapter.getContract(contractNameInitial);
      //
      // expect(await dbAdapter.getContract(contractNameInitial)).to.equal();
    },
    Promise.resolve()
    );
  });
});
