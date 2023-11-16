import * as hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  DEFAULT_ROYALTY_FRACTION,
  DEFAULT_PRICE_CONFIG,
  ZNS_DOMAIN_TOKEN_NAME,
  ZNS_DOMAIN_TOKEN_SYMBOL,
} from "./helpers";
import { expect } from "chai";
import {
  meowTokenName, meowTokenSymbol,
} from "../src/deploy/missions/contracts";
import { znsNames } from "../src/deploy/missions/contracts/names";
import { IDeployCampaignConfig } from "../src/deploy/campaign/types";
import { getLogger } from "../src/deploy/logger/create-logger";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { MeowMainnet } from "../src/deploy/missions/contracts/meow-token/mainnet-data";


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
});
