/* eslint-disable @typescript-eslint/no-empty-function, @typescript-eslint/ban-ts-comment */
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  defaultRoyaltyFraction,
  priceConfigDefault,
  ZNS_DOMAIN_TOKEN_NAME,
  ZNS_DOMAIN_TOKEN_SYMBOL,
} from "./helpers";
import { expect } from "chai";
import {
  MeowTokenDM,
  meowTokenName,
  meowTokenSymbol,
  ZNSAccessControllerDM,
  ZNSAddressResolverDM,
  ZNSCurvePricerDM,
  ZNSDomainTokenDM, ZNSFixedPricerDM,
  ZNSRegistryDM, ZNSRootRegistrarDM, ZNSSubRegistrarDM, ZNSTreasuryDM,
} from "../src/deploy/missions/contracts";
import { znsNames } from "../src/deploy/missions/contracts/names";
import { ICampaignArgs, IDeployCampaignConfig, TLogger } from "../src/deploy/campaign/types";
import { getLogger } from "../src/deploy/logger/create-logger";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { MeowMainnet } from "../src/deploy/missions/contracts/meow-token/mainnet-data";
import { HardhatDeployer } from "../src/deploy/deployer/hardhat-deployer";
import { DeployCampaign } from "../src/deploy/campaign/deploy-campaign";
import { getMongoAdapter, resetMongoAdapter } from "../src/deploy/db/mongo-adapter/get-adapter";
import { BaseDeployMission } from "../src/deploy/missions/base-deploy-mission";
import { ResolverTypes } from "../src/deploy/constants";
import { ethers } from "hardhat";
import { MongoDBAdapter } from "../src/deploy/db/mongo-adapter/mongo-adapter";


