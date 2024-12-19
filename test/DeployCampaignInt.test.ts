/* eslint-disable @typescript-eslint/no-empty-function, @typescript-eslint/ban-ts-comment, max-classes-per-file */
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import {
  TLogger,
  HardhatDeployer,
  DeployCampaign,
  resetMongoAdapter,
  TDeployMissionCtor,
  MongoDBAdapter,
  ITenderlyContractData,
  TDeployArgs,
  VERSION_TYPES,
} from "@zero-tech/zdc";
import {
  DEFAULT_ROYALTY_FRACTION,
  DEFAULT_PRICE_CONFIG,
  ZNS_DOMAIN_TOKEN_NAME,
  ZNS_DOMAIN_TOKEN_SYMBOL,
  INVALID_ENV_ERR,
  NO_MOCK_PROD_ERR,
  STAKING_TOKEN_ERR,
  MONGO_URI_ERR,
  INFLATION_RATES_DEFAULT,
  FINAL_INFLATION_RATE_DEFAULT,
  INITIAL_SUPPLY_DEFAULT,
  INITIAL_ADMIN_DELAY_DEFAULT,
  Z_NAME_DEFAULT,
  Z_SYMBOL_DEFAULT,
} from "./helpers";
import {
  ZTokenDM, PolygonZkEVMBridgeV2DM,
  ZNSAccessControllerDM,
  ZNSAddressResolverDM, ZNSChainResolverDM,
  ZNSCurvePricerDM,
  ZNSDomainTokenDM, ZNSFixedPricerDM,
  ZNSRegistryDM, ZNSRootRegistrarDM, ZNSSubRegistrarDM, ZNSTreasuryDM,
} from "../src/deploy/missions/contracts";
import { ZNSStringResolverDM } from "../src/deploy/missions/contracts/zns-base/string-resolver";
import { znsNames } from "../src/deploy/missions/contracts/names";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
// TODO multi: why does this have Sepolia in the name ?! Check and validate !
import { ZSepolia } from "../src/deploy/missions/contracts/zns-base/z-token/mainnet-data";
import { ResolverTypes } from "../src/deploy/constants";
import { buildCrosschainConfig, getConfig } from "../src/deploy/campaign/get-config";
import { ethers, Wallet } from "ethers";
import { promisify } from "util";
import { exec } from "child_process";
import { saveTag } from "../src/utils/git-tag/save-tag";
import { IZNSCampaignConfig, IZNSContracts } from "../src/deploy/campaign/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getZnsMongoAdapter } from "../src/deploy/mongo";
import { getPortalDM } from "../src/deploy/missions/contracts/cross-chain/portals/get-portal-dm";
import { IZTokenConfig } from "../src/deploy/missions/types";


const execAsync = promisify(exec);

