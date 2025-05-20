import * as hre from "hardhat";
import { assert, expect } from "chai";
import { ethers } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AccessType, DEFAULT_CURVE_PRICE_CONFIG_BYTES, DEFAULT_FIXED_PRICER_CONFIG_BYTES, DEFAULT_TOKEN_URI, deployZNS, distrConfigEmpty, DOMAIN_EXISTS_ERR, encodePriceConfig, IDistributionConfig, IDomainConfigForTest, IFixedPriceConfig, IPathRegResult, IZNSContractsLocal, NOT_OWNER_OF_ERR, paymentConfigEmpty, PaymentType } from "./helpers";
import { registrationWithSetup } from "./helpers/register-setup";
import { registerDomainPath, validatePathRegistration } from "./helpers/flows/registration";

// todo is state change only related to hardhat? or mocha generally?




describe("A Suite - ZNSSubRegistrar", () => {
  let deployer : SignerWithAddress;
  let rootOwner : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let lvl2SubOwner : SignerWithAddress;
  let lvl3SubOwner : SignerWithAddress;
  let lvl4SubOwner : SignerWithAddress;
  let lvl5SubOwner : SignerWithAddress;
  let lvl6SubOwner : SignerWithAddress;
  let branchLvl1Owner : SignerWithAddress;
  let branchLvl2Owner : SignerWithAddress;
  let random : SignerWithAddress;
  let operator : SignerWithAddress;
  let multiOwner : SignerWithAddress;

  let zns : IZNSContractsLocal;
  let zeroVault : SignerWithAddress;

  describe("B1 Suite - single subdomain registration", () => {
    let rootHash : string;
    let rootPriceConfig : IFixedPriceConfig;
    const subTokenURI = "https://token-uri.com/8756a4b6f";
    
    before(async () => {
      [
        deployer,
        zeroVault,
        governor,
        admin,
        rootOwner,
        lvl2SubOwner,
      ] = await hre.ethers.getSigners();
      // zeroVault address is used to hold the fee charged to the user when registering
      zns = await deployZNS({
        deployer,
        governorAddresses: [deployer.address, governor.address],
        adminAddresses: [admin.address],
        zeroVaultAddress: zeroVault.address,
      });

      // Give funds to users
      await Promise.all(
        [
          rootOwner,
          lvl2SubOwner,
        ].map(async ({ address }) =>
          zns.meowToken.mint(address, ethers.parseEther("100000000000")))
      );
      await zns.meowToken.connect(rootOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      rootPriceConfig = {
        price: ethers.parseEther("1375.612"),
        feePercentage: BigInt(0),
      };

      rootHash = await registrationWithSetup({
        zns,
        user: rootOwner,
        domainLabel: "root",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: DEFAULT_FIXED_PRICER_CONFIG_BYTES,
            paymentType: PaymentType.DIRECT,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });
    });

    it("Sets the payment config when given", async () => {
      const subdomain = "world-subdomain";

      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      await zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
        rootHash,
        subdomain,
        lvl2SubOwner.address,
        subTokenURI,
        distrConfigEmpty,
        {
          token: await zns.meowToken.getAddress(),
          beneficiary: lvl2SubOwner.address,
        },
      );

      const subHash = await zns.subRegistrar.hashWithParent(rootHash, subdomain);
      const config = await zns.treasury.paymentConfigs(subHash);
      expect(config.token).to.eq(await zns.meowToken.getAddress());
      expect(config.beneficiary).to.eq(lvl2SubOwner.address);
    });
  });

  describe("B2 Suite - operations within domain paths", () => {
    let domainConfigs : Array<IDomainConfigForTest>;
    let regResults : Array<IPathRegResult>;

    const fixedPrice = ethers.parseEther("1375.612");
    const fixedFeePercentage = BigInt(200);

    const fixedPriceBytes = encodePriceConfig({
      price: fixedPrice,
      feePercentage: fixedFeePercentage
    });

    const fixedPriceBytesZeroFee = encodePriceConfig({
      price: fixedPrice,
      feePercentage: BigInt(0),
    });

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
        multiOwner,
      ] = await hre.ethers.getSigners();
      // zeroVault address is used to hold the fee charged to the user when registering
      zns = await deployZNS({
        deployer,
        governorAddresses: [deployer.address, governor.address],
        adminAddresses: [admin.address],
        zeroVaultAddress: zeroVault.address,
      });

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
          multiOwner,
        ].map(async ({ address }) =>
          zns.meowToken.mint(address, ethers.parseEther("1000000")))
      );
      await zns.meowToken.connect(rootOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      domainConfigs = [
        {
          user: rootOwner,
          domainLabel: "root",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              priceConfig: fixedPriceBytes,
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: rootOwner.address,
            },
          },
        },
        {
          user: lvl2SubOwner,
          domainLabel: "lvltwo",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.curvePricer.getAddress(),
              priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
              paymentType: PaymentType.STAKE,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: lvl2SubOwner.address,
            },
          },
        },
        {
          user: lvl3SubOwner,
          domainLabel: "lvlthree",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.curvePricer.getAddress(),
              priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: lvl3SubOwner.address,
            },
          },
        },
        {
          user: lvl4SubOwner,
          domainLabel: "lvlfour",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.curvePricer.getAddress(),
              priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
              paymentType: PaymentType.STAKE,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: lvl4SubOwner.address,
            },
          },
        },
        {
          user: lvl5SubOwner,
          domainLabel: "lvlfive",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              priceConfig: fixedPriceBytes,
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: lvl5SubOwner.address,
            },
          },
        },
        {
          user: lvl6SubOwner,
          domainLabel: "lvlsix",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.curvePricer.getAddress(),
              priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
              paymentType: PaymentType.STAKE,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: lvl6SubOwner.address,
            },
          },
        },
      ];

      regResults = await registerDomainPath({
        zns,
        domainConfigs,
      });

      assert.equal(regResults.length, domainConfigs.length);
    });

    it("should register a path of 6 domains with different configs", async () => {
      await validatePathRegistration({
        zns,
        domainConfigs,
        regResults,
      });
    });
  });

  describe("B2 Suite - Existing subdomain ops", () => {
    let domainConfigs : Array<IDomainConfigForTest>;
    let regResults : Array<IPathRegResult>;
    let randomAcc : SignerWithAddress;

    let fixedPrice : bigint = ethers.parseEther("397");
    let fixedFeePercentage : bigint = BigInt(200);

    let fixedPriceConfig : IFixedPriceConfig = {
      price: fixedPrice,
      feePercentage: fixedFeePercentage
    }

    let fixedPriceConfigBytes = encodePriceConfig(fixedPriceConfig);

    before(async () => {
      [
        deployer,
        zeroVault,
        governor,
        admin,
        operator,
        rootOwner,
        lvl2SubOwner,
        lvl3SubOwner,
        lvl4SubOwner,
        lvl5SubOwner,
        lvl6SubOwner,
        randomAcc
      ] = await hre.ethers.getSigners();
      // zeroVault address is used to hold the fee charged to the user when registering
      zns = await deployZNS({
        deployer,
        governorAddresses: [deployer.address, governor.address],
        adminAddresses: [admin.address],
        zeroVaultAddress: zeroVault.address,
      });

      await Promise.all(
        [
          rootOwner,
          lvl2SubOwner,
          lvl3SubOwner,
          lvl4SubOwner,
          lvl5SubOwner,
          lvl6SubOwner,
        ].map(async ({ address }) =>
          zns.meowToken.mint(address, ethers.parseEther("1000000")))
      );
      await zns.meowToken.connect(rootOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      // register root domain and 1 subdomain
      domainConfigs = [
        {
          user: rootOwner,
          domainLabel: "root",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              priceConfig: fixedPriceConfigBytes,
              paymentType: PaymentType.STAKE,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: rootOwner.address,
            },
          },
        },
        {
          user: lvl2SubOwner,
          domainLabel: "leveltwo",
          tokenURI: "http://example.com/leveltwo",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              priceConfig: fixedPriceConfigBytes,
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: lvl2SubOwner.address,
            },
          },
        },
        {
          user: lvl3SubOwner,
          domainLabel: "lvlthree",
          tokenURI: "http://example.com/lvlthree",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.curvePricer.getAddress(),
              priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: lvl3SubOwner.address,
            },
          },
        },
      ];

      regResults = await registerDomainPath({
        zns,
        domainConfigs,
      });

      const dOwner = await zns.registry.getDomainOwner(regResults[1].domainHash);
      console.log(`dhash[1] earlier: ${regResults[1].domainHash}`);

    });

    it("should NOT allow to register an existing subdomain that has not been revoked", async () => {
      await expect(
        zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
          regResults[0].domainHash,
          domainConfigs[1].domainLabel,
          lvl2SubOwner.address,
          DEFAULT_TOKEN_URI,
          domainConfigs[1].fullConfig.distrConfig,
          paymentConfigEmpty
        )
      ).to.be.revertedWithCustomError(
        zns.subRegistrar,
        DOMAIN_EXISTS_ERR
      );
    });

    it("should NOT allow revoking when the caller is NOT an owner of both Name and Token", async () => {
      // change owner of the domain
      await zns.registry.connect(lvl2SubOwner).updateDomainOwner(
        regResults[1].domainHash,
        rootOwner.address
      );

      // fail
      await expect(
        zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(regResults[1].domainHash)
      ).to.be.revertedWithCustomError(
        zns.rootRegistrar,
        NOT_OWNER_OF_ERR
      ).withArgs(2n, lvl3SubOwner.address, regResults[1].domainHash);

      // change owner back
      await zns.registry.connect(rootOwner).updateDomainOwner(
        regResults[1].domainHash,
        lvl2SubOwner.address
      );

      // tranfer token
      await zns.domainToken.connect(lvl2SubOwner).updateTokenOwner(
        lvl2SubOwner.address,
        lvl3SubOwner.address,
        regResults[1].domainHash
      );

      // fail again
      await expect(
        zns.rootRegistrar.connect(lvl2SubOwner).revokeDomain(
          regResults[1].domainHash,
        )
      ).to.be.revertedWithCustomError(
        zns.rootRegistrar,
        NOT_OWNER_OF_ERR
      ).withArgs(2n, lvl2SubOwner.address, regResults[1].domainHash);

      // give token back
      await zns.domainToken.connect(lvl3SubOwner).transferFrom(
        lvl3SubOwner.address,
        lvl2SubOwner.address,
        regResults[1].domainHash
      );
    });

    it("should allow to UPDATE domain data for subdomain", async () => {
      const dataFromReg = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromReg.owner).to.eq(lvl2SubOwner.address);
      expect(dataFromReg.resolver).to.eq(await zns.addressResolver.getAddress());

      // give ownership to lvl3subowner
      await zns.registry.connect(lvl2SubOwner).updateDomainRecord(
        regResults[1].domainHash,
        lvl3SubOwner.address,
        ethers.ZeroAddress,
      );

      const dataFromRegAfter = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromRegAfter.owner).to.eq(lvl3SubOwner.address);
      expect(dataFromRegAfter.resolver).to.eq(ethers.ZeroAddress);

      // reclaim to switch ownership back to original owner
      await zns.rootRegistrar.connect(lvl2SubOwner).reclaimDomain(
        regResults[1].domainHash,
      );

      const dataFromRegAfterReclaim = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromRegAfterReclaim.owner).to.eq(lvl2SubOwner.address);
      expect(dataFromRegAfterReclaim.resolver).to.eq(ethers.ZeroAddress);
    });

    describe("C Suite - #setDistributionConfigForDomain()", () => {
      it("should re-set distribution config for an existing subdomain", async () => {
        //TODO FINDMEDEBUG3211
        const dOwner = await zns.registry.getDomainOwner(regResults[1].domainHash);
        const domainHash = regResults[2].domainHash;

        const distrConfigBefore = await zns.subRegistrar.distrConfigs(domainHash);
        expect(distrConfigBefore.accessType).to.not.eq(AccessType.MINTLIST);
        expect(distrConfigBefore.pricerContract).to.not.eq(await zns.fixedPricer.getAddress());
        expect(
          distrConfigBefore.paymentType
        ).to.not.eq(
          PaymentType.STAKE
        );

        const newConfig : IDistributionConfig = {
          pricerContract: await zns.fixedPricer.getAddress(),
          priceConfig: DEFAULT_FIXED_PRICER_CONFIG_BYTES,
          paymentType: PaymentType.STAKE,
          accessType: AccessType.MINTLIST,
        };

        await zns.subRegistrar.connect(lvl3SubOwner).setDistributionConfigForDomain(
          domainHash,
          newConfig,
        );

        const distrConfigAfter = await zns.subRegistrar.distrConfigs(domainHash);
        expect(distrConfigAfter.accessType).to.eq(newConfig.accessType);
        expect(distrConfigAfter.pricerContract).to.eq(newConfig.pricerContract);
        expect(distrConfigAfter.paymentType).to.eq(newConfig.paymentType);

        // assign operator in registry
        await zns.registry.connect(lvl3SubOwner).setOwnersOperator(
          operator.address,
          true,
        );

        // reset it back
        await zns.subRegistrar.connect(operator).setDistributionConfigForDomain(
          domainHash,
          domainConfigs[2].fullConfig.distrConfig,
        );

        const origConfigAfter = await zns.subRegistrar.distrConfigs(domainHash);
        expect(origConfigAfter.accessType).to.eq(domainConfigs[2].fullConfig.distrConfig.accessType);
        expect(origConfigAfter.pricerContract).to.eq(domainConfigs[2].fullConfig.distrConfig.pricerContract);
        expect(
          origConfigAfter.paymentType
        ).to.eq(
          domainConfigs[2].fullConfig.distrConfig.paymentType
        );

        // remove operator
        await zns.registry.connect(lvl3SubOwner).setOwnersOperator(
          operator.address,
          false,
        );
      });
    });
  });
});