describe("Deploy Campaign Test", () => {
  let deployAdmin : SignerWithAddress;
  let admin : SignerWithAddress;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let user : SignerWithAddress;
  let zeroVault : SignerWithAddress;
  let campaignConfig : IDeployCampaignConfig;

  let mongoAdapter : MongoDBAdapter;

  // TODO dep: move logger to runZNSCampaign()
  const logger = getLogger();

  describe("MEOW Token Ops", () => {
    before(async () => {
      [deployAdmin, admin, zeroVault, user] = await hre.ethers.getSigners();

      campaignConfig = {
        deployAdmin,
        governorAddresses: [ deployAdmin.address ],
        adminAddresses: [ deployAdmin.address, admin.address ],
        domainToken: {
          name: ZNS_DOMAIN_TOKEN_NAME,
          symbol: ZNS_DOMAIN_TOKEN_SYMBOL,
          defaultRoyaltyReceiver: deployAdmin.address,
          defaultRoyaltyFraction,
        },
        rootPriceConfig: priceConfigDefault,
        zeroVaultAddress: zeroVault.address,
        stakingTokenAddress: MeowMainnet.address,
        mockMeowToken: true,
      };
    });

    it("should deploy new MeowTokenMock when `mockMeowToken` is true", async () => {
      const campaign = await runZnsCampaign({
        config: campaignConfig,
        logger,
      });

      const { meowToken, dbAdapter } = campaign;

      const toMint = hre.ethers.utils.parseEther("972315");
      // `mint()` only exists on the Mocked contract
      await meowToken.connect(deployAdmin).mint(
        user.address,
        toMint
      );

      const balance = await meowToken.balanceOf(user.address);
      expect(balance).to.equal(toMint);

      await dbAdapter.dropDB();
    });

    it("should use existing deployed non-mocked MeowToken contract when `mockMeowToken` is false", async () => {
      campaignConfig.mockMeowToken = false;

      // deploy MeowToken contract
      const factory = await hre.ethers.getContractFactory("MeowToken");
      const meow = await hre.upgrades.deployProxy(
        factory,
        [meowTokenName, meowTokenSymbol],
        {
          kind: "transparent",
        });

      await meow.deployed();

      campaignConfig.stakingTokenAddress = meow.address;

      const campaign = await runZnsCampaign({
        config: campaignConfig,
        logger,
      });

      const {
        meowToken,
        dbAdapter,
        state: {
          instances: {
            meowToken: meowDMInstance,
          },
        },
      } = campaign;

      expect(meowToken.address).to.equal(meow.address);
      expect(meowDMInstance.contractName).to.equal(znsNames.meowToken.contract);
      // TODO dep: what else ??

      const toMint = hre.ethers.utils.parseEther("972315");
      // `mint()` only exists on the Mocked contract
      try {
        await meowToken.connect(deployAdmin).mint(
          user.address,
          toMint
        );
      } catch (e) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        expect(e.message).to.include(
          ".mint is not a function"
        );
      }

      await dbAdapter.dropDB();
    });
  });

  describe("Failure Recovery", () => {
    const errorMsgDeploy = "FailMissionDeploy";
    const errorMsgPostDeploy = "FailMissionPostDeploy";

    const loggerMock = {
      info: () => {},
      debug: () => {},
      error: () => {},
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
      missionList : Array<typeof BaseDeployMission>;
      placeOfFailure : string;
      deployedNames : Array<{ contract : string; instance : string; }>;
      undeployedNames : Array<{ contract : string; instance : string; }>;
      failingInstanceName : string;
      callback ?: (failingCampaign : DeployCampaign) => Promise<void>;
    }) => {
      const deployer = new HardhatDeployer();
      let dbAdapter = await getMongoAdapter();

      let toMatchErr = errorMsgDeploy;
      if (placeOfFailure === "postDeploy") {
        toMatchErr = errorMsgPostDeploy;
      }

      const failingCampaign = new DeployCampaign({
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
        expect(contracts[failingInstanceName].address).to.be.properAddress;
      }

      // check DB to verify we only deployed half
      const firstRunDeployed = await deployedNames.reduce(
        async (
          acc : Promise<Array<IDeployedData>>,
          { contract, instance } : { contract : string; instance : string; }
        ) : Promise<Array<IDeployedData>> => {
          const akk = await acc;
          const fromDB = await dbAdapter.getContract(contract);
          expect(fromDB?.address).to.be.properAddress;

          return [...akk, { contract, instance, address: fromDB?.address }];
        },
        Promise.resolve([])
      );

      await undeployedNames.reduce(
        async (
          acc : Promise<void>,
          { contract, instance } : { contract : string; instance : string; }
        ) : Promise<void> => {
          await acc;
          const fromDB = await dbAdapter.getContract(contract);
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
        logger,
      });

      ({ dbAdapter } = nextCampaign);

      // make sure MongoAdapter is using the correct TEMP version
      const { curVersion: nextDbVersion } = dbAdapter;
      expect(nextDbVersion).to.equal(initialDbVersion);

      // state should have 10 contracts in it
      const { state } = nextCampaign;
      expect(Object.keys(state.contracts).length).to.equal(10);
      expect(Object.keys(state.instances).length).to.equal(10);
      expect(state.missions.length).to.equal(10);
      // it should deploy AddressResolver
      expect(state.contracts.addressResolver.address).to.be.properAddress;

      // check DB to verify we deployed everything
      const allNames = deployedNames.concat(undeployedNames);

      await allNames.reduce(
        async (
          acc : Promise<void>,
          { contract } : { contract : string; }
        ) : Promise<void> => {
          await acc;
          const fromDB = await dbAdapter.getContract(contract);
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
          expect(fromState.address).to.equal(address);
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
      [deployAdmin, admin, zeroVault, user] = await hre.ethers.getSigners();

      campaignConfig = {
        deployAdmin,
        governorAddresses: [ deployAdmin.address ],
        adminAddresses: [ deployAdmin.address, admin.address ],
        domainToken: {
          name: ZNS_DOMAIN_TOKEN_NAME,
          symbol: ZNS_DOMAIN_TOKEN_SYMBOL,
          defaultRoyaltyReceiver: deployAdmin.address,
          defaultRoyaltyFraction,
        },
        rootPriceConfig: priceConfigDefault,
        zeroVaultAddress: zeroVault.address,
        // TODO dep: what do we pass here for test flow? we don't have a deployed MeowToken contract
        stakingTokenAddress: "",
        mockMeowToken: true, // 1700083028872
      };

      mongoAdapter = await getMongoAdapter(loggerMock as TLogger);
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
          contract: znsNames.meowToken.contractMock,
          instance: znsNames.meowToken.instance,
        },
      ];

      const undeployedNames = [
        znsNames.addressResolver,
        znsNames.curvePricer,
        znsNames.treasury,
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
          MeowTokenDM,
          FailingZNSAddressResolverDM, // failing DM
          ZNSCurvePricerDM,
          ZNSTreasuryDM,
          ZNSRootRegistrarDM,
          ZNSFixedPricerDM,
          ZNSSubRegistrarDM,
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
          contract: znsNames.meowToken.contractMock,
          instance: znsNames.meowToken.instance,
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

      const checkPostDeploy = async (failingCampaign : DeployCampaign) => {
        const {
          registry,
        } = failingCampaign;

        // we are checking that postDeploy did not add resolverType to Registry
        expect(await registry.getResolverType(ResolverTypes.address)).to.be.equal(ethers.constants.AddressZero);
      };

      // check contracts are deployed correctly
      const {
        nextCampaign,
      } = await runTest({
        missionList: [
          ZNSAccessControllerDM,
          ZNSRegistryDM,
          ZNSDomainTokenDM,
          MeowTokenDM,
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
      expect(await registry.getResolverType(ResolverTypes.address)).to.be.equal(addressResolver.address);
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
          contract: znsNames.meowToken.contractMock,
          instance: znsNames.meowToken.instance,
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
          MeowTokenDM,
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
          contract: znsNames.meowToken.contractMock,
          instance: znsNames.meowToken.instance,
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

      const checkPostDeploy = async (failingCampaign : DeployCampaign) => {
        const {
          accessController,
          rootRegistrar,
        } = failingCampaign;

        // we are checking that postDeploy did not grant REGISTRAR_ROLE to RootRegistrar
        expect(await accessController.isRegistrar(rootRegistrar.address)).to.be.false;
      };

      // check contracts are deployed correctly
      const {
        nextCampaign,
      } = await runTest({
        missionList: [
          ZNSAccessControllerDM,
          ZNSRegistryDM,
          ZNSDomainTokenDM,
          MeowTokenDM,
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
      expect(await accessController.isRegistrar(rootRegistrar.address)).to.be.true;
    });
  });
});