describe("Deploy Campaign Test", () => {
  let deployAdmin : SignerWithAddress;
  let admin : SignerWithAddress;
  let governor : SignerWithAddress;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let userA : SignerWithAddress;
  let userB : SignerWithAddress;
  let zeroVault : SignerWithAddress;
  let campaignConfig : IZNSCampaignConfig<SignerWithAddress>;

  let mongoAdapter : MongoDBAdapter;

  const env = "dev";

  before(async () => {
    [deployAdmin, admin, governor, zeroVault, userA, userB] = await hre.ethers.getSigners();
  });

  describe("Z Token Ops", () => {
    before(async () => {
      campaignConfig = {
        env,
        deployAdmin,
        governorAddresses: [deployAdmin.address],
        adminAddresses: [deployAdmin.address, admin.address],
        domainToken: {
          name: ZNS_DOMAIN_TOKEN_NAME,
          symbol: ZNS_DOMAIN_TOKEN_SYMBOL,
          defaultRoyaltyReceiver: deployAdmin.address,
          defaultRoyaltyFraction: DEFAULT_ROYALTY_FRACTION,
        },
        rootPriceConfig: DEFAULT_PRICE_CONFIG,
        zeroVaultAddress: zeroVault.address,
        stakingTokenAddress: ZSepolia.address,
        mockZToken: true,
        postDeploy: {
          tenderlyProjectSlug: "",
          monitorContracts: false,
          verifyContracts: false,
        },
        crosschain: buildCrosschainConfig(),
      };

      campaignConfig.domainToken.defaultRoyaltyReceiver = deployAdmin.address;
      campaignConfig.postDeploy.tenderlyProjectSlug = "";
    });

    it("should deploy new ZTokenMock when `mockZToken` is true", async () => {
      const campaign = await runZnsCampaign({
        config: campaignConfig,
      });

      const { zToken, dbAdapter } = campaign;

      expect(
        campaignConfig.mockZToken
      ).to.equal(true);

      expect(
        await zToken.getAddress()
      ).to.properAddress;

      expect(
        await zToken.name()
      ).to.equal("ZERO Token");

      expect(
        await zToken.symbol()
      ).to.equal("Z");

      // one of deploy args
      expect(
        await zToken.INITIAL_SUPPLY_BASE()
      ).to.equal(
        (campaignConfig.zTokenConfig as IZTokenConfig).initialSupplyBase
      );

      // function, which exist only on mock contract
      expect(
        await zToken.identifyMock()
      ).to.equal("This is a mock token");

      await dbAdapter.dropDB();
    });

    it("should use existing deployed non-mocked ZToken contract when `mockZToken` is false", async () => {
      campaignConfig.mockZToken = false;

      // deploy ZToken contract
      const Factory = await hre.ethers.getContractFactory("ZTokenMock");
      const z = await Factory.deploy(
        Z_NAME_DEFAULT,
        Z_SYMBOL_DEFAULT,
        admin.address,
        INITIAL_ADMIN_DELAY_DEFAULT,
        admin.address,
        userA.address,
        INITIAL_SUPPLY_DEFAULT,
        INFLATION_RATES_DEFAULT,
        FINAL_INFLATION_RATE_DEFAULT,
      );

      await z.waitForDeployment();

      campaignConfig.stakingTokenAddress = await z.getAddress();

      const campaign = await runZnsCampaign({
        config: campaignConfig,
      });

      const {
        zToken,
        dbAdapter,
        state: {
          instances: {
            zToken: zDMInstance,
          },
        },
      } = campaign;

      expect(
        await zToken.getAddress()
      ).to.equal(
        await z.getAddress()
      );
      expect(zDMInstance.contractName).to.equal(znsNames.zToken.contract);

      // Cannot call to real db to
      await dbAdapter.dropDB();
    });
  });

  describe("Failure Recovery", () => {
    const errorMsgDeploy = "FailMissionDeploy";
    const errorMsgPostDeploy = "FailMissionPostDeploy";

    const loggerMock = {
      info: () => {
      },
      debug: () => {
      },
      error: () => {
      },
    };

    interface IDeployedData {
      contract : string;
      instance : string;
      address ?: string;
    }

    const runTest = async ({
      missionList,
      placeOfFailure,
      deployedNames,
      undeployedNames,
      failingInstanceName,
      callback,
    } : {
      missionList : Array<TDeployMissionCtor<
      HardhatRuntimeEnvironment,
      SignerWithAddress,
      IZNSCampaignConfig<SignerWithAddress>,
      IZNSContracts
      >>;
      placeOfFailure : string;
      deployedNames : Array<{ contract ?: string; contractTrunk ?: string; instance : string; }>;
      undeployedNames : Array<{ contract ?: string; contractTrunk ?: string; instance : string; }>;
      failingInstanceName : string;
      // eslint-disable-next-line no-shadow
      callback ?: (failingCampaign : DeployCampaign<
      HardhatRuntimeEnvironment,
      SignerWithAddress,
      IZNSCampaignConfig<SignerWithAddress>,
      IZNSContracts
      >) => Promise<void>;
    }) => {
      const deployer = new HardhatDeployer<
      HardhatRuntimeEnvironment,
      SignerWithAddress
      >({
        hre,
        signer: deployAdmin,
        env,
      });
      let dbAdapter = await getZnsMongoAdapter();

      let toMatchErr = errorMsgDeploy;
      if (placeOfFailure === "postDeploy") {
        toMatchErr = errorMsgPostDeploy;
      }

      const failingCampaign = new DeployCampaign<
      HardhatRuntimeEnvironment,
      SignerWithAddress,
      IZNSCampaignConfig<SignerWithAddress>,
      IZNSContracts
      >({
        missions: missionList,
        deployer,
        dbAdapter,
        // @ts-ignore
        logger: loggerMock,
        config: campaignConfig,
      });

      try {
        await failingCampaign.execute();
      } catch (e) {
        // @ts-ignore
        expect(e.message).to.include(toMatchErr);
      }

      // check the correct amount of contracts in state
      const { contracts } = failingCampaign.state;
      expect(Object.keys(contracts).length).to.equal(deployedNames.length);

      if (placeOfFailure === "deploy") {
        // it should not deploy AddressResolver
        expect(contracts[failingInstanceName]).to.be.undefined;
      } else {
        // it should deploy AddressResolver
        expect(await contracts[failingInstanceName].getAddress()).to.be.properAddress;
      }

      // check DB to verify we only deployed half
      const firstRunDeployed = await deployedNames.reduce(
        async (
          acc : Promise<Array<IDeployedData>>,
          { contract, contractTrunk, instance } : { contract ?: string; contractTrunk ?: string; instance : string; }
        ) : Promise<Array<IDeployedData>> => {
          const akk = await acc;
          const name = contract ?? contractTrunk;
          const fromDB = await dbAdapter.getContract(name as string);
          expect(fromDB?.address).to.be.properAddress;

          return [...akk, { contract: name as string, instance, address: fromDB?.address }];
        },
        Promise.resolve([])
      );

      await undeployedNames.reduce(
        async (
          acc : Promise<void>,
          { contract, contractTrunk, instance } : { contract ?: string; contractTrunk ?: string; instance : string; }
        ) : Promise<void> => {
          await acc;
          const name = contract ?? contractTrunk;
          const fromDB = await dbAdapter.getContract(name as string);
          const fromState = failingCampaign[instance];

          expect(fromDB).to.be.null;
          expect(fromState).to.be.undefined;
        },
        Promise.resolve()
      );

      // call whatever callback we passed before the next campaign run
      await callback?.(failingCampaign);

      const { curVersion: initialDbVersion } = dbAdapter;

      // reset mongoAdapter instance to make sure we pick up the correct DB version
      resetMongoAdapter();

      // run Campaign again, but normally
      const nextCampaign = await runZnsCampaign({
        config: campaignConfig,
      });

      ({ dbAdapter } = nextCampaign);

      // make sure MongoAdapter is using the correct TEMP version
      const { curVersion: nextDbVersion } = dbAdapter;
      expect(nextDbVersion).to.equal(initialDbVersion);

      // state should have 11 contracts in it
      const { state } = nextCampaign;
      expect(Object.keys(state.contracts).length).to.equal(14);
      expect(Object.keys(state.instances).length).to.equal(14);
      expect(state.missions.length).to.equal(14);
      // it should deploy AddressResolver
      expect(await state.contracts.addressResolver.getAddress()).to.be.properAddress;

      // check DB to verify we deployed everything
      const allNames = deployedNames.concat(undeployedNames);

      await allNames.reduce(
        async (
          acc : Promise<void>,
          { contract, contractTrunk } : { contract ?: string; contractTrunk ?: string; }
        ) : Promise<void> => {
          await acc;
          const name = contract ?? contractTrunk;
          const fromDB = await dbAdapter.getContract(name as string);
          expect(fromDB?.address).to.be.properAddress;
        },
        Promise.resolve()
      );

      // check that previously deployed contracts were NOT redeployed
      await firstRunDeployed.reduce(
        async (acc : Promise<void>, { contract, instance, address } : IDeployedData) : Promise<void> => {
          await acc;
          const fromDB = await nextCampaign.dbAdapter.getContract(contract);
          const fromState = nextCampaign[instance];

          expect(fromDB?.address).to.equal(address);
          expect(await fromState.getAddress()).to.equal(address);
        },
        Promise.resolve()
      );

      return {
        failingCampaign,
        nextCampaign,
        firstRunDeployed,
      };
    };

    beforeEach(async () => {
      [deployAdmin, admin, zeroVault] = await hre.ethers.getSigners();

      campaignConfig = {
        env,
        deployAdmin,
        governorAddresses: [deployAdmin.address],
        adminAddresses: [deployAdmin.address, admin.address],
        domainToken: {
          name: ZNS_DOMAIN_TOKEN_NAME,
          symbol: ZNS_DOMAIN_TOKEN_SYMBOL,
          defaultRoyaltyReceiver: deployAdmin.address,
          defaultRoyaltyFraction: DEFAULT_ROYALTY_FRACTION,
        },
        rootPriceConfig: DEFAULT_PRICE_CONFIG,
        zeroVaultAddress: zeroVault.address,
        stakingTokenAddress: "",
        mockZToken: true,
        postDeploy: {
          tenderlyProjectSlug: "",
          monitorContracts: false,
          verifyContracts: false,
        },
        crosschain: buildCrosschainConfig(),
      };

      campaignConfig.domainToken.defaultRoyaltyReceiver = deployAdmin.address;
      // TODO dep: what do we pass here for test flow? we don't have a deployed ZToken contract
      campaignConfig.stakingTokenAddress = "";
      campaignConfig.postDeploy.tenderlyProjectSlug = "";

      mongoAdapter = await getZnsMongoAdapter({
        logger: loggerMock as TLogger,
      });
    });

    afterEach(async () => {
      await mongoAdapter.dropDB();
    });

    // eslint-disable-next-line max-len
    it("[in AddressResolver.deploy() hook] should ONLY deploy undeployed contracts in the run following a failed run", async () => {
      // ZNSAddressResolverDM sits in the middle of the Campaign deploy list
      // we override this class to add a failure to the deploy() method
      class FailingZNSAddressResolverDM extends ZNSAddressResolverDM {
        async deploy () {
          throw new Error(errorMsgDeploy);
        }
      }

      const deployedNames = [
        znsNames.accessController,
        znsNames.registry,
        znsNames.domainToken,
        {
          contract: znsNames.zToken.contractMock,
          instance: znsNames.zToken.instance,
        },
      ];

      const undeployedNames = [
        znsNames.addressResolver,
        znsNames.curvePricer,
        znsNames.treasury,
        znsNames.rootRegistrar,
        znsNames.fixedPricer,
        znsNames.subRegistrar,
        znsNames.chainResolver,
        {
          contract: znsNames.zkEvmBridge.contractMock,
          instance: znsNames.zkEvmBridge.instance,
        },
        znsNames.zPortal,
      ];

      // call test flow runner
      await runTest({
        missionList: [
          ZNSAccessControllerDM,
          ZNSRegistryDM,
          ZNSDomainTokenDM,
          ZTokenDM,
          FailingZNSAddressResolverDM, // failing DM
          ZNSStringResolverDM,
          ZNSCurvePricerDM,
          ZNSTreasuryDM,
          ZNSRootRegistrarDM,
          ZNSSubRegistrarDM,
          ZNSFixedPricerDM,
          ZNSChainResolverDM,
          PolygonZkEVMBridgeV2DM,
          getPortalDM(campaignConfig.crosschain.srcChainName),
        ],
        placeOfFailure: "deploy",
        deployedNames,
        undeployedNames,
        failingInstanceName: "addressResolver",
      });
    });

    // eslint-disable-next-line max-len
    it("[in AddressResolver.postDeploy() hook] should start from post deploy sequence that failed on the previous run", async () => {
      class FailingZNSAddressResolverDM extends ZNSAddressResolverDM {
        async postDeploy () {
          throw new Error(errorMsgPostDeploy);
        }
      }

      const deployedNames = [
        znsNames.accessController,
        znsNames.registry,
        znsNames.domainToken,
        {
          contract: znsNames.zToken.contractMock,
          instance: znsNames.zToken.instance,
        },
        znsNames.addressResolver,
      ];

      const undeployedNames = [
        znsNames.curvePricer,
        znsNames.treasury,
        znsNames.rootRegistrar,
        znsNames.fixedPricer,
        znsNames.subRegistrar,
      ];

      const checkPostDeploy = async (failingCampaign : DeployCampaign<
      HardhatRuntimeEnvironment,
      SignerWithAddress,
      IZNSCampaignConfig<SignerWithAddress>,
      IZNSContracts
      >) => {
        const {
          // eslint-disable-next-line no-shadow
          registry,
        } = failingCampaign;

        // we are checking that postDeploy did not add resolverType to Registry
        expect(await registry.getResolverType(ResolverTypes.address)).to.be.equal(ethers.ZeroAddress);
      };

      // check contracts are deployed correctly
      const {
        nextCampaign,
      } = await runTest({
        missionList: [
          ZNSAccessControllerDM,
          ZNSRegistryDM,
          ZNSDomainTokenDM,
          ZTokenDM,
          FailingZNSAddressResolverDM, // failing DM
          ZNSCurvePricerDM,
          ZNSTreasuryDM,
          ZNSRootRegistrarDM,
          ZNSFixedPricerDM,
          ZNSSubRegistrarDM,
        ],
        placeOfFailure: "postDeploy",
        deployedNames,
        undeployedNames,
        failingInstanceName: "addressResolver",
        callback: checkPostDeploy,
      });

      // make sure postDeploy() ran properly on the next run
      const {
        registry,
        addressResolver,
      } = nextCampaign;
      expect(await registry.getResolverType(ResolverTypes.address)).to.be.equal(await addressResolver.getAddress());
    });

    // eslint-disable-next-line max-len
    it("[in RootRegistrar.deploy() hook] should ONLY deploy undeployed contracts in the run following a failed run", async () => {
      class FailingZNSRootRegistrarDM extends ZNSRootRegistrarDM {
        async deploy () {
          throw new Error(errorMsgDeploy);
        }
      }

      const deployedNames = [
        znsNames.accessController,
        znsNames.registry,
        znsNames.domainToken,
        {
          contract: znsNames.zToken.contractMock,
          instance: znsNames.zToken.instance,
        },
        znsNames.addressResolver,
        znsNames.curvePricer,
        znsNames.treasury,
      ];

      const undeployedNames = [
        znsNames.rootRegistrar,
        znsNames.fixedPricer,
        znsNames.subRegistrar,
      ];

      // call test flow runner
      await runTest({
        missionList: [
          ZNSAccessControllerDM,
          ZNSRegistryDM,
          ZNSDomainTokenDM,
          ZTokenDM,
          ZNSAddressResolverDM,
          ZNSCurvePricerDM,
          ZNSTreasuryDM,
          FailingZNSRootRegistrarDM, // failing DM
          ZNSFixedPricerDM,
          ZNSSubRegistrarDM,
        ],
        placeOfFailure: "deploy",
        deployedNames,
        undeployedNames,
        failingInstanceName: "rootRegistrar",
      });
    });

    // eslint-disable-next-line max-len
    it("[in RootRegistrar.postDeploy() hook] should start from post deploy sequence that failed on the previous run", async () => {
      class FailingZNSRootRegistrarDM extends ZNSRootRegistrarDM {
        async postDeploy () {
          throw new Error(errorMsgPostDeploy);
        }
      }

      const deployedNames = [
        znsNames.accessController,
        znsNames.registry,
        znsNames.domainToken,
        {
          contract: znsNames.zToken.contractMock,
          instance: znsNames.zToken.instance,
        },
        znsNames.addressResolver,
        znsNames.curvePricer,
        znsNames.treasury,
        znsNames.rootRegistrar,
      ];

      const undeployedNames = [
        znsNames.fixedPricer,
        znsNames.subRegistrar,
      ];

      const checkPostDeploy = async (failingCampaign : DeployCampaign<
      HardhatRuntimeEnvironment,
      SignerWithAddress,
      IZNSCampaignConfig<SignerWithAddress>,
      IZNSContracts
      >) => {
        const {
          // eslint-disable-next-line no-shadow
          accessController,
          // eslint-disable-next-line no-shadow
          rootRegistrar,
        } = failingCampaign;

        // we are checking that postDeploy did not grant REGISTRAR_ROLE to RootRegistrar
        expect(await accessController.isRegistrar(await rootRegistrar.getAddress())).to.be.false;
      };

      // check contracts are deployed correctly
      const {
        nextCampaign,
      } = await runTest({
        missionList: [
          ZNSAccessControllerDM,
          ZNSRegistryDM,
          ZNSDomainTokenDM,
          ZTokenDM,
          ZNSAddressResolverDM,
          ZNSCurvePricerDM,
          ZNSTreasuryDM,
          FailingZNSRootRegistrarDM, // failing DM
          ZNSFixedPricerDM,
          ZNSSubRegistrarDM,
        ],
        placeOfFailure: "postDeploy",
        deployedNames,
        undeployedNames,
        failingInstanceName: "rootRegistrar",
        callback: checkPostDeploy,
      });

      // make sure postDeploy() ran properly on the next run
      const {
        accessController,
        rootRegistrar,
      } = nextCampaign;
      expect(await accessController.isRegistrar(await rootRegistrar.getAddress())).to.be.true;
    });
  });

  describe("Configurable Environment & Validation", () => {
    let envInitial : string;

    beforeEach(async () => {
      envInitial = JSON.stringify(process.env);
    });

    afterEach(async () => {
      process.env = JSON.parse(envInitial);
    });

    // The `validate` function accepts the environment parameter only for the
    // purpose of testing here as manipulating actual environment variables
    // like `process.env.<VAR> = "value"` is not possible in a test environment
    // because the Hardhat process for running these tests will not respect these
    // changes. `getConfig` calls to `validate` on its own, but never passes a value
    // for the environment specifically, that is ever only inferred from the `process.env.ENV_LEVEL`
    it("Gets the default configuration correctly", async () => {
      // set the environment to get the appropriate variables
      const localConfig : IZNSCampaignConfig<SignerWithAddress | Wallet> = await getConfig({
        deployer: deployAdmin,
        zeroVaultAddress: zeroVault.address,
        governors: [governor.address],
        admins: [admin.address],
      });

      expect(await localConfig.deployAdmin.getAddress()).to.eq(deployAdmin.address);
      expect(localConfig.governorAddresses[0]).to.eq(governor.address);
      expect(localConfig.governorAddresses[1]).to.eq(deployAdmin.address);
      expect(localConfig.adminAddresses[0]).to.eq(admin.address);
      expect(localConfig.adminAddresses[1]).to.eq(deployAdmin.address);
      expect(localConfig.domainToken.name).to.eq(ZNS_DOMAIN_TOKEN_NAME);
      expect(localConfig.domainToken.symbol).to.eq(ZNS_DOMAIN_TOKEN_SYMBOL);
      expect(localConfig.domainToken.defaultRoyaltyReceiver).to.eq(zeroVault.address);
      expect(localConfig.domainToken.defaultRoyaltyFraction).to.eq(DEFAULT_ROYALTY_FRACTION);
      expect(localConfig.rootPriceConfig).to.deep.eq(DEFAULT_PRICE_CONFIG);
    });

    it("Confirms encoding functionality works for env variables", async () => {
      const sample = "0x123,0x456,0x789";
      const sampleFormatted = ["0x123", "0x456", "0x789"];
      const encoded = btoa(sample);
      const decoded = atob(encoded).split(",");
      expect(decoded).to.deep.eq(sampleFormatted);
    });

    it("Modifies config to use a random account as the deployer", async () => {
      // Run the deployment a second time, clear the DB so everything is deployed

      let zns : IZNSContracts;

      const config : IZNSCampaignConfig<SignerWithAddress | Wallet> = await getConfig({
        deployer: userB,
        zeroVaultAddress: userA.address,
        governors: [userB.address, admin.address], // governors
        admins: [userB.address, governor.address], // admins
      });

      const campaign = await runZnsCampaign({
        config,
      });

      const { dbAdapter } = campaign;

      /* eslint-disable-next-line prefer-const */
      zns = campaign.state.contracts;

      const rootPaymentConfig = await zns.treasury.paymentConfigs(ethers.ZeroHash);

      expect(await zns.accessController.isAdmin(userB.address)).to.be.true;
      expect(await zns.accessController.isAdmin(governor.address)).to.be.true;
      expect(await zns.accessController.isGovernor(admin.address)).to.be.true;
      expect(rootPaymentConfig.token).to.eq(await zns.zToken.getAddress());
      expect(rootPaymentConfig.beneficiary).to.eq(userA.address);

      await dbAdapter.dropDB();
    });

    it("Fails when governor or admin addresses are given wrong", async () => {
      // Custom addresses must given as the base64 encoded string of comma separated addresses
      // e.g. btoa("0x123,0x456,0x789") = 'MHgxMjMsMHg0NTYsMHg3ODk=', which is what should be provided
      // We could manipulate envariables through `process.env.<VAR_NAME>` for this test and call `getConfig()`
      // but the async nature of HH mocha tests causes this to mess up other tests
      // Instead we use the same encoding functions used in `getConfig()` to test the functionality

      /* eslint-disable @typescript-eslint/no-explicit-any */
      try {
        atob("[0x123,0x456]");
      } catch (e : any) {
        expect(e.message).includes("Invalid character");
      }

      try {
        atob("0x123, 0x456");
      } catch (e : any) {
        expect(e.message).includes("Invalid character");
      }

      try {
        atob("0x123 0x456");
      } catch (e : any) {
        expect(e.message).includes("Invalid character");
      }

      try {
        atob("'MHgxM jMsMHg0 NTYs MHg3ODk='");
      } catch (e : any) {
        expect(e.message).includes("Invalid character");
      }
    });

    it("Throws if env variable is invalid", async () => {
      try {
        await getConfig({
          deployer: deployAdmin,
          zeroVaultAddress: zeroVault.address,
          governors: [deployAdmin.address, governor.address],
          admins: [deployAdmin.address, admin.address],
        });

        /* eslint-disable @typescript-eslint/no-explicit-any */
      } catch (e : any) {
        expect(e.message).includes(INVALID_ENV_ERR);
      }
    });

    it("Fails to validate when mocking Z on prod", async () => {
      process.env.MOCK_Z_TOKEN = "true";

      try {
        await getConfig({
          deployer: deployAdmin,
          zeroVaultAddress: zeroVault.address,
          governors: [deployAdmin.address, governor.address],
          admins: [deployAdmin.address, admin.address],
        });

        /* eslint-disable @typescript-eslint/no-explicit-any */
      } catch (e : any) {
        expect(e.message).includes(NO_MOCK_PROD_ERR);
      }
    });

    it("Fails to validate if not using the Z token on prod", async () => {
      process.env.MOCK_Z_TOKEN = "false";
      process.env.STAKING_TOKEN_ADDRESS = "0x123";

      try {
        await getConfig({
          deployer: deployAdmin,
          zeroVaultAddress: zeroVault.address,
          governors: [deployAdmin.address, governor.address],
          admins: [deployAdmin.address, admin.address],
        });
        /* eslint-disable @typescript-eslint/no-explicit-any */
      } catch (e : any) {
        expect(e.message).includes(STAKING_TOKEN_ERR);
      }
    });

    it("Fails to validate if no mongo uri or local URI in prod", async () => {
      process.env.MOCK_Z_TOKEN = "false";
      process.env.STAKING_TOKEN_ADDRESS = ZSepolia.address;
      // Falls back onto the default URI which is for localhost and fails in prod
      process.env.MONGO_DB_URI = "";
      process.env.ROYALTY_RECEIVER = "0x123";
      process.env.ROYALTY_FRACTION = "100";

      try {
        await getConfig({
          env: "prod",
          deployer: deployAdmin,
          zeroVaultAddress: zeroVault.address,
          governors: [deployAdmin.address, governor.address],
          admins: [deployAdmin.address, admin.address],
        });
        /* eslint-disable @typescript-eslint/no-explicit-any */
      } catch (e : any) {
        expect(e.message).includes("Missing required environment variables: MONGO_DB_URI");
      }

      process.env.MOCK_Z_TOKEN = "false";
      process.env.STAKING_TOKEN_ADDRESS = ZSepolia.address;
      process.env.MONGO_DB_URI = "mongodb://localhost:27018";
      process.env.ZERO_VAULT_ADDRESS = "0x123";

      try {
        await getConfig({
          env: "prod",
          deployer: deployAdmin,
          zeroVaultAddress: zeroVault.address,
          governors: [deployAdmin.address, governor.address],
          admins: [deployAdmin.address, admin.address],
        });
        /* eslint-disable @typescript-eslint/no-explicit-any */
      } catch (e : any) {
        expect(e.message).includes(MONGO_URI_ERR);
      }
    });
  });

  describe("Versioning", () => {
    let campaign : DeployCampaign<
    HardhatRuntimeEnvironment,
    SignerWithAddress,
    IZNSCampaignConfig<SignerWithAddress>,
    IZNSContracts
    >;

    before(async () => {
      await saveTag();

      campaignConfig = {
        env,
        deployAdmin,
        governorAddresses: [deployAdmin.address, governor.address],
        adminAddresses: [deployAdmin.address, admin.address],
        domainToken: {
          name: ZNS_DOMAIN_TOKEN_NAME,
          symbol: ZNS_DOMAIN_TOKEN_SYMBOL,
          defaultRoyaltyReceiver: deployAdmin.address,
          defaultRoyaltyFraction: DEFAULT_ROYALTY_FRACTION,
        },
        rootPriceConfig: DEFAULT_PRICE_CONFIG,
        zeroVaultAddress: zeroVault.address,
        stakingTokenAddress: ZSepolia.address,
        mockZToken: true,
        postDeploy: {
          tenderlyProjectSlug: "",
          monitorContracts: false,
          verifyContracts: false,
        },
        crosschain: buildCrosschainConfig(),
      };

      campaignConfig.domainToken.defaultRoyaltyReceiver = deployAdmin.address;
      // TODO dep: what do we pass here for test flow? we don't have a deployed ZToken contract
      campaignConfig.stakingTokenAddress = ZSepolia.address;
      campaignConfig.postDeploy.tenderlyProjectSlug = "";

      campaign = await runZnsCampaign({
        config: campaignConfig,
      });
    });

    it("should get the correct git tag + commit hash and write to DB", async () => {
      const latestGitTag = (await execAsync("git describe --tags --abbrev=0")).stdout.trim();
      const latestCommit = (await execAsync(`git rev-list -n 1 ${latestGitTag}`)).stdout.trim();

      const fullGitTag = `${latestGitTag}:${latestCommit}`;

      const { dbAdapter } = campaign;

      const versionDoc = await dbAdapter.versioner.getLatestVersion();
      expect(versionDoc?.contractsVersion).to.equal(fullGitTag);

      const deployedVersion = await dbAdapter.versioner.getDeployedVersion();
      expect(deployedVersion?.contractsVersion).to.equal(fullGitTag);
    });

    // eslint-disable-next-line max-len
    it("should create new DB version and KEEP old data if ARCHIVE is true and no TEMP versions currently exist", async () => {
      const { dbAdapter } = campaign;

      const versionDocInitial = await dbAdapter.versioner.getLatestVersion();
      const initialDBVersion = versionDocInitial?.dbVersion;
      const registryDocInitial = await dbAdapter.getContract(znsNames.registry.contract);

      expect(
        process.env.MONGO_DB_VERSION === undefined
        || process.env.MONGO_DB_VERSION === ""
      ).to.be.true;

      // set archiving for the new mongo adapter
      const initialArchiveVal = process.env.ARCHIVE_PREVIOUS_DB_VERSION;
      process.env.ARCHIVE_PREVIOUS_DB_VERSION = "true";

      // run a new campaign
      const { dbAdapter: newDbAdapter } = await runZnsCampaign({
        config: campaignConfig,
      });

      expect(newDbAdapter.curVersion).to.not.equal(initialDBVersion);

      // get some data from new DB version
      const registryDocNew = await newDbAdapter.getContract(znsNames.registry.contract);
      expect(registryDocNew?.version).to.not.equal(registryDocInitial?.version);

      const versionDocNew = await newDbAdapter.versioner.getLatestVersion();
      expect(versionDocNew?.dbVersion).to.not.equal(initialDBVersion);
      expect(versionDocNew?.type).to.equal(VERSION_TYPES.deployed);

      // make sure old contracts from previous DB version are still there
      const oldRegistryDocFromNewDB = await newDbAdapter.getContract(
        znsNames.registry.contract,
        initialDBVersion
      );

      expect(oldRegistryDocFromNewDB?.version).to.equal(registryDocInitial?.version);
      expect(oldRegistryDocFromNewDB?.address).to.equal(registryDocInitial?.address);
      expect(oldRegistryDocFromNewDB?.name).to.equal(registryDocInitial?.name);
      expect(oldRegistryDocFromNewDB?.abi).to.equal(registryDocInitial?.abi);
      expect(oldRegistryDocFromNewDB?.bytecode).to.equal(registryDocInitial?.bytecode);

      // reset back to default
      process.env.ARCHIVE_PREVIOUS_DB_VERSION = initialArchiveVal;
    });

    // eslint-disable-next-line max-len
    it("should create new DB version and WIPE all existing data if ARCHIVE is false and no TEMP versions currently exist", async () => {
      const { dbAdapter } = campaign;

      const versionDocInitial = await dbAdapter.versioner.getLatestVersion();
      const initialDBVersion = versionDocInitial?.dbVersion;
      const registryDocInitial = await dbAdapter.getContract(znsNames.registry.contract);

      expect(
        process.env.MONGO_DB_VERSION === undefined
        || process.env.MONGO_DB_VERSION === ""
      ).to.be.true;

      // set archiving for the new mongo adapter
      const initialArchiveVal = process.env.ARCHIVE_PREVIOUS_DB_VERSION;
      process.env.ARCHIVE_PREVIOUS_DB_VERSION = "false";

      // run a new campaign
      const { dbAdapter: newDbAdapter } = await runZnsCampaign({
        config: campaignConfig,
      });

      expect(newDbAdapter.curVersion).to.not.equal(initialDBVersion);

      // get some data from new DB version
      const registryDocNew = await newDbAdapter.getContract(znsNames.registry.contract);
      expect(registryDocNew?.version).to.not.equal(registryDocInitial?.version);

      const versionDocNew = await newDbAdapter.versioner.getLatestVersion();
      expect(versionDocNew?.dbVersion).to.not.equal(initialDBVersion);
      expect(versionDocNew?.type).to.equal(VERSION_TYPES.deployed);

      // make sure old contracts from previous DB version are NOT there
      const oldRegistryDocFromNewDB = await newDbAdapter.getContract(
        znsNames.registry.contract,
        initialDBVersion
      );

      expect(oldRegistryDocFromNewDB).to.be.null;

      // reset back to default
      process.env.ARCHIVE_PREVIOUS_DB_VERSION = initialArchiveVal;
    });

    // eslint-disable-next-line max-len
    it("should pick up existing contracts and NOT deploy new ones into state if MONGO_DB_VERSION is specified", async () => {
      const { dbAdapter } = campaign;

      const versionDocInitial = await dbAdapter.versioner.getLatestVersion();
      const initialDBVersion = versionDocInitial?.dbVersion;
      const registryDocInitial = await dbAdapter.getContract(znsNames.registry.contract);

      // set DB version for the new mongo adapter
      const initialDBVersionVal = process.env.MONGO_DB_VERSION;
      process.env.MONGO_DB_VERSION = initialDBVersion;

      // run a new campaign
      const { state: { contracts: newContracts } } = await runZnsCampaign({
        config: campaignConfig,
      });

      // make sure we picked up the correct DB version
      const versionDocNew = await dbAdapter.versioner.getLatestVersion();
      expect(versionDocNew?.dbVersion).to.equal(initialDBVersion);

      // make sure old contracts from previous DB version are still there
      const oldRegistryDocFromNewDB = await dbAdapter.getContract(
        znsNames.registry.contract,
        initialDBVersion
      );

      expect(oldRegistryDocFromNewDB?.version).to.equal(registryDocInitial?.version);
      expect(oldRegistryDocFromNewDB?.address).to.equal(registryDocInitial?.address);
      expect(oldRegistryDocFromNewDB?.name).to.equal(registryDocInitial?.name);
      expect(oldRegistryDocFromNewDB?.abi).to.equal(registryDocInitial?.abi);
      expect(oldRegistryDocFromNewDB?.bytecode).to.equal(registryDocInitial?.bytecode);

      // make sure contracts in state have been picked up correctly from DB
      expect(await newContracts.registry.getAddress()).to.equal(registryDocInitial?.address);

      // reset back to default
      process.env.MONGO_DB_VERSION = initialDBVersionVal;
    });
  });

  describe("Verify - Monitor", () => {
    let config : IZNSCampaignConfig<SignerWithAddress>;

    before (async () => {
      [deployAdmin, admin, governor, zeroVault] = await hre.ethers.getSigners();

      config = {
        env: "dev",
        deployAdmin,
        governorAddresses: [deployAdmin.address, governor.address],
        adminAddresses: [deployAdmin.address, admin.address],
        domainToken: {
          name: ZNS_DOMAIN_TOKEN_NAME,
          symbol: ZNS_DOMAIN_TOKEN_SYMBOL,
          defaultRoyaltyReceiver: deployAdmin.address,
          defaultRoyaltyFraction: DEFAULT_ROYALTY_FRACTION,
        },
        rootPriceConfig: DEFAULT_PRICE_CONFIG,
        zeroVaultAddress: zeroVault.address,
        stakingTokenAddress: ZSepolia.address,
        mockZToken: true,
        postDeploy: {
          tenderlyProjectSlug: "",
          monitorContracts: false,
          verifyContracts: true,
        },
        crosschain: buildCrosschainConfig(),
      };

      config.domainToken.defaultRoyaltyReceiver = deployAdmin.address;
      config.stakingTokenAddress = ZSepolia.address;
      config.postDeploy.tenderlyProjectSlug = "";
      config.postDeploy.verifyContracts = true;
    });

    afterEach(async () => {
      await mongoAdapter.dropDB();
    });

    it("should prepare the correct data for each contract when verifying on Etherscan", async () => {
      const verifyData : Array<{ address : string; ctorArgs ?: TDeployArgs; }> = [];
      class HardhatDeployerMock extends HardhatDeployer<
      HardhatRuntimeEnvironment,
      SignerWithAddress
      > {
        async etherscanVerify (args : {
          address : string;
          ctorArgs ?: TDeployArgs;
        }) {
          verifyData.push(args);
        }
      }

      const deployer = new HardhatDeployerMock({
        hre,
        signer: deployAdmin,
        env,
      });

      const campaign = await runZnsCampaign({
        config,
        deployer,
      });

      const { state: { contracts } } = campaign;
      ({ dbAdapter: mongoAdapter } = campaign);

      await Object.values(contracts).reduce(
        async (acc, contract, idx) => {
          await acc;

          if (idx === 0) {
            expect(verifyData[idx].ctorArgs).to.be.deep.eq([config.governorAddresses, config.adminAddresses]);
          }

          expect(verifyData[idx].address).to.equal(await contract.getAddress());
        },
        Promise.resolve()
      );
    });

    it("should prepare the correct contract data when pushing to Tenderly Project", async () => {
      let tenderlyData : Array<ITenderlyContractData> = [];
      class HardhatDeployerMock extends HardhatDeployer<
      HardhatRuntimeEnvironment,
      SignerWithAddress
      > {
        async tenderlyPush (contracts : Array<ITenderlyContractData>) {
          tenderlyData = contracts;
        }
      }

      const deployer = new HardhatDeployerMock({
        hre,
        signer: deployAdmin,
        env,
      });

      config.postDeploy.monitorContracts = true;
      config.postDeploy.verifyContracts = false;

      const campaign = await runZnsCampaign({
        config,
        deployer,
      });

      const { state: { instances } } = campaign;
      ({ dbAdapter: mongoAdapter } = campaign);

      let idx = 0;
      await Object.values(instances).reduce(
        async (acc, instance) => {
          await acc;

          const dbData = await instance.getFromDB();

          if (instance.proxyData.isProxy) {
            // check proxy
            expect(tenderlyData[idx].address).to.be.eq(dbData?.address);
            expect(tenderlyData[idx].display_name).to.be.eq(`${instance.contractName}Proxy`);

            // check impl
            expect(tenderlyData[idx + 1].address).to.be.eq(dbData?.implementation);
            expect(tenderlyData[idx + 1].display_name).to.be.eq(`${dbData?.name}Impl`);
            expect(tenderlyData[idx + 1].display_name).to.be.eq(`${instance.contractName}Impl`);
            idx += 2;
          } else {
            expect(tenderlyData[idx].address).to.equal(dbData?.address);
            expect(tenderlyData[idx].display_name).to.equal(dbData?.name);
            expect(tenderlyData[idx].display_name).to.equal(instance.contractName);
            idx++;
          }
        },
        Promise.resolve()
      );
    });
  });
});
