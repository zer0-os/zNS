/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as hre from "hardhat";
import { IDeployCampaignConfig, TZNSContractState } from "../src/deploy/campaign/types";
import { getConfig } from "../src/deploy/campaign/environments";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { upgradeZNS } from "../src/upgrade/upgrade";
import { ContractStorageData, IContractData, IZNSContractsUpgraded } from "../src/upgrade/types";
import { znsNames } from "../src/deploy/missions/contracts/names";
import { expect } from "chai";
import {
  AccessType,
  curvePriceConfigEmpty,
  DEFAULT_PRICE_CONFIG,
  distrConfigEmpty,
  paymentConfigEmpty,
  PaymentType,
} from "./helpers";
import { registerDomainPath } from "./helpers/flows/registration";
import { IDomainConfigForTest, IFixedPriceConfig } from "./helpers/types";
import * as ethers from "ethers";
import { readContractStorage } from "../src/upgrade/storage-data";


describe("ZNS V1 Upgrade and Lock Test", () => {
  let deployer : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let randomAcc : SignerWithAddress;
  let rootOwner : SignerWithAddress;
  let lvl2SubOwner : SignerWithAddress;
  let lvl3SubOwner : SignerWithAddress;
  let lvl4SubOwner : SignerWithAddress;
  let lvl5SubOwner : SignerWithAddress;
  let lvl6SubOwner : SignerWithAddress;
  let branchLvl1Owner : SignerWithAddress;
  let branchLvl2Owner : SignerWithAddress;

  let zns : TZNSContractState;
  let zeroVault : SignerWithAddress;

  let domainConfigs : Array<IDomainConfigForTest>;
  let domainHashes : Array<string>;

  const fixedPrice = ethers.parseEther("1375.612");
  const fixedFeePercentage = BigInt(200);

  const contractNames = { ...znsNames };
  // @ts-ignore
  delete contractNames.erc1967Proxy;
  // @ts-ignore
  delete contractNames.accessController;
  // @ts-ignore
  delete contractNames.meowToken;

  let contractData : Array<IContractData>;
  let znsUpgraded : IZNSContractsUpgraded;

  let preUpgradeZnsStorage : Array<ContractStorageData>;

  let methodCalls : {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key : string] : Array<{ method : string; args : Array<any>; }>;
  };

  before(async () => {
    [
      deployer,
      zeroVault,
      governor,
      admin,
      rootOwner,
      lvl2SubOwner,
      lvl3SubOwner,
      lvl4SubOwner,
      lvl5SubOwner,
      lvl6SubOwner,
      branchLvl1Owner,
      branchLvl2Owner,
      randomAcc,
    ] = await hre.ethers.getSigners();

    const config : IDeployCampaignConfig = await getConfig({
      deployer,
      zeroVaultAddress: zeroVault.address,
      governors: [deployer.address, governor.address],
      admins: [deployer.address, admin.address],
    });

    const campaign = await runZnsCampaign({
      config,
    });

    zns = campaign.state.contracts;
    zns.zeroVaultAddress = zeroVault.address;

    // get base contract level storage for each contract pre-upgrade
    preUpgradeZnsStorage = await Object.values(contractNames).reduce(
      async (acc : Promise<Array<ContractStorageData>>, { contract, instance }) => {
        const newAcc = await acc;

        const contractFactory = await hre.ethers.getContractFactory(contract);
        const contractObj = zns[instance];

        const storage = await readContractStorage(contractFactory, contractObj);

        return [...newAcc, storage];
      }, Promise.resolve([])
    );

    // Give funds to users
    await Promise.all(
      [
        rootOwner,
        lvl2SubOwner,
        lvl3SubOwner,
        lvl4SubOwner,
        lvl5SubOwner,
        lvl6SubOwner,
        branchLvl1Owner,
        branchLvl2Owner,
      ].map(async ({ address }) =>
        zns.meowToken.mint(address, ethers.parseEther("1000000")))
    );
    await zns.meowToken.connect(rootOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

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

    const regResults = await registerDomainPath({
      zns,
      domainConfigs,
    });

    domainHashes = regResults.map(({ domainHash }) => domainHash);

    // UPGRADE ZNS CONTRACTS

    // get contract data for the upgrade helper
    contractData = Object.entries(contractNames).map(
      ([name, { contract, instance }]) => ({
        contractName: contract,
        instanceName: instance,
        address: zns[name].target,
      }));

    // run the upgrade
    znsUpgraded = await upgradeZNS({
      governorExt: governor,
      contractData,
    });

    // list of all the methods that are blocked with `whenNotPaused` modifier
    // along with arguments for calls
    methodCalls = {
      [znsNames.registry.instance]: [
        {
          method: "setOwnersOperator",
          args: [randomAcc.address, true],
        },
        {
          method: "createDomainRecord",
          args: [hre.ethers.ZeroHash, randomAcc.address, "address"],
        },
        {
          method: "updateDomainRecord",
          args: [hre.ethers.ZeroHash, randomAcc.address, "address"],
        },
        {
          method: "updateDomainOwner",
          args: [hre.ethers.ZeroHash, randomAcc.address],
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
          args: [deployer.address, randomAcc.address, 1],
        },
        {
          // @ts-ignore
          method: "safeTransferFrom(address,address,uint256)",
          args: [deployer.address, randomAcc.address, "1"],
        },
        {
          // @ts-ignore
          method: "safeTransferFrom(address,address,uint256,bytes)",
          args: [deployer.address, randomAcc.address, "1", hre.ethers.ZeroHash],
        },
        {
          method: "approve",
          args: [randomAcc.address, 1],
        },
        {
          method: "setApprovalForAll",
          args: [randomAcc.address, true],
        },
        {
          method: "register",
          args: [randomAcc.address, 123n, "dummyURI"],
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
          args: [hre.ethers.ZeroHash, randomAcc.address],
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
          args: [hre.ethers.ZeroHash, hre.ethers.ZeroHash, randomAcc.address, 1n, 1n, 1n],
        },
        {
          method: "unstakeForDomain",
          args: [hre.ethers.ZeroHash, randomAcc.address],
        },
        {
          method: "processDirectPayment",
          args: [hre.ethers.ZeroHash, hre.ethers.ZeroHash, randomAcc.address, 1n, 1n],
        },
        {
          method: "setPaymentConfig",
          args: [hre.ethers.ZeroHash, paymentConfigEmpty],
        },
        {
          method: "setBeneficiary",
          args: [hre.ethers.ZeroHash, randomAcc.address],
        },
        {
          method: "setPaymentToken",
          args: [hre.ethers.ZeroHash, randomAcc.address],
        },
        {
          method: "pause",
          args: [],
        },
      ],
      [znsNames.rootRegistrar.instance]: [
        {
          method: "registerRootDomain",
          args: ["domain", randomAcc.address, "uri", distrConfigEmpty, paymentConfigEmpty],
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
          args: [hre.ethers.ZeroHash, "label", randomAcc.address, "uri", distrConfigEmpty, paymentConfigEmpty],
        },
        {
          method: "setDistributionConfigForDomain",
          args: [hre.ethers.ZeroHash, distrConfigEmpty],
        },
        {
          method: "setPricerContractForDomain",
          args: [hre.ethers.ZeroHash, randomAcc.address],
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
          args: [hre.ethers.ZeroHash, [randomAcc.address], [true]],
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
          await zns.subRegistrar.connect(user).setDistributionConfigForDomain(
            domainHash,
            {
              pricerContract: newPricer,
              paymentType: newPaymentType,
              accessType: newAccessType,
            }
          );
          // check new values
          const domainConfig = await zns.subRegistrar.distrConfigs(domainHash);
          expect(domainConfig.pricerContract).to.equal(newPricer);
          expect(domainConfig.paymentType).to.equal(newPaymentType);
          expect(domainConfig.accessType).to.equal(newAccessType);

          // check Treasury storage
          // set new values
          await zns.treasury.connect(user).setPaymentConfig(
            domainHash,
            {
              token: randomAcc.address,
              beneficiary: randomAcc.address,
            }
          );
          // check new values
          const paymentConfig = await zns.treasury.paymentConfigs(domainHash);
          expect(paymentConfig.token).to.equal(randomAcc.address);
          expect(paymentConfig.beneficiary).to.equal(randomAcc.address);

          if ((fullConfig.priceConfig as IFixedPriceConfig).price) {
            // check FixedPricer storage
            const newPriceConfig = {
              price: 111n,
              feePercentage: 111n,
              isSet: true,
            };
            // set new values
            await zns.fixedPricer.connect(user).setPriceConfig(domainHash, newPriceConfig);

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
            await zns.curvePricer.connect(user).setPriceConfig(domainHash, newPriceConfig);
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
          await zns.addressResolver.connect(user).setAddress(domainHash, randomAcc.address);
          // check new values
          const addr = await zns.addressResolver.resolveDomainAddress(domainHash);
          expect(addr).to.equal(randomAcc.address);

          // check DomainToken storage
          // set new values
          await zns.domainToken.connect(user).transferFrom(user.address, randomAcc.address, BigInt(domainHash));
          // check new values
          const tokenOwner = await zns.domainToken.ownerOf(BigInt(domainHash));
          expect(tokenOwner).to.equal(randomAcc.address);

          // check Registry storage
          // set new values
          await zns.registry.connect(user).updateDomainOwner(domainHash, randomAcc.address);
          // check new values
          const owner = await zns.registry.getDomainOwner(domainHash);
          expect(owner).to.equal(randomAcc.address);
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

          await contract.connect(deployer).pause();

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
});
