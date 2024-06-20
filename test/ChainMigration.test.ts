import * as hre from "hardhat";
import { getConfig } from "../src/deploy/campaign/environments";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import * as ethers from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { MongoDBAdapter } from "@zero-tech/zdc";
import {
  AccessType,
  DEFAULT_PRICE_CONFIG,
  distrConfigEmpty, INVALID_TOKENID_ERC_ERR,
  normalizeName,
  paymentConfigEmpty,
  PaymentType,
} from "./helpers";
import { expect } from "chai";
import { registerDomainPath } from "./helpers/flows/registration";
import { IPathRegResult, IZNSContractsLocal } from "./helpers/types";
import { MigrationRootPricerMock } from "../typechain";
import { registrationWithSetup } from "./helpers/register-setup";


describe.only("Tests for Migrating ZNS From Ethereum to Meowchain", () => {
  describe("Ethereum Side", () => {
    let deployer : SignerWithAddress;
    let user : SignerWithAddress;
    let governor : SignerWithAddress;
    let admin : SignerWithAddress;
    let randomUser : SignerWithAddress;

    let zns : IZNSContractsLocal;
    let zeroVault : SignerWithAddress;
    let operator : SignerWithAddress;
    let userBalanceInitial : bigint;

    let mongoAdapter : MongoDBAdapter;

    let migrationPricer : MigrationRootPricerMock;

    const newDomain = normalizeName("wilder");

    let nonRevokedDomainHash : string;

    let existingDomainData : Array<IPathRegResult>;

    before(async () => {
      [deployer, zeroVault, user, operator, governor, admin, randomUser] = await hre.ethers.getSigners();

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
          domainLabel: "root",
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
      // first make a root with it's sub
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
        domainLabel: "nonrevoked",
        fullConfig: domainConfigs[0].fullConfig,
      });

      // since for every root domain we need a pricer call to determine the price of registration,
      // and we need `reclaim()` and `revoke()` to still be available
      // we are deploying a new Mocked Pricer that will be set for root domains and will revert every time
      // a price is being read with `getPrice()` or `getPriceAndFee()`,
      // but will return "0" when reading the fee with `getFeeForPrice()` since it is needed in `revokeDomain()`
      const migrationPricerFact = await hre.ethers.getContractFactory("MigrationRootPricerMock");
      migrationPricer = await migrationPricerFact.deploy();
      await migrationPricer.waitForDeployment();

      await zns.rootRegistrar.setRootPricer(await migrationPricer.getAddress());
    });

    it("[ZNSRootRegistrar] Should lock ALL user access to registration flow of root domains", async () => {
      await expect(
        zns.rootRegistrar.connect(deployer).registerRootDomain(
          newDomain,
          deployer.address,
          "https://example.com/817c64af",
          distrConfigEmpty,
          paymentConfigEmpty
        )
      ).to.be.revertedWithCustomError(migrationPricer, "DomainRegistrationDisabled");
    });

    // eslint-disable-next-line max-len
    it("[ZNSRootRegistrar] Should let `reclaimDomain()` and `revokeDomain()` for previously existing domains", async () => {
      // we can't lock these functions since they are needed to be available for existing domains
      // so we need to test that they work as expected

      const rootDomainHash = existingDomainData[0].domainHash;
      const subDomainHash = existingDomainData[1].domainHash;

      // transfer domain token first
      await zns.domainToken.connect(deployer).transferFrom(
        deployer.address,
        user.address,
        rootDomainHash
      );
      // reclaim domain
      await zns.rootRegistrar.connect(user).reclaimDomain(rootDomainHash);
      // check data
      const nameOwner = await zns.registry.getDomainOwner(rootDomainHash);
      const tokenOwner = await zns.domainToken.ownerOf(rootDomainHash);
      expect(nameOwner).to.equal(user.address);
      expect(tokenOwner).to.equal(user.address);

      // now revoke domain
      await zns.rootRegistrar.connect(user).revokeDomain(rootDomainHash);
      // check data
      const exists = await zns.registry.exists(rootDomainHash);
      expect(exists).to.equal(false);
      await expect(
        zns.domainToken.ownerOf(rootDomainHash)
      ).to.be.revertedWith(INVALID_TOKENID_ERC_ERR);

      // try the same with subdomain
      // transfer domain token first
      await zns.domainToken.connect(user).transferFrom(
        user.address,
        deployer.address,
        subDomainHash
      );
      // reclaim domain
      await zns.rootRegistrar.connect(deployer).reclaimDomain(subDomainHash);
      // check data
      const nameOwnerSub = await zns.registry.getDomainOwner(subDomainHash);
      const tokenOwnerSub = await zns.domainToken.ownerOf(subDomainHash);
      expect(nameOwnerSub).to.equal(deployer.address);
      expect(tokenOwnerSub).to.equal(deployer.address);

      // now revoke domain
      await zns.rootRegistrar.connect(deployer).revokeDomain(subDomainHash);
      // check data
      const existsSub = await zns.registry.exists(subDomainHash);
      expect(existsSub).to.equal(false);
      await expect(
        zns.domainToken.ownerOf(subDomainHash)
      ).to.be.revertedWith(INVALID_TOKENID_ERC_ERR);
    });

    it("[ZNSSubRegistrar] Should revert on any domain related call to ZNSSubRegistrar", async () => {
      // with SubRegistrar the approach needs to be different
      // here the pricers are set by the parent domain owner, but no other flows on contract
      // need to be available after lock, unlike in RootRegistrar,
      // so instead of setting a pricer, we set dead `registry` address
      // so that no sub domain can be registered by all functions reverting,
      // since all the functions use `registry` for access control

      const deadAddress = "0x000000000000000000000000000000000000dead";
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
            expect(e.message).to.include("Transaction reverted: function returned an unexpected amount of data");
          }
        }, Promise.resolve()
      );
    });
  });
});
