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
import { ICampaignArgs, IDeployCampaignConfig } from "../src/deploy/campaign/types";
import { getLogger } from "../src/deploy/logger/create-logger";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { MeowMainnet } from "../src/deploy/missions/contracts/meow-token/mainnet-data";
import { HardhatDeployer } from "../src/deploy/deployer/hardhat-deployer";
import { DeployCampaign } from "../src/deploy/campaign/deploy-campaign";
import { getMongoAdapter } from "../src/deploy/db/mongo-adapter/get-adapter";


describe("Deploy Campaign Test", () => {
  let deployAdmin : SignerWithAddress;
  let admin : SignerWithAddress;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let user : SignerWithAddress;
  let zeroVault : SignerWithAddress;
  let campaignConfig : IDeployCampaignConfig;

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
        // TODO dep: what do we pass here for test flow? we don't have a deployed MeowToken contract
        stakingTokenAddress: "",
        mockMeowToken: true,
      };
    });

    describe("Failure in deploy", () => {
      it("should ONLY deploy undeployed contracts in the run following a failed run", async () => {
        const errorMsg = "FailDeployMission";
        // ZNSAddressResolverDM sits in the middle of the Campaign deploy list
        // we override this class to add a failure to the deploy() method
        class FailingZNSAddressResolverDM extends ZNSAddressResolverDM {
          async deploy () {
            throw new Error(errorMsg);
          }
        }

        const loggerMock = {
          info: () => {},
          debug: () => {},
          error: () => {},
        };

        const deployer = new HardhatDeployer();
        const dbAdapter = await getMongoAdapter();

        const campaign = new DeployCampaign({
          missions: [
            ZNSAccessControllerDM,
            ZNSRegistryDM,
            ZNSDomainTokenDM,
            MeowTokenDM,
            FailingZNSAddressResolverDM, // here is our failing DM
            ZNSCurvePricerDM,
            ZNSTreasuryDM,
            ZNSRootRegistrarDM,
            ZNSFixedPricerDM,
            ZNSSubRegistrarDM,
          ],
          deployer,
          dbAdapter,
          // @ts-ignore
          logger: loggerMock,
          config: campaignConfig,
        });

        try {
          await campaign.execute();
        } catch (e) {
          // @ts-ignore
          expect(e.message).to.include(errorMsg);
        }

        // state should only have 4 contracts in it
        const { contracts } = campaign.state;
        expect(Object.keys(contracts).length).to.equal(4);
        // it should not deploy AddressResolver
        expect(contracts.addressResolver).to.be.undefined;

        // check DB to verify we only deployed half
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

        interface IDeployedData {
          contract : string;
          instance : string;
          address ?: string;
        }

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
            const fromState = campaign[instance];

            expect(fromDB).to.be.null;
            expect(fromState).to.be.undefined;
          },
          Promise.resolve()
        );

        // run Campaign again, but normally
        const campaign2 = await runZnsCampaign({
          config: campaignConfig,
          logger,
        });

        // state should have 10 contracts in it
        const { state } = campaign2;
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
            const fromDB = await dbAdapter.getContract(contract);
            const fromState = campaign[instance];

            expect(fromDB?.address).to.equal(address);
            expect(fromState.address).to.equal(address);
          },
          Promise.resolve()
        );
      });
    });
  });
});
