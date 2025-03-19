import * as hre from "hardhat";
import { getConfig } from "../src/deploy/campaign/environments";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import * as ethers from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  AccessType,
  DEFAULT_PRICE_CONFIG,
  distrConfigEmpty,
  paymentConfigEmpty,
  PaymentType,
} from "./helpers";
import { expect } from "chai";
import { registerDomainPath } from "./helpers/flows/registration";
import { IPathRegResult, IZNSContractsLocal } from "./helpers/types";
import { registrationWithSetup } from "./helpers/register-setup";
import { MongoDBAdapter } from "@zero-tech/zdc";


const registryRevertReason = "Transaction reverted: function returned an unexpected amount of data";
const registryRevertReason2 = "Transaction reverted: function call to a non-contract account";

describe("Tests for Migrating ZNS From Ethereum to Meowchain", () => {
  describe("Ethereum Side", () => {
    let deployer : SignerWithAddress;
    let user : SignerWithAddress;
    let governor : SignerWithAddress;
    let admin : SignerWithAddress;
    let randomUser : SignerWithAddress;

    let zns : IZNSContractsLocal;
    let zeroVault : SignerWithAddress;
    let userBalanceInitial : bigint;

    let mongoAdapter : MongoDBAdapter;

    const rootDomainLabel = "root";
    const auxRootDomainLabel = "rootnonrevoked";

    let nonRevokedDomainHash : string;

    let existingDomainData : Array<IPathRegResult>;

    const deadAddress = "0x000000000000000000000000000000000000dead";

    before(async () => {
      [deployer, zeroVault, user, governor, admin, randomUser] = await hre.ethers.getSigners();

      const config = await getConfig({
        deployer,
        zeroVaultAddress: zeroVault.address,
        governors: [deployer.address, governor.address],
        admins: [deployer.address, admin.address],
      });

      const campaign = await runZnsCampaign({
        config,
      });

      zns = campaign.state.contracts as unknown as IZNSContractsLocal;

      mongoAdapter = campaign.dbAdapter;

      await zns.meowToken.connect(deployer).approve(
        await zns.treasury.getAddress(),
        ethers.MaxUint256
      );

      userBalanceInitial = ethers.parseEther("1000000000000000000");
      // Give funds to user
      await zns.meowToken.connect(user).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
      await zns.meowToken.mint(user.address, userBalanceInitial);

      const fixedPrice = ethers.parseEther("2.8373451");
      const domainConfigs = [
        {
          user: deployer,
          domainLabel: rootDomainLabel,
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: deployer.address,
            },
            priceConfig: { price: fixedPrice, feePercentage: BigInt(0) },
          },
        },
        {
          user,
          domainLabel: "lvltwoone",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.curvePricer.getAddress(),
              paymentType: PaymentType.STAKE,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: user.address,
            },
            priceConfig: DEFAULT_PRICE_CONFIG,
          },
        },
      ];

      zns.zeroVaultAddress = zeroVault.address;
      // create initial domains before locking the system to test some flows
      // first make a root with its sub
      existingDomainData = await registerDomainPath({
        zns,
        domainConfigs,
      });

      await zns.meowToken.connect(user).approve(
        await zns.treasury.getAddress(),
        ethers.MaxUint256
      );
      // make another root for other tests after revocation
      nonRevokedDomainHash = await registrationWithSetup({
        zns,
        user,
        domainLabel: auxRootDomainLabel,
        fullConfig: domainConfigs[0].fullConfig,
      });
    });

    after(async () => {
      await mongoAdapter.dropDB();
    });

    describe("Registry Access Block Method", () => {
      it("[ZNSRootRegistrar] Should revert on any domain related call to ZNSRootRegistrar", async () => {
        // we set dead `registry` address
        // so that no root domain can be registered by all functions reverting,
        // since all the functions use `registry` for access control,
        // this should also block access to ALL domain related functions
        await zns.rootRegistrar.connect(deployer).setRegistry(deadAddress);

        // transfer domain to another address to test reclaim (just in case)
        await zns.registry.connect(user).updateDomainOwner(nonRevokedDomainHash, randomUser.address);

        // prepare all calls to check if they revert
        const calls = [
          zns.rootRegistrar.connect(randomUser).registerRootDomain(
            "randomname",
            hre.ethers.ZeroAddress,
            "w://dummyURI",
            distrConfigEmpty,
            paymentConfigEmpty,
          ),
          zns.rootRegistrar.connect(deployer).revokeDomain(existingDomainData[0].domainHash),
          zns.rootRegistrar.connect(user).reclaimDomain(nonRevokedDomainHash),
        ];

        // run all the calls that should revert and make sure they do
        await calls.reduce(
          async (acc, call) => {
            await acc;
            try {
              await call;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (e : any) {
              expect(e.message).to.satisfy(
                (msg : string) => msg === registryRevertReason || msg === registryRevertReason2
              );
            }
          }, Promise.resolve()
        );

        // set owner back
        await zns.registry.connect(randomUser).updateDomainOwner(nonRevokedDomainHash, user.address);
      });

      it("[ZNSSubRegistrar] Should revert on any domain related call to ZNSSubRegistrar", async () => {
        // we set dead `registry` address
        // so that no subdomain can be registered by all functions reverting,
        // since all the functions use `registry` for access control
        // this should also block access to ALL domain related functions
        await zns.subRegistrar.connect(deployer).setRegistry(deadAddress);

        // prepare all calls to check if they revert
        const calls = [
          zns.subRegistrar.connect(randomUser).registerSubdomain(
            nonRevokedDomainHash,
            "nonrevokedchild",
            randomUser.address,
            "https://example.com/817c64af",
            distrConfigEmpty,
            paymentConfigEmpty
          ),
          zns.subRegistrar.connect(randomUser).setDistributionConfigForDomain(
            nonRevokedDomainHash,
            distrConfigEmpty
          ),
          zns.subRegistrar.connect(randomUser).setPricerContractForDomain(
            nonRevokedDomainHash,
            zns.curvePricer.target,
          ),
          zns.subRegistrar.connect(randomUser).setPaymentTypeForDomain(
            nonRevokedDomainHash,
            PaymentType.STAKE
          ),
          zns.subRegistrar.connect(randomUser).setAccessTypeForDomain(
            nonRevokedDomainHash,
            AccessType.MINTLIST
          ),
          zns.subRegistrar.connect(randomUser).updateMintlistForDomain(
            nonRevokedDomainHash,
            [randomUser.address],
            [true]
          ),
          zns.subRegistrar.connect(randomUser).clearMintlistForDomain(nonRevokedDomainHash),
          zns.subRegistrar.connect(randomUser).clearMintlistAndLock(nonRevokedDomainHash),
        ];

        // run all the calls that should revert and make sure they do
        await calls.reduce(
          async (acc, call) => {
            await acc;
            try {
              await call;
            } catch (e) {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              expect(e.message).to.equal(registryRevertReason);
            }
          }, Promise.resolve()
        );
      });

      it("Should unblock registration by setting `registry` address back to proper value", async () => {
        // set registry back to proper value
        await zns.rootRegistrar.connect(deployer).setRegistry(zns.registry.target);
        await zns.subRegistrar.connect(deployer).setRegistry(zns.registry.target);

        // try to register a root domain
        const tx = await zns.rootRegistrar.connect(user).registerRootDomain(
          "randomname",
          hre.ethers.ZeroAddress,
          "w://dummyURI",
          distrConfigEmpty,
          paymentConfigEmpty,
        );

        expect(tx).to.not.be.undefined;

        const tx2 = await zns.subRegistrar.connect(user).registerSubdomain(
          nonRevokedDomainHash,
          "nonrevokedchild",
          randomUser.address,
          "https://example.com/817c64af",
          distrConfigEmpty,
          paymentConfigEmpty
        );

        expect(tx2).to.not.be.undefined;
      });
    });
  });
});
