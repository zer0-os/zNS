import * as hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  DEFAULT_ROYALTY_FRACTION,
  DEFAULT_PRICE_CONFIG,
  ZNS_DOMAIN_TOKEN_NAME,
  ZNS_DOMAIN_TOKEN_SYMBOL,
  INVALID_ENV_ERR,
  NO_MOCK_PROD_ERR,
  STAKING_TOKEN_ERR,
  INVALID_CURVE_ERR,
  MONGO_URI_ERR,
} from "./helpers";
import { expect } from "chai";
import {
  meowTokenName,
  meowTokenSymbol,
} from "../src/deploy/missions/contracts";
import { znsNames } from "../src/deploy/missions/contracts/names";
import { IDeployCampaignConfig } from "../src/deploy/campaign/types";
import { getLogger } from "../src/deploy/logger/create-logger";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { MeowMainnet } from "../src/deploy/missions/contracts/meow-token/mainnet-data";
import { getConfig, validate } from "../src/deploy/campaign/environments";
import { ethers, BigNumber } from "ethers";


describe("Deploy Campaign Test", () => {
  let deployAdmin : SignerWithAddress;
  let admin : SignerWithAddress;
  let governor : SignerWithAddress;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let user : SignerWithAddress;
  let zeroVault : SignerWithAddress;
  let campaignConfig : IDeployCampaignConfig;

  // TODO dep: move logger to runZNSCampaign()
  const logger = getLogger();

  before(async () => {
    [deployAdmin, admin, governor, zeroVault, user] = await hre.ethers.getSigners();
  });

  describe("MEOW Token Ops", () => {
    before(async () => {

      campaignConfig = {
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

  describe("Configurable Environment & Validation", () => {
    // The `validate` function accepts the environment parameter only for the
    // purpose of testing here as manipulating actual environment variables
    // like `process.env.<VAR> = "value"` is not possible in a test environment
    // because the Hardhat process for running these tests will not respect these
    // changes. `getConfig` calls to `validate` on its own, but never passes a value
    // for the environment specifically, that is ever only inferred from the `process.env.ENV_LEVEL`
    it("Throws if env variable is invalid", async () => {
      try {
        const config = await getConfig(
          deployAdmin,
          zeroVault,
          [deployAdmin.address, governor.address],
          [deployAdmin.address, admin.address],
        );

        validate(config, "other");

        /* eslint-disable @typescript-eslint/no-explicit-any */
      } catch (e : any) {
        expect(e.message).includes(INVALID_ENV_ERR);
      }
    });

    it("Fails to validate when mocking MEOW on prod", async () => {
      try {
        const config = await getConfig(
          deployAdmin,
          zeroVault,
          [deployAdmin.address, governor.address],
          [deployAdmin.address, admin.address],
        );
        // Modify the config
        config.mockMeowToken = true;
        validate(config, "prod");

        /* eslint-disable @typescript-eslint/no-explicit-any */
      } catch (e : any) {
        expect(e.message).includes(NO_MOCK_PROD_ERR);
      }
    });

    it("Fails to validate if not using the MEOW token on prod", async () => {
      try {
        const config = await getConfig(
          deployAdmin,
          zeroVault,
          [deployAdmin.address, governor.address],
          [deployAdmin.address, admin.address],
        );

        config.mockMeowToken = false;
        config.stakingTokenAddress = "0x123";

        validate(config, "prod");
        /* eslint-disable @typescript-eslint/no-explicit-any */
      } catch (e : any) {
        expect(e.message).includes(STAKING_TOKEN_ERR);
      }
    });

    it.only("Fails to validate if invalid curve for pricing", async () => {
      try {
        const config = await getConfig(
          deployAdmin,
          zeroVault,
          [deployAdmin.address, governor.address],
          [deployAdmin.address, admin.address],
        );

        config.mockMeowToken = false;
        config.stakingTokenAddress = MeowMainnet.address;
        config.rootPriceConfig.baseLength = BigNumber.from(3);
        config.rootPriceConfig.maxLength = BigNumber.from(5);
        config.rootPriceConfig.maxPrice = ethers.constants.Zero;
        config.rootPriceConfig.minPrice = ethers.utils.parseEther("3");

        validate(config, "prod");
        /* eslint-disable @typescript-eslint/no-explicit-any */
      } catch (e : any) {
        expect(e.message).includes(INVALID_CURVE_ERR);
      }
    });

    it("Fails to validate if no mongo uri or local URI in prod", async () => {
      try {
        const config = await getConfig(
          deployAdmin,
          zeroVault,
          [deployAdmin.address, governor.address],
          [deployAdmin.address, admin.address],
        );

        config.mockMeowToken = false;
        config.stakingTokenAddress = MeowMainnet.address;

        // Normally we would call to an env variable to grab this value
        const uri = "";

        // Falls back onto the default URI which is for localhost and fails in prod
        validate(config, "prod", uri);
        /* eslint-disable @typescript-eslint/no-explicit-any */
      } catch (e : any) {
        expect(e.message).includes(MONGO_URI_ERR);
      }

      try {
        const config = await getConfig(
          deployAdmin,
          zeroVault,
          [deployAdmin.address, governor.address],
          [deployAdmin.address, admin.address],
        );

        config.mockMeowToken = false;
        config.stakingTokenAddress = MeowMainnet.address;

        // Normally we would call to an env variable to grab this value
        const uri = "mongodb://localhost:27018";

        validate(config, "prod", uri);
        /* eslint-disable @typescript-eslint/no-explicit-any */
      } catch (e : any) {
        expect(e.message).includes(MONGO_URI_ERR);
      }
    });
  });
});
