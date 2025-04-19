/* eslint-disable @typescript-eslint/ban-ts-comment, no-shadow */
import * as hre from "hardhat";
import { IDeployCampaignConfig, TZNSContractState } from "../src/deploy/campaign/types";
import { getConfig } from "../src/deploy/campaign/environments";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getContractDataForUpgrade, getContractNamesToUpgrade, upgradeZNS } from "../src/upgrade/upgrade";
import { ContractStorageData, IContractData, IZNSContractsUpgraded } from "../src/upgrade/types";
import { znsNames } from "../src/deploy/missions/contracts/names";
import { expect } from "chai";
import {
  AccessType,
  curvePriceConfigEmpty,
  DEFAULT_PRICE_CONFIG,
  distrConfigEmpty,
  getAccessRevertMsg,
  GOVERNOR_ROLE,
  paymentConfigEmpty,
  PaymentType,
  REGISTRAR_ROLE,
} from "./helpers";
import { registerDomainPath } from "./helpers/flows/registration";
import { IDomainConfigForTest, IFixedPriceConfig, ZNSContract } from "./helpers/types";
import * as ethers from "ethers";
import { readContractStorage } from "../src/upgrade/storage-data";
import { MongoDBAdapter } from "../src/deploy/db/mongo-adapter/mongo-adapter";
import { IContractDbData } from "../src/deploy/db/types";
import { IDBVersion } from "../src/deploy/db/mongo-adapter/types";
import { getMongoAdapter, resetMongoAdapter } from "../src/deploy/db/mongo-adapter/get-adapter";
import { getLogger } from "../src/deploy/logger/create-logger";
import { updateDbAndVerifyAll } from "../src/upgrade/db";
import { VERSION_TYPES } from "../src/deploy/db/mongo-adapter/constants";
import { getGitTag } from "../src/utils/git-tag/get-tag";
import { withdrawStakedByGovernon } from "../src/scripts/witdrawStaked";


describe("ZNS Upgrade and Pause Test", () => {
  let deployer : SignerWithAddress;
  let rootOwner : SignerWithAddress;
  let lvl2SubOwner : SignerWithAddress;
  let lvl3SubOwner : SignerWithAddress;
  let lvl4SubOwner : SignerWithAddress;
  let lvl5SubOwner : SignerWithAddress;
  let lvl6SubOwner : SignerWithAddress;

  let zns : TZNSContractState;

  let domainConfigs : Array<IDomainConfigForTest>;
  let domainHashes : Array<string>;

  const fixedPrice = ethers.parseEther("1375.612");
  const fixedFeePercentage = BigInt(200);

  const contractNames = getContractNamesToUpgrade();

  let contractData : Array<IContractData>;
  let znsUpgraded : IZNSContractsUpgraded;

  let preUpgradeZnsStorage : Array<ContractStorageData>;
  let preUpgradeImpls : Array<string>;

  const logger = getLogger();

  const isRealNetwork = hre.network.name !== "hardhat";

  let methodCalls : {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key : string] : Array<{ method : string; args : Array<any>; }>;
  };

  let dbVersionDeploy : IDBVersion;
  let dbAdapterUpgrade : MongoDBAdapter;

  before(async () => {
    [
      deployer,
      rootOwner,
      lvl2SubOwner,
      lvl3SubOwner,
      lvl4SubOwner,
      lvl5SubOwner,
      lvl6SubOwner,
    ] = await hre.ethers.getSigners();

    // to make sure the test runs on any machine
    process.env.MOCK_MEOW_TOKEN = "true";

    const config : IDeployCampaignConfig = await getConfig({
      deployer,
      zeroVaultAddress: hre.network.name !== "hardhat"
        ? process.env.ZERO_VAULT_ADDRESS as string
        : deployer.address,
    });

    resetMongoAdapter();

    const campaign = await runZnsCampaign({
      config,
    });

    zns = campaign.state.contracts;
    zns.zeroVaultAddress = hre.network.name !== "hardhat"
      ? process.env.ZERO_VAULT_ADDRESS as string
      : deployer.address;

    const { dbAdapter: dbAdapterDeploy } = campaign;

    // get base contract level storage for each contract pre-upgrade
    preUpgradeZnsStorage = await Object.values(contractNames).reduce(
      async (acc : Promise<Array<ContractStorageData>>, { contract, instance }) => {
        const newAcc = await acc;

        const contractFactory = await hre.ethers.getContractFactory(contract);
        const contractObj = zns[instance] as ZNSContract;

        const storage = await readContractStorage(contractFactory, contractObj);

        return [...newAcc, storage];
      }, Promise.resolve([])
    );

    logger.debug("Funding users...");
    // Give funds to users
    await [
      rootOwner,
      lvl2SubOwner,
      lvl3SubOwner,
      lvl4SubOwner,
      lvl5SubOwner,
      lvl6SubOwner,
    ].reduce(async (acc, { address }) => {
      await acc;
      const tx = await zns.meowToken.mint(address, ethers.parseEther("1000000"));
      if (isRealNetwork) await tx.wait(2);
    }, Promise.resolve()
    );
    const tx = await zns.meowToken.connect(rootOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
    if (isRealNetwork) await tx.wait(2);

    // register a bunch of domains pre-upgrade
    domainConfigs = [
      {
        user: rootOwner,
        domainLabel: "root",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            paymentType: PaymentType.DIRECT,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
          priceConfig: { price: fixedPrice, feePercentage: BigInt(0) },
        },
      },
      {
        user: lvl2SubOwner,
        domainLabel: "lvltwo",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            paymentType: PaymentType.STAKE,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
          priceConfig: DEFAULT_PRICE_CONFIG,
        },
      },
      {
        user: lvl3SubOwner,
        domainLabel: "lvlthree",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            paymentType: PaymentType.DIRECT,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl3SubOwner.address,
          },
          priceConfig: DEFAULT_PRICE_CONFIG,
        },
      },
      {
        user: lvl4SubOwner,
        domainLabel: "lvlfour",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            paymentType: PaymentType.STAKE,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl4SubOwner.address,
          },
          priceConfig: DEFAULT_PRICE_CONFIG,
        },
      },
      {
        user: lvl5SubOwner,
        domainLabel: "lvlfive",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            paymentType: PaymentType.DIRECT,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl5SubOwner.address,
          },
          priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
        },
      },
      {
        user: lvl6SubOwner,
        domainLabel: "lvlsix",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            paymentType: PaymentType.STAKE,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl6SubOwner.address,
          },
          priceConfig: DEFAULT_PRICE_CONFIG,
        },
      },
    ];

    logger.debug("Registering a path of domains...");
    const regResults = await registerDomainPath({
      zns,
      domainConfigs,
      confirmations: isRealNetwork ? 2 : undefined,
    });

    domainHashes = regResults.map(({ domainHash }) => domainHash);

    // get contract data for the upgrade helper
    contractData = await getContractDataForUpgrade(dbAdapterDeploy, getContractNamesToUpgrade());

    process.env.MONGO_DB_VERSION = dbAdapterDeploy.curVersion;
    dbVersionDeploy = await dbAdapterDeploy.getLatestVersion() as IDBVersion;

    preUpgradeImpls = await Object.values(contractNames).reduce(
      async (acc : Promise<Array<string>>, { instance }) => {
        const newAcc = await acc;

        const implAddress = await hre.upgrades.erc1967.getImplementationAddress(
          zns[instance].target as string
        );

        return [...newAcc, implAddress];
      }, Promise.resolve([])
    );

    resetMongoAdapter();
    dbAdapterUpgrade = await getMongoAdapter();

    // run the upgrade
    znsUpgraded = await upgradeZNS({
      governorExt: deployer,
      contractData,
      logger,
    });

    // update database records to new implementations
    await updateDbAndVerifyAll(dbAdapterUpgrade);

    // list of all the methods that are blocked with `whenNotPaused` modifier
    // along with arguments for calls
    methodCalls = {
      [znsNames.registry.instance]: [
        {
          method: "setOwnersOperator",
          args: [deployer.address, true],
        },
        {
          method: "createDomainRecord",
          args: [hre.ethers.ZeroHash, deployer.address, "address"],
        },
        {
          method: "updateDomainRecord",
          args: [hre.ethers.ZeroHash, deployer.address, "address"],
        },
        {
          method: "updateDomainOwner",
          args: [hre.ethers.ZeroHash, deployer.address],
        },
        {
          method: "updateDomainResolver",
          args: [hre.ethers.ZeroHash, "address"],
        },
        {
          method: "deleteRecord",
          args: [hre.ethers.ZeroHash],
        },
        {
          method: "pause",
          args: [],
        },
      ],
      [znsNames.domainToken.instance]: [
        {
          method: "transferFrom",
          args: [deployer.address, rootOwner.address, 1],
        },
        {
          // @ts-ignore
          method: "safeTransferFrom(address,address,uint256)",
          args: [deployer.address, rootOwner.address, "1"],
        },
        {
          // @ts-ignore
          method: "safeTransferFrom(address,address,uint256,bytes)",
          args: [deployer.address, rootOwner.address, "1", hre.ethers.ZeroHash],
        },
        {
          method: "approve",
          args: [rootOwner.address, 1],
        },
        {
          method: "setApprovalForAll",
          args: [rootOwner.address, true],
        },
        {
          method: "register",
          args: [rootOwner.address, 123n, "dummyURI"],
        },
        {
          method: "revoke",
          args: [123n],
        },
        {
          method: "pause",
          args: [],
        },
      ],
      [znsNames.addressResolver.instance]: [
        {
          method: "setAddress",
          args: [hre.ethers.ZeroHash, rootOwner.address],
        },
        {
          method: "pause",
          args: [],
        },
      ],
      [znsNames.curvePricer.instance]: [
        {
          method: "setPriceConfig",
          args: [hre.ethers.ZeroHash, curvePriceConfigEmpty],
        },
        {
          method: "setMaxPrice",
          args: [hre.ethers.ZeroHash, 1],
        },
        {
          method: "setMinPrice",
          args: [hre.ethers.ZeroHash, 1],
        },
        {
          method: "setBaseLength",
          args: [hre.ethers.ZeroHash, 1],
        },
        {
          method: "setMaxLength",
          args: [hre.ethers.ZeroHash, 1],
        },
        {
          method: "setPrecisionMultiplier",
          args: [hre.ethers.ZeroHash, 1],
        },
        {
          method: "setFeePercentage",
          args: [hre.ethers.ZeroHash, 1],
        },
        {
          method: "pause",
          args: [],
        },
      ],
      [znsNames.fixedPricer.instance]: [
        {
          method: "setPrice",
          args: [hre.ethers.ZeroHash, 1n],
        },
        {
          method: "setFeePercentage",
          args: [hre.ethers.ZeroHash, 1],
        },
        {
          method: "setPriceConfig",
          args: [hre.ethers.ZeroHash, { price: 1n, feePercentage: 1n, isSet: true }],
        },
        {
          method: "pause",
          args: [],
        },
      ],
      [znsNames.treasury.instance]: [
        {
          method: "stakeForDomain",
          args: [hre.ethers.ZeroHash, hre.ethers.ZeroHash, rootOwner.address, 1n, 1n, 1n],
        },
        {
          method: "unstakeForDomain",
          args: [hre.ethers.ZeroHash, rootOwner.address],
        },
        {
          method: "processDirectPayment",
          args: [hre.ethers.ZeroHash, hre.ethers.ZeroHash, rootOwner.address, 1n, 1n],
        },
        {
          method: "setPaymentConfig",
          args: [hre.ethers.ZeroHash, paymentConfigEmpty],
        },
        {
          method: "setBeneficiary",
          args: [hre.ethers.ZeroHash, rootOwner.address],
        },
        {
          method: "setPaymentToken",
          args: [hre.ethers.ZeroHash, rootOwner.address],
        },
        {
          method: "pause",
          args: [],
        },
      ],
      [znsNames.rootRegistrar.instance]: [
        {
          method: "registerRootDomain",
          args: ["domain", rootOwner.address, "uri", distrConfigEmpty, paymentConfigEmpty],
        },
        {
          method: "revokeDomain",
          args: [hre.ethers.ZeroHash],
        },
        {
          method: "reclaimDomain",
          args: [hre.ethers.ZeroHash],
        },
        {
          method: "pause",
          args: [],
        },
      ],
      [znsNames.subRegistrar.instance]: [
        {
          method: "registerSubdomain",
          args: [hre.ethers.ZeroHash, "label", rootOwner.address, "uri", distrConfigEmpty, paymentConfigEmpty],
        },
        {
          method: "setDistributionConfigForDomain",
          args: [hre.ethers.ZeroHash, distrConfigEmpty],
        },
        {
          method: "setPricerContractForDomain",
          args: [hre.ethers.ZeroHash, rootOwner.address],
        },
        {
          method: "setPaymentTypeForDomain",
          args: [hre.ethers.ZeroHash, 0],
        },
        {
          method: "setAccessTypeForDomain",
          args: [hre.ethers.ZeroHash, 0],
        },
        {
          method: "updateMintlistForDomain",
          args: [hre.ethers.ZeroHash, [rootOwner.address], [true]],
        },
        {
          method: "clearMintlistForDomain",
          args: [hre.ethers.ZeroHash],
        },
        {
          method: "clearMintlistAndLock",
          args: [hre.ethers.ZeroHash],
        },
        {
          method: "pause",
          args: [],
        },
      ],
    };
  });

  after(async () => {
    if (hre.network.name === "hardhat") {
      await dbAdapterUpgrade.dropDB();
      resetMongoAdapter();
      process.env.MONGO_DB_VERSION = "";
    }
  });

  it("should keep the same proxy addresses for each contract", async () => {
    expect(znsUpgraded.registry.target).to.equal(zns.registry.target);
    expect(znsUpgraded.domainToken.target).to.equal(zns.domainToken.target);
    expect(znsUpgraded.addressResolver.target).to.equal(zns.addressResolver.target);
    expect(znsUpgraded.curvePricer.target).to.equal(zns.curvePricer.target);
    expect(znsUpgraded.fixedPricer.target).to.equal(zns.fixedPricer.target);
    expect(znsUpgraded.treasury.target).to.equal(zns.treasury.target);
    expect(znsUpgraded.rootRegistrar.target).to.equal(zns.rootRegistrar.target);
    expect(znsUpgraded.subRegistrar.target).to.equal(zns.subRegistrar.target);
  });

  it("should upgrade each implementation to a new one", async () => {
    await Object.values(contractNames).reduce(
      async (acc, { instance }, idx) => {
        await acc;

        const implAddressPostUpgrade = await hre.upgrades.erc1967.getImplementationAddress(
          znsUpgraded[instance].target as string
        );

        expect(implAddressPostUpgrade).to.not.equal(preUpgradeImpls[idx]);
      }, Promise.resolve()
    );
  });

  describe("Database tests", () => {
    let upgradedDbVersion : string;
    let contractsVersion : string;

    it("should create new version in the database", async () => {
      ({
        dbVersion: upgradedDbVersion,
        contractsVersion,
      } = await dbAdapterUpgrade.versions.findOne({
        type: VERSION_TYPES.upgraded,
      }) as IDBVersion);

      expect(dbVersionDeploy.dbVersion).to.not.equal(upgradedDbVersion);
      expect(upgradedDbVersion).to.not.equal(process.env.MONGO_DB_VERSION);

      expect(contractsVersion).to.equal(getGitTag());
    });

    it("should update docs for each upgraded contract properly", async () => {
      await Object.values(contractNames).reduce(
        async (acc, { contract, instance }) => {
          await acc;

          const {
            abi: abiPreUpgrade,
            bytecode: bytecodePreUpgrade,
          } = hre.artifacts.readArtifactSync(contract);
          const {
            abi: abiPausable,
            bytecode: bytecodePausable,
          } = hre.artifacts.readArtifactSync(`${contract}Pausable`);

          const {
            abi: abiPostUpgrade,
            bytecode: bytecodePostUpgrade,
            implementation: implPostUpgrade,
            version: versionPostUpgrade,
          } = await dbAdapterUpgrade.getContract(contract, upgradedDbVersion) as IContractDbData;

          const implAddress = await hre.upgrades.erc1967.getImplementationAddress(
            znsUpgraded[instance].target as string
          );

          expect(implAddress).to.equal(implPostUpgrade);

          expect(JSON.stringify(abiPreUpgrade)).to.not.equal(abiPostUpgrade);
          expect(abiPostUpgrade).to.equal(JSON.stringify(abiPausable));

          expect(bytecodePreUpgrade).to.not.equal(bytecodePostUpgrade);
          expect(bytecodePostUpgrade).to.equal(bytecodePausable);

          expect(versionPostUpgrade).to.not.equal(dbVersionDeploy.dbVersion);
          expect(versionPostUpgrade).to.equal(upgradedDbVersion);
        }, Promise.resolve()
      );
    });
  });

  describe("Post upgrade storage tests", () => {
    it("should be able to operate on pre-upgrade domains and properly reflect changes in storage", async () => {
      await domainConfigs.reduce(
        async (
          acc,
          { user, fullConfig },
          idx
        ) => {
          await acc;
          const domainHash = domainHashes[idx];

          // check SubRegistrar storage
          const newPricer = fullConfig.distrConfig.pricerContract === zns.curvePricer.target
            ? zns.fixedPricer.target
            : zns.curvePricer.target;
          const newPaymentType = fullConfig.distrConfig.paymentType === PaymentType.DIRECT
            ? PaymentType.STAKE
            : PaymentType.DIRECT;
          const newAccessType = fullConfig.distrConfig.accessType === AccessType.OPEN
            ? AccessType.LOCKED
            : AccessType.OPEN;

          // set new values
          let tx = await zns.subRegistrar.connect(user).setDistributionConfigForDomain(
            domainHash,
            {
              pricerContract: newPricer,
              paymentType: newPaymentType,
              accessType: newAccessType,
            }
          );
          if (isRealNetwork) await tx.wait(2);
          // check new values
          const domainConfig = await zns.subRegistrar.distrConfigs(domainHash);
          expect(domainConfig.pricerContract).to.equal(newPricer);
          expect(domainConfig.paymentType).to.equal(newPaymentType);
          expect(domainConfig.accessType).to.equal(newAccessType);

          // check Treasury storage
          // set new values
          tx = await zns.treasury.connect(user).setPaymentConfig(
            domainHash,
            {
              token: rootOwner.address,
              beneficiary: rootOwner.address,
            }
          );
          if (isRealNetwork) await tx.wait(2);
          // check new values
          const paymentConfig = await zns.treasury.paymentConfigs(domainHash);
          expect(paymentConfig.token).to.equal(rootOwner.address);
          expect(paymentConfig.beneficiary).to.equal(rootOwner.address);

          if ((fullConfig.priceConfig as IFixedPriceConfig).price) {
            // check FixedPricer storage
            const newPriceConfig = {
              price: 111n,
              feePercentage: 111n,
              isSet: true,
            };
            // set new values
            tx = await zns.fixedPricer.connect(user).setPriceConfig(domainHash, newPriceConfig);
            if (isRealNetwork) await tx.wait(2);

            const priceConfig = await zns.fixedPricer.priceConfigs(domainHash);
            expect(priceConfig.price).to.equal(newPriceConfig.price);
            expect(priceConfig.feePercentage).to.equal(newPriceConfig.feePercentage);
          } else {
            // check CurvePricer storage
            const newPriceConfig = {
              maxPrice: hre.ethers.parseEther("1000"),
              minPrice: hre.ethers.parseEther("100"),
              maxLength: 100n,
              baseLength: 10n,
              precisionMultiplier: 10n ** 14n,
              feePercentage: 100n,
              isSet: true,
            };
            // set new values
            tx = await zns.curvePricer.connect(user).setPriceConfig(domainHash, newPriceConfig);
            if (isRealNetwork) await tx.wait(2);
            // check new values
            const priceConfig = await zns.curvePricer.priceConfigs(domainHash);
            expect(priceConfig.maxPrice).to.equal(newPriceConfig.maxPrice);
            expect(priceConfig.minPrice).to.equal(newPriceConfig.minPrice);
            expect(priceConfig.maxLength).to.equal(newPriceConfig.maxLength);
            expect(priceConfig.baseLength).to.equal(newPriceConfig.baseLength);
            expect(priceConfig.precisionMultiplier).to.equal(newPriceConfig.precisionMultiplier);
            expect(priceConfig.feePercentage).to.equal(newPriceConfig.feePercentage);
            expect(priceConfig.isSet).to.equal(newPriceConfig.isSet);
          }

          // check AddressResolver storage
          // set new values
          tx = await zns.addressResolver.connect(user).setAddress(domainHash, rootOwner.address);
          if (isRealNetwork) await tx.wait(2);
          // check new values
          const addr = await zns.addressResolver.resolveDomainAddress(domainHash);
          expect(addr).to.equal(rootOwner.address);

          // check DomainToken storage
          // set new values
          tx = await zns.domainToken.connect(user).transferFrom(user.address, rootOwner.address, BigInt(domainHash));
          if (isRealNetwork) await tx.wait(2);
          // check new values
          const tokenOwner = await zns.domainToken.ownerOf(BigInt(domainHash));
          expect(tokenOwner).to.equal(rootOwner.address);

          // check Registry storage
          // set new values
          tx = await zns.registry.connect(user).updateDomainOwner(domainHash, rootOwner.address);
          if (isRealNetwork) await tx.wait(2);

          // check new values
          const owner = await zns.registry.getDomainOwner(domainHash);
          expect(owner).to.equal(rootOwner.address);
        }, Promise.resolve()
      );
    });

    it("should NOT change any contract level storage variables", async () => {
      const postUpgradeStorageData = await Object.values(contractNames).reduce(
        async (acc : Promise<Array<ContractStorageData>>, { contract, instance }) => {
          const newAcc = await acc;

          const contractFactory = await hre.ethers.getContractFactory(contract);
          const contractObj = znsUpgraded[instance];

          const storage = await readContractStorage(contractFactory, contractObj);

          return [...newAcc, storage];
        }, Promise.resolve([])
      );

      preUpgradeZnsStorage.forEach((storagePre, idx) => {
        const storagePost = postUpgradeStorageData[idx];

        expect(storagePre.length).to.equal(storagePost.length);

        storagePre.forEach((pre, idx2) => {
          const post = storagePost[idx2];

          expect(pre).to.deep.equal(post);
        });
      });
    });
  });

  describe("Should pause contracts and lock all functions with `whenNotPaused` modifier", () => {
    Object.values(contractNames).forEach(
      ({ contract: name, instance }) => {
        it(`${name}`, async () => {
          const contract = znsUpgraded[instance];

          const tx = await contract.connect(deployer).pause();
          if (isRealNetwork) await tx.wait(2);

          expect(await contract.paused()).to.equal(true);

          const methods = methodCalls[instance];

          for (const { method, args } of methods) {
            // @ts-ignore
            await expect(contract[method](...args)).to.be.revertedWith(`${name}: Contract is paused`);
          }
        });
      }
    );
  });

  describe("#withdrawStaked()", () => {
    before(async () => {
      await znsUpgraded.treasury.connect(deployer).unpause();
    });

    after(async () => {
      await znsUpgraded.treasury.connect(deployer).pause();
    });

    it("should withdraw the correct amount", async () => {
      await zns.accessController.connect(deployer).grantRole(
        REGISTRAR_ROLE,
        deployer.address
      );
      const stakeAmt = ethers.parseEther("1");
      const protocolFee = ethers.parseEther("3");

      const contractBalanceBeforeStake = await zns.meowToken.balanceOf(zns.treasury.target);

      await znsUpgraded.treasury.connect(deployer).stakeForDomain(
        ethers.ZeroHash,
        domainHashes[0],
        lvl6SubOwner.address,
        stakeAmt,
        BigInt(0),
        protocolFee
      );

      const {
        token,
      } = await znsUpgraded.treasury.stakedForDomain(domainHashes[0]);

      const balanceBeforeWithdraw = await zns.meowToken.balanceOf(lvl6SubOwner.address);

      await znsUpgraded.treasury.connect(deployer).withdrawStaked(
        token,
        lvl6SubOwner.address
      );

      const balanceAfterWithdraw = await zns.meowToken.balanceOf(lvl6SubOwner.address);

      expect(
        balanceAfterWithdraw - balanceBeforeWithdraw
      ).to.eq(
        contractBalanceBeforeStake + stakeAmt
      );

      expect(
        token
      ).to.eq(
        await zns.meowToken.getAddress()
      );
    });

    it("should revert when called by NON Governor", async () => {
      const {
        paymentConfig,
      } = domainConfigs[5].fullConfig;

      await expect(
        znsUpgraded.treasury.connect(lvl5SubOwner).withdrawStaked(
          paymentConfig.token,
          lvl5SubOwner.address
        )
      ).to.be.revertedWith(
        getAccessRevertMsg(lvl5SubOwner.address, GOVERNOR_ROLE)
      );
    });

    it("should withdraw funds from upgraded treasury using #withdrawStakedByGovernon()", async () => {
      const stakeAmt = ethers.parseEther("1000");

      await zns.meowToken.connect(lvl5SubOwner).approve(
        znsUpgraded.treasury.target,
        stakeAmt
      );

      // the deployer already has the `REGISTRAR_ROLE`
      await znsUpgraded.treasury.connect(deployer).stakeForDomain(
        ethers.ZeroHash,
        domainHashes[5],
        lvl5SubOwner.address,
        stakeAmt,
        BigInt(0),
        BigInt(0),
      );

      const balanceBeforeWithdraw = await zns.meowToken.balanceOf(lvl5SubOwner.address);

      await withdrawStakedByGovernon({
        token: zns.meowToken.target.toString(),
        to: lvl5SubOwner.address,
      });

      const balanceAfterWithdraw = await zns.meowToken.balanceOf(lvl5SubOwner.address);

      expect(
        balanceAfterWithdraw - balanceBeforeWithdraw
      ).to.eq(
        stakeAmt
      );
    });
  });
});
