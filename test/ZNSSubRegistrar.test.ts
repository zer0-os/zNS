/* eslint-disable @typescript-eslint/no-shadow, no-shadow */
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  IDistributionConfig,
  IDomainConfigForTest,
  IPathRegResult,
  ISubRegistrarConfig,
} from "./helpers/types";
import {
  AccessType,
  ADMIN_ROLE,
  DEFAULT_TOKEN_URI,
  deployZNS,
  distrConfigEmpty,
  DISTRIBUTION_LOCKED_NOT_EXIST_ERR,
  FULL_DISTR_CONFIG_EMPTY,
  getPriceObject,
  getStakingOrProtocolFee,
  GOVERNOR_ROLE,
  INITIALIZED_ERR,
  INVALID_LABEL_ERR,
  NONEXISTENT_TOKEN_ERC_ERR,
  NO_BENEFICIARY_ERR,
  NOT_AUTHORIZED_ERR,
  paymentConfigEmpty,
  PaymentType,
  DEFAULT_PRECISION,
  validateUpgrade,
  AC_UNAUTHORIZED_ERR,
  INSUFFICIENT_BALANCE_ERC_ERR,
  INSUFFICIENT_ALLOWANCE_ERC_ERR,
  ZERO_ADDRESS_ERR,
  DOMAIN_EXISTS_ERR,
  SENDER_NOT_APPROVED_ERR,
  ZERO_PARENTHASH_ERR,
  encodePriceConfig,
  DEFAULT_CURVE_PRICE_CONFIG_BYTES,
  DEFAULT_CURVE_PRICE_CONFIG,
  decodePriceConfig,
  DEFAULT_FIXED_PRICER_CONFIG_BYTES,
  PAUSE_SAME_VALUE_ERR, REGISTRATION_PAUSED_ERR,
  AC_WRONGADDRESS_ERR,
} from "./helpers";
import * as hre from "hardhat";
import { ethers } from "hardhat";
import { expect } from "chai";
import { registerDomainPath, validatePathRegistration } from "./helpers/flows/registration";
import assert from "assert";
import { defaultSubdomainRegistration, registrationWithSetup } from "./helpers/register-setup";
import { getDomainHashFromEvent, getDomainRegisteredEvents } from "./helpers/events";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
  CustomDecimalTokenMock,
  ZNSSubRegistrar,
  ZNSSubRegistrar__factory,
  ZNSSubRegistrarUpgradeMock,
  ZNSSubRegistrarUpgradeMock__factory,
} from "../typechain";
import { deployCustomDecToken } from "./helpers/deploy/mocks";
import { getProxyImplAddress } from "./helpers/utils";
import { ICurvePriceConfig, IFixedPriceConfig } from "../src/deploy/missions/types";
import { IZNSContracts } from "../src/deploy/campaign/types";
import Domain from "./helpers/domain/domain";
import { ZeroHash } from "ethers";
import { IFullDomainConfig } from "./helpers/domain/types";


describe.only("ZNSSubRegistrar", () => {
  let deployer : SignerWithAddress;
  let rootOwner : SignerWithAddress;
  let specificRootOwner : SignerWithAddress;
  let specificSubOwner : SignerWithAddress;
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

  let zns : IZNSContracts;
  let zeroVault : SignerWithAddress;

  let rootPriceConfig : IFixedPriceConfig;
  let defaultDistrConfig : IDistributionConfig;
  const subTokenURI = "https://token-uri.com/8756a4b6f";

  describe("Single Subdomain Registration", () => {
    before(async () => {
      [
        deployer,
        zeroVault,
        governor,
        admin,
        rootOwner,
        specificRootOwner,
        specificSubOwner,
        lvl2SubOwner,
        lvl3SubOwner,
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
          specificRootOwner,
          specificSubOwner,
          lvl2SubOwner,
          lvl3SubOwner,
        ].map(async ({ address }) =>
          zns.meowToken.mint(address, ethers.parseEther("100000000000000")))
      );
      await zns.meowToken.connect(rootOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
      await zns.meowToken.connect(specificRootOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
      await zns.meowToken.connect(specificSubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      rootPriceConfig = {
        price: ethers.parseEther("1375.612"),
        feePercentage: BigInt(0),
      };

      defaultDistrConfig = {
        pricerContract: zns.fixedPricer.target,
        paymentType: PaymentType.DIRECT,
        accessType: AccessType.OPEN,
        priceConfig: encodePriceConfig(rootPriceConfig),
      };
    });

    it("Sets the payment config when given", async () => {
      const domain = new Domain({
        zns,
        domainConfig: {
          owner: rootOwner,
          label: "world1",
          parentHash: ethers.ZeroHash,
          tokenOwner: rootOwner.address,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: defaultDistrConfig,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });
      await domain.register(rootOwner);

      const subdomain = new Domain({
        zns,
        domainConfig: {
          owner: lvl2SubOwner,
          parentHash: domain.hash,
          label: "world-subdomain",
          domainAddress: lvl2SubOwner.address,
          tokenURI: subTokenURI,
          distrConfig: defaultDistrConfig,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });
      await subdomain.register(lvl2SubOwner);

      const config = await subdomain.getPaymentConfig();
      expect(config.token).to.eq(await zns.meowToken.getAddress());
      expect(config.beneficiary).to.eq(lvl2SubOwner.address);
    });

    it("Does not set the payment config when the beneficiary is the zero address", async () => {
      const domain = new Domain({
        zns,
        domainConfig: {
          owner: rootOwner,
          label: "world",
          parentHash: ethers.ZeroHash,
          tokenOwner: rootOwner.address,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: defaultDistrConfig,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });
      await domain.register();

      const subdomain = new Domain({
        zns,
        domainConfig: {
          owner: lvl2SubOwner,
          parentHash: domain.hash,
          label: "not-world-subdomain",
          tokenURI: subTokenURI,
          distrConfig: defaultDistrConfig,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: ethers.ZeroAddress,
          },
        },
      });
      await subdomain.register();

      const config = await subdomain.getPaymentConfig();
      expect(config.token).to.eq(ethers.ZeroAddress);
      expect(config.beneficiary).to.eq(ethers.ZeroAddress);
    });

    // eslint-disable-next-line max-len
    it("should revert when trying to register a subdomain before parent has set it's config with FixedPricer", async () => {
      const domain = new Domain({
        zns,
        domainConfig: {
          owner: rootOwner,
          label: "rootunsetfixed",
          parentHash: ethers.ZeroHash,
          tokenOwner: rootOwner.address,
          distrConfig: distrConfigEmpty,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });
      await domain.register();

      const subdomain = new Domain({
        zns,
        domainConfig: {
          owner: lvl2SubOwner,
          label: "subunset",
          parentHash: domain.hash,
          tokenOwner: lvl2SubOwner.address,
          distrConfig: distrConfigEmpty,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });

      await expect(
        subdomain.register()
      ).to.be.revertedWithCustomError(
        zns.subRegistrar,
        DISTRIBUTION_LOCKED_NOT_EXIST_ERR
      );
    });

    // eslint-disable-next-line max-len
    it("should revert when trying to register a subdomain before parent has set it's config with CurvePricer", async () => {
      // register a new root domain
      const domain = new Domain({
        zns,
        domainConfig: {
          owner: rootOwner,
          tokenOwner: lvl2SubOwner.address,
          label: "rootunsetcurve",
          distrConfig: distrConfigEmpty,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });
      await domain.register();

      const subdomain = new Domain({
        zns,
        domainConfig: {
          owner: lvl2SubOwner,
          label: "subunset",
          parentHash: domain.hash,
          tokenOwner: lvl2SubOwner.address,
          distrConfig: distrConfigEmpty,
          paymentConfig: paymentConfigEmpty,
        },
      });

      await expect(
        subdomain.register()
      ).to.be.revertedWithCustomError(
        zns.subRegistrar,
        DISTRIBUTION_LOCKED_NOT_EXIST_ERR
      );
    });

    it("should revert when registering during a registration pause when called publicly", async () => {
      // pause the sub registrar
      await zns.subRegistrar.connect(admin).pauseRegistration();

      expect(await zns.subRegistrar.registrationPaused()).to.be.true;

      const domain = new Domain({
        zns,
        domainConfig: {
          owner: rootOwner,
          label: "rootpaused",
          parentHash: hre.ethers.ZeroHash,
          tokenOwner: rootOwner.address,
          distrConfig: defaultDistrConfig,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });
      await domain.register();

      const subdomain = new Domain({
        zns,
        domainConfig: {
          owner: lvl3SubOwner,
          label: "subpaused",
          parentHash: domain.hash,
          tokenOwner: lvl2SubOwner.address,
          distrConfig: {
            pricerContract: ethers.ZeroAddress,
            paymentType: PaymentType.DIRECT,
            accessType: AccessType.OPEN,
            priceConfig: ZeroHash,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });

      // try to register a subdomain
      await expect(
        subdomain.register(lvl3SubOwner)
      ).to.be.revertedWithCustomError(
        zns.subRegistrar,
        REGISTRATION_PAUSED_ERR,
      );
    });

    it("should register successfully as ADMIN_ROLE during a registration pause", async () => {
      expect(zns.accessController.target).eq(await zns.subRegistrar.getAccessController());
      expect(await zns.accessController.isAdmin(admin.address)).to.be.true;
      expect(await zns.subRegistrar.registrationPaused()).to.be.true;

      // approve treasury
      await zns.meowToken.connect(admin).approve(
        await zns.treasury.getAddress(),
        ethers.MaxUint256,
      );

      const domain = new Domain({
        zns,
        domainConfig: {
          owner: admin,
          label: "root1paused1for1sub",
          parentHash: hre.ethers.ZeroHash,
          tokenOwner: rootOwner.address,
          distrConfig: defaultDistrConfig,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });
      await domain.register();

      // try to register a subdomain as admin
      const subdomain = new Domain({
        zns,
        domainConfig: {
          owner: admin,
          label: "subadmin",
          parentHash: domain.hash,
          tokenOwner: admin.address,
          distrConfig: distrConfigEmpty,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: admin.address,
          },
        },
      });
      await subdomain.register(admin);

      // check that the domain was registered
      expect(subdomain.owner).to.eq(admin.address);

      // unpause the sub registrar for further tests
      await zns.subRegistrar.connect(admin).unpauseRegistration();
      expect(await zns.subRegistrar.registrationPaused()).to.be.false;
    });

    it("should register subdomain with the correct tokenURI assigned to the domain token minted", async () => {
      const domain = new Domain({
        zns,
        domainConfig: {
          owner: rootOwner,
          label: "root1for1sub",
          parentHash: ethers.ZeroHash,
          tokenOwner: rootOwner.address,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: defaultDistrConfig,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });
      await domain.register();

      const sub = new Domain({
        zns,
        domainConfig: {
          owner: lvl2SubOwner,
          label: "sub",
          parentHash: domain.hash,
          tokenOwner: lvl2SubOwner.address,
          tokenURI: subTokenURI,
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: encodePriceConfig({
              price: ethers.parseEther("777.325"),
              feePercentage: BigInt(0),
            }),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });
      await sub.register();

      expect(sub.tokenURI).to.eq(subTokenURI);
    });

    it("Can register a subdomain with characters [a-z0-9-]", async () => {
      const domain = new Domain({
        zns,
        domainConfig: {
          owner: rootOwner,
          label: "root555",
          parentHash: ethers.ZeroHash,
          tokenOwner: rootOwner.address,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: defaultDistrConfig,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });
      await domain.register();

      const subdomain = new Domain({
        zns,
        domainConfig: {
          owner: lvl2SubOwner,
          label: "0x0dwidler0x0", // valid characters
          parentHash: domain.hash,
          tokenOwner: lvl2SubOwner.address,
          tokenURI: subTokenURI,
          distrConfig: distrConfigEmpty,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });
      await subdomain.registerAndValidateDomain();
    });

    it("should register a subdomain with token assigned to a different address if provided", async () => {
      const domain = new Domain({
        zns,
        domainConfig: {
          owner: rootOwner,
          label: "root1diff1address",
          parentHash: ethers.ZeroHash,
          tokenOwner: rootOwner.address,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: defaultDistrConfig,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });
      await domain.register();

      const subdomain = new Domain({
        zns,
        domainConfig: {
          owner: lvl2SubOwner,
          label: "sub1diff1address",
          parentHash: domain.hash,
          tokenOwner: lvl3SubOwner.address, // different address
          tokenURI: subTokenURI,
          distrConfig: distrConfigEmpty,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });
      await subdomain.register();

      // check owners of hash and token
      const ownerFromReg = await zns.registry.getDomainOwner(subdomain.hash);
      expect(ownerFromReg).to.eq(lvl2SubOwner.address);
      const ownerFromToken = await zns.domainToken.ownerOf(subdomain.hash);
      expect(ownerFromToken).to.eq(lvl3SubOwner.address);
    });

    it("Fails for a subdomain that uses any invalid characters", async () => {
      const nameA = "WILDER";
      const nameB = "!?w1Id3r!?";
      const nameC = "!%$#^*?!#👍3^29";
      const nameD = "wo.rld";

      const domain = new Domain({
        zns,
        domainConfig: {
          owner: rootOwner,
          label: "rootin",
          parentHash: ethers.ZeroHash,
          tokenOwner: rootOwner.address,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: defaultDistrConfig,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });
      await domain.register();

      for (const name of [nameA, nameB, nameC, nameD]) {
        const subdomain = new Domain({
          zns,
          domainConfig: {
            owner: lvl2SubOwner,
            label: name,
            parentHash: domain.hash,
            tokenOwner: lvl2SubOwner.address,
            tokenURI: subTokenURI,
            distrConfig: distrConfigEmpty,
            paymentConfig: paymentConfigEmpty,
          },
        });

        await expect(
          subdomain.register()
        ).to.be.revertedWithCustomError(zns.curvePricer, INVALID_LABEL_ERR);
      }
    });

    it("should revert when trying to register a subdomain under a non-existent parent", async () => {
      const domain = new Domain({
        zns,
        domainConfig: {
          owner: rootOwner,
          label: "rootnonexistent",
          parentHash: ethers.ZeroHash,
          tokenOwner: rootOwner.address,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: defaultDistrConfig,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });

      await domain.register();
      const nonExistentHash = domain.hash;
      await domain.revoke();

      const subdomain = new Domain({
        zns,
        domainConfig: {
          owner: lvl2SubOwner,
          label: "subnonexistent",
          parentHash: nonExistentHash,
          tokenOwner: lvl2SubOwner.address,
          tokenURI: subTokenURI,
          distrConfig: distrConfigEmpty,
          paymentConfig: paymentConfigEmpty,
        },
      });

      // check that this hash can NOT be passed as parentHash
      await expect(
        subdomain.register()
      ).to.be.revertedWithCustomError(
        zns.subRegistrar,
        DISTRIBUTION_LOCKED_NOT_EXIST_ERR
      );
    });

    it("should register subdomain with a single char label", async () => {
      const domain = new Domain({
        zns,
        domainConfig: {
          owner: rootOwner,
          label: "root96115691",
          parentHash: ethers.ZeroHash,
          tokenOwner: rootOwner.address,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: defaultDistrConfig,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });
      await domain.register();

      const subdomain = new Domain({
        zns,
        domainConfig: {
          owner: lvl2SubOwner,
          label: "a",
          parentHash: domain.hash,
          tokenOwner: lvl2SubOwner.address,
          tokenURI: subTokenURI,
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: encodePriceConfig({
              price: ethers.parseEther("777.325"),
              feePercentage: BigInt(0),
            }),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });
      await subdomain.registerAndValidateDomain();
    });

    // ! this value can change based on the block gas limit !
    it("should register subdomain with a label length of 100000 chars [ @skip-on-coverage ]", async () => {
      const domain = new Domain({
        zns,
        domainConfig: {
          owner: lvl2SubOwner,
          label: "root345678",
          parentHash: ethers.ZeroHash,
          tokenOwner: lvl2SubOwner.address,
          tokenURI: subTokenURI,
          distrConfig: defaultDistrConfig,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });
      await domain.register();

      const subdomain = new Domain({
        zns,
        domainConfig: {
          owner: lvl2SubOwner,
          label: "a".repeat(100000),
          parentHash: domain.hash,
          tokenOwner: lvl2SubOwner.address,
          tokenURI: subTokenURI,
          distrConfig: FULL_DISTR_CONFIG_EMPTY.distrConfig,
          paymentConfig: FULL_DISTR_CONFIG_EMPTY.paymentConfig,
        },
      });
      await subdomain.registerAndValidateDomain();
    });

    it("should revert when user has insufficient funds", async () => {
      const domain = new Domain({
        zns,
        domainConfig: {
          owner: rootOwner,
          label: "rootinsufficientfunds",
          parentHash: ethers.ZeroHash,
          tokenOwner: rootOwner.address,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: defaultDistrConfig,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });
      await domain.register();

      const label = "subinsufficientfunds";
      const { expectedPrice } = getPriceObject(label, rootPriceConfig);
      const userBalanceBefore = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const userBalanceAfter = userBalanceBefore - expectedPrice;
      await zns.meowToken.connect(lvl2SubOwner).transfer(deployer.address, userBalanceAfter);

      // add allowance
      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      await expect(
        zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain({
          parentHash: domain.hash,
          label: "subfunds",
          domainAddress: lvl2SubOwner.address,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: subTokenURI,
          distrConfig: distrConfigEmpty,
          paymentConfig: paymentConfigEmpty,
        })
      ).to.be.revertedWithCustomError(
        zns.meowToken,
        INSUFFICIENT_BALANCE_ERC_ERR
      );

      // transfer back for other tests
      await zns.meowToken.connect(deployer).transfer(lvl2SubOwner.address, userBalanceAfter);
    });

    it("should revert when user has insufficient allowance", async () => {
      const domain = new Domain({
        zns,
        domainConfig: {
          owner: rootOwner,
          label: "rootinsufficientallowance",
          parentHash: ethers.ZeroHash,
          tokenOwner: rootOwner.address,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: defaultDistrConfig,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });
      await domain.register();

      const label = "subinsufficientallowance";
      const { expectedPrice } = getPriceObject(label, rootPriceConfig);

      // add allowance
      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), expectedPrice - 1n);

      await expect(
        zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain({
          parentHash: domain.hash,
          label: "suballowance",
          domainAddress: lvl2SubOwner.address,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: subTokenURI,
          distrConfig: distrConfigEmpty,
          paymentConfig: paymentConfigEmpty,
        })
      ).to.be.revertedWithCustomError(
        zns.meowToken,
        INSUFFICIENT_ALLOWANCE_ERC_ERR
      );
    });

    it("should revert on payment when parent's beneficiary has not yet been set and when stakeFee is > 0", async () => {
      // register a new parent with direct payment and no payment config
      const domain = new Domain({
        zns,
        domainConfig: {
          owner: rootOwner,
          label: "parentnoconfigdirect",
          parentHash: ethers.ZeroHash,
          tokenOwner: rootOwner.address,
          tokenURI: subTokenURI,
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: encodePriceConfig(rootPriceConfig),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: paymentConfigEmpty,
        },
      });
      await domain.register();

      // set the token address
      await zns.treasury.connect(rootOwner).setPaymentToken(domain.hash, await zns.meowToken.getAddress());

      // register a new parent with stake payment and no payment config
      const domain2 = new Domain({
        zns,
        domainConfig: {
          owner: rootOwner,
          label: "parentnoconfigstake",
          parentHash: ethers.ZeroHash,
          tokenOwner: rootOwner.address,
          tokenURI: subTokenURI,
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
            accessType: AccessType.OPEN,
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: paymentConfigEmpty,
        },
      });
      await domain2.register();
      // set the token address
      await domain2.setPaymentTokenForDomain(await zns.meowToken.getAddress());

      // register subdomains under new parents
      const subdomain = new Domain({
        zns,
        domainConfig: {
          owner: lvl2SubOwner,
          label: "sub1",
          parentHash: domain.hash,
          tokenOwner: lvl2SubOwner.address,
          tokenURI: subTokenURI,
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: encodePriceConfig(rootPriceConfig),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });

      await expect(
        subdomain.register()
      ).to.be.revertedWithCustomError(zns.treasury, NO_BENEFICIARY_ERR);

      const subdomain2 = new Domain({
        zns,
        domainConfig: {
          owner: lvl2SubOwner,
          label: "sub2",
          parentHash: domain2.hash,
          tokenOwner: lvl2SubOwner.address,
        },
      });

      await expect(
        subdomain2.register()
      ).to.be.revertedWithCustomError(zns.treasury, NO_BENEFICIARY_ERR);

      // change stakeFee to 0
      const currDistrConfig = await zns.subRegistrar.distrConfigs(domain2.hash);
      const decodedConfig = decodePriceConfig(currDistrConfig.priceConfig);

      decodedConfig.feePercentage = BigInt(0);

      // TODO dom: start from this
      await domain2.setPricerDataForDomain(
        domain2.hash,
        encodePriceConfig(decodedConfig),
        currDistrConfig.pricerContract
      );

      // try register a subdomain again
      await subdomain2.register();

      await zns.registry.exists(subdomain2.hash);
    });
  });

  describe("Bulk Subdomain Registration", () => {
    let domain : Domain;

    before(async () => {
      domain = new Domain({
        zns,
        domainConfig: {
          owner: rootOwner,
          label: "root1bulk",
          parentHash: ethers.ZeroHash,
          tokenOwner: rootOwner.address,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: defaultDistrConfig,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });
      await domain.register();
    });

    it("Should #registerSubdomainBulk and the event must be triggered", async () => {
      const registrations : Array<ISubRegistrarConfig> = [];

      for (let i = 0; i < 5; i++) {
        const isOdd = i % 2 !== 0;

        const subdomainObj : ISubRegistrarConfig = {
          parentHash: domain.hash,
          label: `subdomain${i + 1}`,
          domainAddress: admin.address,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: `0://tokenURI_${i + 1}`,
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            paymentType: isOdd ? PaymentType.STAKE : PaymentType.DIRECT,
            accessType: isOdd ? AccessType.LOCKED : AccessType.OPEN,
            priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: isOdd ? admin.address : lvl2SubOwner.address,
          },
        };

        registrations.push(subdomainObj);
      }

      // Add allowance
      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      await zns.subRegistrar.connect(lvl2SubOwner).registerSubdomainBulk(registrations);

      // get by `registrant`
      const logs = await getDomainRegisteredEvents({
        zns,
        registrant: lvl2SubOwner.address,
      });

      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = logs.length - 1; i === 0; i--) {
        const subdomain = registrations[i];

        const domainHashExpected = await zns.subRegistrar.hashWithParent(
          subdomain.parentHash,
          subdomain.label
        );

        // "DomainRegistered" event log
        const { parentHash, domainHash, label, tokenOwner, tokenURI, domainOwner, domainAddress } = logs[i].args;

        expect(parentHash).to.eq(domain.hash);
        expect(domainHashExpected).to.eq(domainHash);
        expect(label).to.eq(subdomain.label);
        expect(tokenURI).to.eq(subdomain.tokenURI);
        expect(tokenOwner).to.eq(domainOwner);
        expect(domainOwner).to.eq(lvl2SubOwner.address);
        expect(domainAddress).to.eq(subdomain.domainAddress);
      }
    });

    it("Should register multiple NESTED subdomains using #registerSubdomainBulk", async () => {
      const registrations : Array<ISubRegistrarConfig> = [];
      const parentHashes : Array<string> = [];

      // how many nested domains (0://root.sub1.sub2.sub3....)
      const domainLevels = 15;

      for (let i = 0; i < domainLevels; i++) {
        const isOdd = i % 2 !== 0;

        const subdomainObj : ISubRegistrarConfig = {
          parentHash: domain.hash,
          label: `sub${i + 1}`,
          domainAddress: lvl3SubOwner.address,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: `0://tokenURI_${i + 1}`,
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            paymentType: isOdd ? PaymentType.STAKE : PaymentType.DIRECT,
            accessType: isOdd ? AccessType.LOCKED : AccessType.OPEN,
            priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: isOdd ? lvl3SubOwner.address : lvl2SubOwner.address,
          },
        };

        if (i > 0) subdomainObj.parentHash = ethers.ZeroHash;

        registrations.push(subdomainObj);

        // first goes with rootHash
        parentHashes.push(
          await zns.subRegistrar.hashWithParent(
            i === 0 ? domain.hash : parentHashes[i - 1],
            subdomainObj.label
          )
        );
      }

      // Add allowance
      await zns.meowToken.connect(lvl3SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      await zns.subRegistrar.connect(lvl3SubOwner).registerSubdomainBulk(registrations);

      const logs = await getDomainRegisteredEvents({
        zns,
        registrant: lvl3SubOwner.address,
      });

      for (let i = 0; i < domainLevels; i++) {
        const subdomain = registrations[i];

        // "DomainRegistered" event log
        const { parentHash, domainHash, label, tokenURI, tokenOwner, domainOwner, domainAddress } = logs[i].args;

        i > 0 ?
          expect(parentHash).to.eq(parentHashes[i - 1]) :
          expect(parentHash).to.eq(domain.hash);
        expect(domainHash).to.eq(parentHashes[i]);
        expect(label).to.eq(subdomain.label);
        expect(tokenURI).to.eq(subdomain.tokenURI);
        expect(domainOwner).to.eq(lvl3SubOwner.address);
        expect(tokenOwner).to.eq(lvl3SubOwner.address);
        expect(domainAddress).to.eq(subdomain.domainAddress);
      }
    });

    it("Should revert when register the same domain twice using #registerSubdomainBulk", async () => {
      const subdomainObj : ISubRegistrarConfig = {
        parentHash: domain.hash,
        label: "subdomain1",
        domainAddress: admin.address,
        tokenOwner: ethers.ZeroAddress,
        tokenURI: "0://tokenURI",
        distrConfig: {
          pricerContract: await zns.curvePricer.getAddress(),
          paymentType: PaymentType.STAKE,
          accessType: AccessType.LOCKED,
          priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
        },
        paymentConfig: {
          token: await zns.meowToken.getAddress(),
          beneficiary: admin.address,
        },
      };

      // Add allowance
      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      await expect(
        zns.subRegistrar.connect(lvl2SubOwner).registerSubdomainBulk([subdomainObj, subdomainObj])
      ).to.be.revertedWithCustomError(zns.rootRegistrar, "DomainAlreadyExists");
    });

    it("Should revert with 'ZeroAddressPassed' error when 1st subdomain in the array has zerohash", async () => {
      const subdomainObj : ISubRegistrarConfig = {
        parentHash: ethers.ZeroHash,
        label: "subdomainzeroaAddresspassed",
        domainAddress: admin.address,
        tokenOwner: ethers.ZeroAddress,
        tokenURI: "0://tokenURI",
        distrConfig: {
          pricerContract: await zns.curvePricer.getAddress(),
          paymentType: PaymentType.STAKE,
          accessType: AccessType.LOCKED,
          priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
        },
        paymentConfig: {
          token: await zns.meowToken.getAddress(),
          beneficiary: admin.address,
        },
      };

      // Add allowance
      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      await expect(
        zns.subRegistrar.connect(lvl2SubOwner).registerSubdomainBulk([subdomainObj])
      ).to.be.revertedWithCustomError(zns.subRegistrar, ZERO_PARENTHASH_ERR);
    });

    it("Should register a mix of nested and non-nested subdomains and validates hashes", async () => {
      // Structure of domains (- rootDomain; + subdomain):
      //
      // - rootHash
      //   + nested0
      //    + nested1
      //     + nested2
      //      + nested3
      // - specific0parent
      //   + non0nested0with0specific0parent0
      //   + non0nested0with0specific0parent1
      //   + non0nested0with0specific0parent2

      const subRegistrations : Array<ISubRegistrarConfig> = [];
      const expectedHashes : Array<string> = [];
      const labels = [
        "nested0",
        "nested1",
        "nested2",
        "nested3",
        "non0nested0with0specific0parent0",
        "non0nested0with0specific0parent1",
        "non0nested0with0specific0parent2",
      ];

      const specificParentHash = await registrationWithSetup({
        zns,
        user: specificRootOwner,
        domainLabel: "specific0parent",
        fullConfig: {
          distrConfig: {
            accessType: AccessType.OPEN,
            pricerContract: await zns.fixedPricer.getAddress(),
            paymentType: PaymentType.DIRECT,
            priceConfig: DEFAULT_FIXED_PRICER_CONFIG_BYTES,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: specificRootOwner.address,
          },
        },
      });

      for (let i = 0; i < labels.length; i++) {
        let parentHash;
        let referenceParentHash;

        if (i === 0) {
          parentHash = domain.hash;
          referenceParentHash = parentHash;
        } else if (i > 0 && i < 5) {
          parentHash = ethers.ZeroHash;
          referenceParentHash = expectedHashes[i - 1];
        } else {
          parentHash = specificParentHash;
          referenceParentHash = parentHash;
        }

        expectedHashes.push(
          await zns.subRegistrar.hashWithParent(referenceParentHash, labels[i])
        );

        subRegistrations.push({
          parentHash,
          label: labels[i],
          domainAddress: ethers.ZeroAddress,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: `uri${i}`,
          distrConfig: {
            pricerContract: ethers.ZeroAddress,
            paymentType: 0n,
            accessType: 0n,
            priceConfig: hre.ethers.ZeroHash,
          },
          paymentConfig: {
            token: ethers.ZeroAddress,
            beneficiary: ethers.ZeroAddress,
          },
        });
      }

      const tx = await zns.subRegistrar.connect(specificSubOwner).registerSubdomainBulk(subRegistrations);
      await tx.wait();

      const subRegEventsLog = await getDomainRegisteredEvents({
        zns,
        registrant: specificSubOwner.address,
      });

      // check with the events
      expect(subRegEventsLog.length).to.equal(expectedHashes.length);

      for (let i = 0; i < labels.length; i++) {
        const {
          args: {
            domainHash,
            label,
            tokenURI,
            domainOwner,
            tokenOwner,
          },
        } = subRegEventsLog[i];

        expect(domainHash).to.equal(expectedHashes[i]);
        expect(label).to.equal(labels[i]);
        expect(tokenURI).to.equal(subRegistrations[i].tokenURI);
        expect(domainOwner).to.equal(specificSubOwner.address);
        expect(tokenOwner).to.equal(specificSubOwner.address);
      }

      // check with the records
      for (let i = 0; i < subRegistrations.length; i++) {
        let record;
        // check, does a record exist
        try {
          record = await zns.registry.getDomainRecord(expectedHashes[i]);
        } catch (e) {
          expect.fail(`Domain record for hash ${expectedHashes[i]} not found`);
        }

        // check the owner
        expect(record.owner).to.eq(specificSubOwner.address);
      }
    });

    it("Should revert when registering during a registration pause using #registerSubdomainBulk", async () => {
      // pause the sub registrar
      await zns.subRegistrar.connect(admin).pauseRegistration();
      expect(await zns.subRegistrar.registrationPaused()).to.be.true;

      const registrations : Array<ISubRegistrarConfig> = [
        {
          parentHash: domain.hash,
          label: "subpaused",
          domainAddress: lvl2SubOwner.address,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: subTokenURI,
          distrConfig: distrConfigEmpty,
          paymentConfig: paymentConfigEmpty,
        },
      ];

      // try to register a subdomain
      await expect(
        zns.subRegistrar.connect(lvl2SubOwner).registerSubdomainBulk(registrations)
      ).to.be.revertedWithCustomError(
        zns.subRegistrar,
        REGISTRATION_PAUSED_ERR,
      );

      // unpause the sub registrar
      await zns.subRegistrar.connect(admin).unpauseRegistration();
      expect(await zns.subRegistrar.registrationPaused()).to.be.false;
    });
  });

  describe("Operations with domain paths", () => {
    let domainConfigs : Array<IFullDomainConfig>;

    interface RegRes {
      domainHash : string;
      label : string;
      owner : SignerWithAddress;
      parentHash : string | undefined;
    }
    const regResults : Array<RegRes> = [];

    const fixedPrice = ethers.parseEther("1375.612");
    const fixedFeePercentage = BigInt(200);

    const fixedPriceConfigBytes = encodePriceConfig({
      price: fixedPrice,
      feePercentage: fixedFeePercentage,
    });

    const regValidateAndSaveHashes = async ({
      configs,
      extrArray,
      executor,
    } : {
      configs : Array<IFullDomainConfig>;
      extrArray ?: Array<RegRes>;
      executor ?: SignerWithAddress;
      // TODO dom: idk, am I right here?
    }) : Promise<void | Array<RegRes>> => {
      const resultArray = [];
      let domObj;
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < configs.length; i++) {
        const config = configs[i];

        // pass parentHash as a hash of the previous domain
        // the first domain is root
        if (!config.parentHash) {
          if (i !== 0) {
            config.parentHash = domObj?.domainHash;
          } else {
            config.parentHash = ethers.ZeroHash;
          }
        }

        // register each domain
        const domain = new Domain({
          zns,
          domainConfig: config,
        });
        await domain.registerAndValidateDomain(executor ? executor : config.owner);

        domObj = {
          domainHash: domain.hash,
          label: config.label,
          owner: config.owner,
          parentHash: config.parentHash,
        };

        if (extrArray) {
          extrArray.push(domObj);
        } else {
          resultArray.push(domObj);
        }
      }

      if (resultArray.length > 0) {
        return resultArray;
      }
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
          owner: rootOwner,
          label: "root",
          tokenOwner: rootOwner.address,
          parentHash: ethers.ZeroHash,
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: fixedPriceConfigBytes,
            paymentType: PaymentType.DIRECT,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
          domainAddress: rootOwner.address,
          tokenURI: DEFAULT_TOKEN_URI,
        },
        {
          owner: lvl2SubOwner,
          label: "lvltwo",
          tokenOwner: lvl2SubOwner.address,
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
          domainAddress: lvl2SubOwner.address,
          tokenURI: subTokenURI,
        },
        {
          owner: lvl3SubOwner,
          label: "lvlthree",
          tokenOwner: lvl3SubOwner.address,
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
          domainAddress: lvl3SubOwner.address,
          tokenURI: subTokenURI,
        },
        {
          owner: lvl4SubOwner,
          label: "lvlfour",
          tokenOwner: lvl4SubOwner.address,
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
          domainAddress: lvl4SubOwner.address,
          tokenURI: subTokenURI,
        },
        {
          owner: lvl5SubOwner,
          label: "lvlfive",
          tokenOwner: lvl5SubOwner.address,
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: fixedPriceConfigBytes,
            paymentType: PaymentType.DIRECT,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl5SubOwner.address,
          },
          domainAddress: lvl5SubOwner.address,
          tokenURI: subTokenURI,
        },
        {
          owner: lvl6SubOwner,
          label: "lvlsix",
          tokenOwner: lvl6SubOwner.address,
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
          domainAddress: lvl6SubOwner.address,
          tokenURI: subTokenURI,
        },
      ];
    });

    it("should register a path of 6 domains with different configs", async () => {
      await regValidateAndSaveHashes({
        configs: domainConfigs,
        extrArray: regResults,
      });

      assert.equal(regResults.length, domainConfigs.length);
    });

    it("should be able to register multiple domains under multiple levels for the same owner", async () => {
      const configs = [
        {
          owner: multiOwner,
          label: "multiownerdomone",
          tokenOwner: multiOwner.address,
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: encodePriceConfig({ price: fixedPrice, feePercentage: BigInt(0) }),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: multiOwner.address,
          },
        },
        {
          owner: multiOwner,
          label: "multiownerdomtwo",
          tokenOwner: multiOwner.address,
          parentHash: regResults[0].domainHash,
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
            accessType: AccessType.LOCKED,
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: zeroVault.address,
          },
        },
        {
          owner: multiOwner,
          label: "multiownerdomthree",
          tokenOwner: multiOwner.address,
          parentHash: regResults[1].domainHash,
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
            accessType: AccessType.MINTLIST,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: multiOwner.address,
          },
        },
        {
          owner: multiOwner,
          label: "multiownerdomfour",
          tokenOwner: multiOwner.address,
          parentHash: regResults[2].domainHash,
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: encodePriceConfig({ price: fixedPrice, feePercentage: fixedFeePercentage }),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: zeroVault.address,
          },
        },
        {
          owner: multiOwner,
          label: "multiownerdomfive",
          tokenOwner: multiOwner.address,
          parentHash: regResults[3].domainHash,
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
            accessType: AccessType.OPEN,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: multiOwner.address,
          },
        },
        {
          owner: multiOwner,
          label: "multiownerdomsix",
          tokenOwner: multiOwner.address,
          parentHash: regResults[4].domainHash,
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
            accessType: AccessType.OPEN,
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: zeroVault.address,
          },
        },
        {
          owner: multiOwner,
          label: "multiownerdomseven",
          tokenOwner: multiOwner.address,
          parentHash: regResults[5].domainHash,
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: encodePriceConfig({ price: fixedPrice, feePercentage: fixedFeePercentage }),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: multiOwner.address,
          },
        },
      ];

      const regResultsLocal = await regValidateAndSaveHashes({
        configs,
      }) as Array<RegRes>;

      // check
      await regResultsLocal.reduce(
        async (acc, domainHash, idx) => {
          await acc;
          const { owner, resolver } = await zns.registry.getDomainRecord(regResultsLocal[idx].domainHash);
          expect(owner).to.eq(multiOwner.address);
          expect(resolver).to.eq(await zns.addressResolver.getAddress());

          const tokenId = BigInt(regResultsLocal[idx].domainHash).toString();
          const tokenOwner = await zns.domainToken.ownerOf(tokenId);
          expect(tokenOwner).to.eq(multiOwner.address);

          const {
            pricerContract,
            accessType,
            paymentType,
          } = await zns.subRegistrar.distrConfigs(regResultsLocal[idx].domainHash);
          expect(pricerContract).to.eq(configs[idx].distrConfig?.pricerContract);
          expect(accessType).to.eq(configs[idx].distrConfig?.accessType);
          expect(paymentType).to.eq(configs[idx].distrConfig?.paymentType);

          const {
            token,
            beneficiary,
          } = await zns.treasury.paymentConfigs(regResultsLocal[idx].domainHash);
          expect(token).to.eq(configs[idx].paymentConfig?.token);
          expect(beneficiary).to.eq(configs[idx].paymentConfig?.beneficiary);

          const domainAddress = await zns.addressResolver.resolveDomainAddress(regResultsLocal[idx].domainHash);
          expect(domainAddress).to.eq(multiOwner.address);
        }, Promise.resolve()
      );
    });

    it("should revoke lvl 6 domain without refund, lock registration and remove mintlist", async () => {
      const domainHash = regResults[5].domainHash;

      // add to mintlist
      await zns.subRegistrar.connect(lvl6SubOwner).updateMintlistForDomain(
        domainHash,
        [lvl6SubOwner.address, lvl2SubOwner.address],
        [true, true]
      );

      const userBalBefore = await zns.meowToken.balanceOf(lvl6SubOwner.address);

      await zns.rootRegistrar.connect(lvl6SubOwner).revokeDomain(
        domainHash,
      );

      const userBalAfter = await zns.meowToken.balanceOf(lvl6SubOwner.address);

      expect(userBalAfter - userBalBefore).to.eq(0);

      // make sure that accessType has been set to LOCKED
      // and nobody can register a subdomain under this domain
      const { accessType: accessTypeFromSC } = await zns.subRegistrar.distrConfigs(domainHash);
      expect(accessTypeFromSC).to.eq(AccessType.LOCKED);

      // make sure that mintlist has been removed
      expect(await zns.subRegistrar.isMintlistedForDomain(domainHash, lvl6SubOwner.address)).to.eq(false);
      expect(await zns.subRegistrar.isMintlistedForDomain(domainHash, lvl2SubOwner.address)).to.eq(false);

      await expect(
        zns.subRegistrar.connect(lvl6SubOwner).registerSubdomain({
          parentHash: domainHash,
          label: "newsubdomain",
          domainAddress: lvl6SubOwner.address,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: distrConfigEmpty,
          paymentConfig: paymentConfigEmpty,
        })
      ).to.be.revertedWithCustomError(
        zns.subRegistrar,
        DISTRIBUTION_LOCKED_NOT_EXIST_ERR
      );

      const dataFromReg = await zns.registry.getDomainRecord(domainHash);
      expect(dataFromReg.owner).to.eq(ethers.ZeroAddress);
      expect(dataFromReg.resolver).to.eq(ethers.ZeroAddress);

      const tokenId = BigInt(domainHash).toString();
      await expect(
        zns.domainToken.ownerOf(tokenId)
      ).to.be.revertedWithCustomError(
        zns.domainToken,
        NONEXISTENT_TOKEN_ERC_ERR
      ).withArgs(tokenId);

      await expect(
        zns.registry.connect(lvl6SubOwner).updateDomainRecord(domainHash, rootOwner.address, lvl6SubOwner.address)
      ).to.be.revertedWithCustomError(
        zns.registry,
        NOT_AUTHORIZED_ERR
      );
    });

    it("should revoke lvl 5 domain with refund", async () => {
      const domainHash = regResults[4].domainHash;

      const userBalanceBefore = await zns.meowToken.balanceOf(lvl5SubOwner.address);
      const parentBalBefore = await zns.meowToken.balanceOf(lvl4SubOwner.address);
      const paymentContractBalBefore = await zns.meowToken.balanceOf(await zns.treasury.getAddress());

      const stake = await zns.treasury.stakedForDomain(domainHash);
      const protocolFee = getStakingOrProtocolFee(stake.amount);

      await zns.meowToken.connect(lvl5SubOwner).approve(await zns.treasury.getAddress(), protocolFee);

      await zns.rootRegistrar.connect(lvl5SubOwner).revokeDomain(domainHash);

      const userBalAfter = await zns.meowToken.balanceOf(lvl5SubOwner.address);
      const parentBalAfter = await zns.meowToken.balanceOf(lvl4SubOwner.address);
      const paymentContractBalAfter = await zns.meowToken.balanceOf(await zns.treasury.getAddress());

      const { expectedPrice } = getPriceObject(domainConfigs[4].label);

      expect(
        userBalAfter - userBalanceBefore
      ).to.eq(
        expectedPrice - protocolFee
      );
      expect(
        parentBalBefore - parentBalAfter
      ).to.eq(
        BigInt(0)
      );
      expect(
        paymentContractBalBefore - paymentContractBalAfter
      ).to.eq(
        expectedPrice
      );

      // make sure that accessType has been set to LOCKED
      // and nobody can register a subdomain under this domain
      const { accessType: accessTypeFromSC } = await zns.subRegistrar.distrConfigs(domainHash);
      expect(accessTypeFromSC).to.eq(AccessType.LOCKED);

      await expect(
        zns.subRegistrar.connect(lvl6SubOwner).registerSubdomain({
          parentHash: domainHash,
          label: "newsubdomain",
          domainAddress: lvl6SubOwner.address,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: distrConfigEmpty,
          paymentConfig: paymentConfigEmpty,
        })
      ).to.be.revertedWithCustomError(
        zns.subRegistrar,
        DISTRIBUTION_LOCKED_NOT_EXIST_ERR
      );

      const dataFromReg = await zns.registry.getDomainRecord(domainHash);
      expect(dataFromReg.owner).to.eq(ethers.ZeroAddress);
      expect(dataFromReg.resolver).to.eq(ethers.ZeroAddress);

      const tokenId = BigInt(domainHash).toString();
      await expect(
        zns.domainToken.ownerOf(tokenId)
      ).to.be.revertedWithCustomError(
        zns.domainToken,
        NONEXISTENT_TOKEN_ERC_ERR
      ).withArgs(tokenId);

      await expect(
        zns.registry.connect(lvl5SubOwner).updateDomainRecord(domainHash,rootOwner.address,lvl6SubOwner.address)
      ).to.be.revertedWithCustomError(
        zns.registry,
        NOT_AUTHORIZED_ERR
      );
    });

    it("should register a new 2 lvl path at lvl 3 of the existing path", async () => {
      const newConfigs : Array<IDomainConfigForTest> = [
        {
          user: branchLvl1Owner,
          domainLabel: "lvlthreenew",
          parentHash: regResults[2].domainHash,
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              priceConfig: fixedPriceConfigBytes,
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: branchLvl1Owner.address,
            },
          },
        },
        {
          user: branchLvl2Owner,
          domainLabel: "lvlfournew",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.curvePricer.getAddress(),
              priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
              paymentType: PaymentType.STAKE,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: branchLvl2Owner.address,
            },
          },
        },
      ];

      const newRegResults = await registerDomainPath({
        zns,
        domainConfigs: newConfigs,
        zeroVaultAddress: zeroVault.address,
      });

      await validatePathRegistration({
        zns,
        domainConfigs: newConfigs,
        regResults: newRegResults,
      });
    });

    it("should revoke lvl 3 domain (child) with refund after lvl 2 (parent) has been revoked", async () => {
      const lvl2Hash = regResults[1].domainHash;
      const lvl3Hash = regResults[2].domainHash;

      const childExists = await zns.registry.exists(lvl3Hash);
      assert.ok(childExists);

      const stake = await zns.treasury.stakedForDomain(lvl2Hash);
      const protocolFee = getStakingOrProtocolFee(stake.amount);

      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), protocolFee);

      // revoke parent
      await zns.rootRegistrar.connect(lvl2SubOwner).revokeDomain(
        lvl2Hash,
      );

      // make sure all parent's distribution configs still exist
      const parentDistrConfig = await zns.subRegistrar.distrConfigs(lvl2Hash);
      const parentPaymentConfig = await zns.treasury.paymentConfigs(lvl2Hash);
      expect(parentDistrConfig.pricerContract).to.eq(domainConfigs[1].distrConfig?.pricerContract);
      expect(
        parentDistrConfig.paymentType
      ).to.eq(
        domainConfigs[1].distrConfig?.paymentType
      );
      expect(
        parentPaymentConfig.token
      ).to.eq(
        domainConfigs[1].paymentConfig?.token
      );
      expect(
        parentPaymentConfig.beneficiary
      ).to.eq(
        domainConfigs[1].paymentConfig?.beneficiary
      );

      expect(parentDistrConfig.pricerContract).to.eq(await zns.curvePricer.getAddress());

      // check a couple of fields from price config
      const distrConfig = await zns.subRegistrar.distrConfigs(lvl2Hash);
      const priceConfig = decodePriceConfig(distrConfig.priceConfig);
      const priceConfigFromDomain = decodePriceConfig(domainConfigs[1].distrConfig.priceConfig);

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if ("maxPrice" in priceConfigFromDomain) {
        expect((priceConfig as ICurvePriceConfig).maxPrice).to.eq(priceConfigFromDomain.maxPrice);
      }

      // make sure the child's stake is still there
      const { amount: childStakedAmt } = await zns.treasury.stakedForDomain(lvl3Hash);
      const { expectedPrice } = getPriceObject(domainConfigs[2].label);

      expect(childStakedAmt).to.eq(expectedPrice);

      const userBalBefore = await zns.meowToken.balanceOf(lvl3SubOwner.address);

      const subStake = await zns.treasury.stakedForDomain(lvl3Hash);
      const subProtocolFee = getStakingOrProtocolFee(subStake.amount);

      await zns.meowToken.connect(lvl3SubOwner).approve(await zns.treasury.getAddress(), subProtocolFee);

      // revoke child
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        lvl3Hash,
      );

      const userBalAfter = await zns.meowToken.balanceOf(lvl3SubOwner.address);

      expect(userBalAfter - userBalBefore).to.eq(expectedPrice - subProtocolFee);

      const childExistsAfter = await zns.registry.exists(lvl3Hash);
      assert.ok(!childExistsAfter);

      const { amount: stakedAfterRevoke } = await zns.treasury.stakedForDomain(lvl3Hash);
      expect(stakedAfterRevoke).to.eq(0);

      const dataFromReg = await zns.registry.getDomainRecord(lvl3Hash);
      expect(dataFromReg.owner).to.eq(ethers.ZeroAddress);
      expect(dataFromReg.resolver).to.eq(ethers.ZeroAddress);

      const tokenId = BigInt(lvl3Hash).toString();
      await expect(
        zns.domainToken.ownerOf(tokenId)
      ).to.be.revertedWithCustomError(
        zns.domainToken,
        NONEXISTENT_TOKEN_ERC_ERR
      ).withArgs(tokenId);

      await expect(
        zns.registry.connect(lvl3SubOwner).updateDomainRecord(lvl3Hash, rootOwner.address, lvl4SubOwner.address)
      ).to.be.revertedWithCustomError(
        zns.registry,
        NOT_AUTHORIZED_ERR
      );
    });

    it("should let anyone register a previously revoked domain", async () => {
      const lvl2Hash = regResults[1].domainHash;
      const parentHash = regResults[0].domainHash;

      const exists = await zns.registry.exists(lvl2Hash);
      if (!exists) {
        const subdomain = new Domain({
          zns,
          domainConfig: {
            owner: lvl2SubOwner,
            tokenOwner: lvl2SubOwner.address,
            parentHash,
            label: domainConfigs[1].label,
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
          // domainConfigs[1],
          // {
          //   owner: lvl2SubOwner,
          //   label: domainConfigs[1].label,
          //   tokenOwner: lvl2SubOwner.address,
          //   parentHash,
          //   distrConfig: domainConfigs[1].distrConfig,
          //   paymentConfig: domainConfigs[1].paymentConfig,
          //   domainAddress: lvl2SubOwner.address,
          //   tokenURI: subTokenURI,
          // },
        });
        await subdomain.register();

        expect(subdomain.hash).to.eq(lvl2Hash);
      }

      // revoke subdomain
      await zns.rootRegistrar.connect(lvl2SubOwner).revokeDomain(
        lvl2Hash,
      );

      const subdomain = new Domain({
        zns,
        domainConfig: {
          owner: branchLvl1Owner,
          label: "lvltwonew",
          tokenOwner: branchLvl1Owner.address,
          parentHash,
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: encodePriceConfig({ price: fixedPrice, feePercentage: fixedFeePercentage }),
            paymentType: PaymentType.DIRECT,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: branchLvl1Owner.address,
          },
          domainAddress: branchLvl1Owner.address,
          tokenURI: DEFAULT_TOKEN_URI,
        },
      });
      await subdomain.registerAndValidateDomain();
    });

    it("should NOT register a child (subdomain) under a parent (root domain) that has been revoked", async () => {
      const lvl1Hash = regResults[0].domainHash;

      // revoke parent
      await zns.rootRegistrar.connect(rootOwner).revokeDomain(
        lvl1Hash
      );

      const exists = await zns.registry.exists(lvl1Hash);
      assert.ok(!exists);

      const subdomain = new Domain({
        zns,
        domainConfig: {
          owner: branchLvl1Owner,
          parentHash: lvl1Hash,
          label: "newsubdomain",
          domainAddress: branchLvl1Owner.address,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: distrConfigEmpty,
          paymentConfig: paymentConfigEmpty,
        },
      });
      await expect(
        subdomain.register()
      ).to.be.revertedWithCustomError(
        zns.subRegistrar,
        DISTRIBUTION_LOCKED_NOT_EXIST_ERR
      );

      // register root back for other tests
      const domain = new Domain({
        zns,
        domainConfig: domainConfigs[0],
      });
      await domain.registerAndValidateDomain();
    });

    it("should NOT register a child (subdomain) under a parent (subdomain) that has been revoked", async () => {
      const lvl4Hash = regResults[3].domainHash;

      // revoke parent
      await zns.rootRegistrar.connect(lvl4SubOwner).revokeDomain(
        lvl4Hash,
      );

      const exists = await zns.registry.exists(lvl4Hash);
      assert.ok(!exists);

      const subdomain = new Domain({
        zns,
        domainConfig: {
          owner: branchLvl2Owner,
          parentHash: lvl4Hash,
          label: "newsubdomain",
          domainAddress: branchLvl2Owner.address,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: distrConfigEmpty,
          paymentConfig: paymentConfigEmpty,
        },
      });

      await expect(
        subdomain.register(branchLvl2Owner)
      ).to.be.revertedWithCustomError(
        zns.subRegistrar,
        DISTRIBUTION_LOCKED_NOT_EXIST_ERR
      );
    });

    // eslint-disable-next-line max-len
    it("should allow setting a new config and start distributing subdomain when registering a previously revoked parent", async () => {
      if (!await zns.registry.exists(regResults[1].domainHash)) {
        const subdomain = new Domain({
          zns,
          domainConfig: domainConfigs[1],
        });
        await subdomain.register();
      }

      // revoke parent
      await zns.rootRegistrar.connect(lvl2SubOwner).revokeDomain(regResults[1].domainHash);

      expect(await zns.registry.exists(regResults[1].domainHash)).to.eq(false);

      // register again with new owner and config
      const subdomain = new Domain({
        zns,
        domainConfig: {
          owner: branchLvl1Owner,
          tokenOwner: branchLvl1Owner.address,
          parentHash: regResults[0].domainHash,
          label: domainConfigs[1].label,
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: encodePriceConfig({
              price: fixedPrice,
              feePercentage: BigInt(0),
            }),
            paymentType: PaymentType.DIRECT,
            accessType: AccessType.MINTLIST,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: branchLvl1Owner.address,
          },
        },
      });
      await subdomain.registerAndValidateDomain();

      expect(subdomain.hash).to.eq(regResults[1].domainHash);

      // add new child owner to mintlist
      await zns.subRegistrar.connect(branchLvl1Owner).updateMintlistForDomain(
        subdomain.hash,
        [ branchLvl2Owner.address ],
        [ true ],
      );

      const parentOwnerFromReg = await zns.registry.getDomainOwner(subdomain.hash);
      expect(parentOwnerFromReg).to.eq(branchLvl1Owner.address);

      const childBalBefore = await zns.meowToken.balanceOf(branchLvl2Owner.address);

      // try register a new child under the new parent
      const newChildHash = new Domain({
        zns,
        domainConfig:{
          owner: branchLvl2Owner,
          tokenOwner: branchLvl2Owner.address,
          parentHash: subdomain.hash,
          label: "newchildddd",
          distrConfig: {
            pricerContract: ethers.ZeroAddress,
            paymentType: PaymentType.DIRECT,
            accessType: AccessType.LOCKED,
            priceConfig: ZeroHash,
          },
          paymentConfig: {
            token: ethers.ZeroAddress,
            beneficiary: ethers.ZeroAddress,
          },
        },
      });
      await newChildHash.registerAndValidateDomain(branchLvl2Owner);

      const childBalAfter = await zns.meowToken.balanceOf(branchLvl2Owner.address);

      const protocolFee = getStakingOrProtocolFee(fixedPrice);

      // make sure child payed based on the new parent config
      expect(childBalBefore - childBalAfter).to.eq(fixedPrice + protocolFee);
    });
  });

  describe("Token movements with different distr setups", () => {
    let fixedPrice : bigint;
    let feePercentage : bigint;
    let token2 : CustomDecimalTokenMock;
    let token5 : CustomDecimalTokenMock;
    let token8 : CustomDecimalTokenMock;
    let token13 : CustomDecimalTokenMock;
    let token18 : CustomDecimalTokenMock;

    let domain : Domain;

    const decimalValues = {
      two: BigInt(2),
      five: BigInt(5),
      eight: BigInt(8),
      thirteen: BigInt(13),
      eighteen: BigInt(18),
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
      ] = await hre.ethers.getSigners();
      // zeroVault address is used to hold the fee charged to the user when registering
      zns = await deployZNS({
        deployer,
        governorAddresses: [deployer.address, governor.address],
        adminAddresses: [admin.address],
        zeroVaultAddress: zeroVault.address,
      });

      ([
        token2,
        token5,
        token8,
        token13,
        token18,
      ] = await Object.values(decimalValues).reduce(
        async (acc : Promise<Array<CustomDecimalTokenMock>>, decimals) => {
          const newAcc = await acc;

          const token = await deployCustomDecToken(deployer, decimals);

          return [...newAcc, token];
        }, Promise.resolve([])
      ));

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

      // register root domain
      domain = new Domain({
        zns,
        domainConfig: {
          owner: rootOwner,
          tokenOwner: rootOwner.address,
          label: "root",
          parentHash: ethers.ZeroHash,
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: encodePriceConfig({
              price: ethers.parseEther("1375.612"),
              feePercentage: BigInt(0),
            }),
            paymentType: PaymentType.DIRECT,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });

      await domain.register();
    });

    it("FixedPricer - StakePayment - stake fee - 5 decimals", async () => {
      const decimals = await token5.decimals();
      expect(decimals).to.eq(decimalValues.five);

      fixedPrice = ethers.parseUnits("1375.17", decimalValues.five);
      feePercentage = BigInt(200);

      const priceConfig = {
        price: fixedPrice,
        feePercentage,
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        tokenOwner: lvl2SubOwner.address,
        parentHash: domain.hash,
        domainLabel: "fixedstake",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: encodePriceConfig(priceConfig),
            paymentType: PaymentType.STAKE,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await token5.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });

      const label = "fixedstakechild";

      const {
        expectedPrice,
        stakeFee: stakeFee,
      } = getPriceObject(label, priceConfig);
      const protocolFee = getStakingOrProtocolFee(
        expectedPrice + stakeFee
      );

      // send future child some tokens
      await token5.connect(deployer).transfer(lvl3SubOwner.address, expectedPrice + stakeFee + (protocolFee * 2n));

      const contractBalBefore = await token5.balanceOf(await zns.treasury.getAddress());
      const parentBalBefore = await token5.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await token5.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await token5.balanceOf(zeroVault.address);

      const childHash = await registrationWithSetup({
        zns,
        tokenOwner: lvl3SubOwner.address,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
        fullConfig: FULL_DISTR_CONFIG_EMPTY,
      });

      const parentBalAfter = await token5.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await token5.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await token5.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfter = await token5.balanceOf(zeroVault.address);

      expect(parentBalAfter - parentBalBefore).to.eq(stakeFee);
      expect(childBalBefore - childBalAfter).to.eq(expectedPrice + stakeFee + protocolFee);
      expect(contractBalAfter - contractBalBefore).to.eq(expectedPrice);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(protocolFee);

      const stake = await zns.treasury.stakedForDomain(childHash);
      const protocolFeeOut = getStakingOrProtocolFee(stake.amount);

      await token5.connect(lvl3SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        childHash,
      );

      // should offer refund !
      const contractBalAfterRevoke = await token5.balanceOf(await zns.treasury.getAddress());
      const childBalAfterRevoke = await token5.balanceOf(lvl3SubOwner.address);
      const parentBalAfterRevoke = await token5.balanceOf(lvl2SubOwner.address);
      const zeroVaultBalanceAfterRevoke = await token5.balanceOf(zeroVault.address);

      expect(contractBalAfter - contractBalAfterRevoke).to.eq(expectedPrice);
      expect(childBalAfterRevoke - childBalAfter).to.eq(expectedPrice - protocolFeeOut);
      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter - protocolFeeOut).to.eq(0);
    });

    it("Does not charge the owner of a parent domain when they revoke a subdomain", async () => {
      const subdomainHash = await registrationWithSetup({
        zns,
        tokenOwner: rootOwner.address,
        user: rootOwner,
        parentHash: domain.hash,
        domainLabel: "subdomain",
      });

      const balanceBefore = await zns.meowToken.balanceOf(rootOwner.address);

      await zns.rootRegistrar.connect(rootOwner).revokeDomain(subdomainHash);

      const balanceAfter = await zns.meowToken.balanceOf(rootOwner.address);
      expect(balanceBefore).to.eq(balanceAfter);
    });

    it("FixedPricer - StakePayment - no fee - 18 decimals", async () => {
      const priceConfig = {
        price: ethers.parseUnits("397.77", decimalValues.eighteen),
        feePercentage: BigInt(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        tokenOwner: lvl2SubOwner.address,
        parentHash: domain.hash,
        domainLabel: "fixedstakenofee",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: encodePriceConfig(priceConfig),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            token: await token18.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });

      const label = "fixedstakenofeechild";

      const { expectedPrice } = getPriceObject(label, priceConfig);
      const protocolFee = getStakingOrProtocolFee(expectedPrice);

      // send future child some tokens
      await token18.connect(deployer).transfer(
        lvl3SubOwner.address,
        expectedPrice + (protocolFee * 2n)
      );

      const contractBalBefore = await token18.balanceOf(await zns.treasury.getAddress());
      const parentBalBefore = await token18.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await token18.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await token18.balanceOf(zeroVault.address);

      const childHash = await registrationWithSetup({
        zns,
        tokenOwner: lvl3SubOwner.address,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
      });

      const parentBalAfter = await token18.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await token18.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await token18.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfter = await token18.balanceOf(zeroVault.address);

      expect(parentBalAfter - parentBalBefore).to.eq(0);
      expect(childBalBefore - childBalAfter).to.eq(expectedPrice + protocolFee);
      expect(contractBalAfter - contractBalBefore).to.eq(expectedPrice);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(protocolFee);

      await token18.connect(lvl3SubOwner).approve(await zns.treasury.getAddress(), protocolFee);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        childHash,
      );

      // should offer refund !
      const contractBalAfterRevoke = await token18.balanceOf(await zns.treasury.getAddress());
      const childBalAfterRevoke = await token18.balanceOf(lvl3SubOwner.address);
      const parentBalAfterRevoke = await token18.balanceOf(lvl2SubOwner.address);
      const zeroVaultBalanceAfterRevoke = await token18.balanceOf(zeroVault.address);

      expect(contractBalAfter - contractBalAfterRevoke).to.eq(expectedPrice);
      expect(childBalAfterRevoke - childBalAfter).to.eq(expectedPrice - protocolFee);
      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter - protocolFee).to.eq(0);
    });

    it("FixedPricer - DirectPayment - no fee - 8 decimals", async () => {
      const priceConfig = {
        price: ethers.parseUnits("11.371", decimalValues.eight),
        feePercentage: BigInt(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        tokenOwner: lvl2SubOwner.address,
        parentHash: domain.hash,
        domainLabel: "fixeddirectnofee",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: encodePriceConfig(priceConfig),
            paymentType: PaymentType.DIRECT,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await token8.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });

      const label = "fixeddirectnofeechild";
      const { expectedPrice } = getPriceObject(label, priceConfig);
      const protocolFee = getStakingOrProtocolFee(expectedPrice);

      // send future child some tokens
      await token8.connect(deployer).transfer(
        lvl3SubOwner.address,
        expectedPrice + protocolFee
      );

      const parentBalBefore = await token8.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await token8.balanceOf(lvl3SubOwner.address);
      const contractBalBefore = await token8.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceBefore = await token8.balanceOf(zeroVault.address);


      const childHash = await registrationWithSetup({
        zns,
        tokenOwner: lvl3SubOwner.address,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
        fullConfig: FULL_DISTR_CONFIG_EMPTY,
      });

      const parentBalAfter = await token8.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await token8.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await token8.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfter = await token8.balanceOf(zeroVault.address);


      expect(parentBalAfter - parentBalBefore).to.eq(expectedPrice);
      expect(childBalBefore - childBalAfter).to.eq(expectedPrice + protocolFee);
      expect(contractBalAfter - contractBalBefore).to.eq(0);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(protocolFee);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        childHash,
      );

      // should NOT offer refund !
      const parentBalAfterRevoke = await token8.balanceOf(lvl2SubOwner.address);
      const childBalAfterRevoke = await token8.balanceOf(lvl3SubOwner.address);
      const contractBalAfterRevoke = await token8.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfterRevoke = await token8.balanceOf(zeroVault.address);

      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(childBalAfterRevoke - childBalAfter).to.eq(0);
      expect(contractBalAfterRevoke - contractBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter).to.eq(0);
    });

    it("CurvePricer - StakePayment - stake fee - 13 decimals", async () => {
      const priceConfig = {
        maxPrice: ethers.parseUnits("30000.93", decimalValues.thirteen),
        curveMultiplier: BigInt(1000),
        maxLength: BigInt(50),
        baseLength: BigInt(4),
        precisionMultiplier: BigInt(10) ** (
          decimalValues.thirteen - DEFAULT_PRECISION
        ),
        feePercentage: BigInt(185),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        tokenOwner: lvl2SubOwner.address,
        parentHash: domain.hash,
        domainLabel: "asympstake",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            priceConfig: encodePriceConfig(priceConfig),
            paymentType: PaymentType.STAKE,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await token13.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });

      const label = "curvestakechild";

      const {
        expectedPrice,
        stakeFee: stakeFee,
      } = getPriceObject(label, priceConfig);
      const protocolFee = getStakingOrProtocolFee(
        expectedPrice + stakeFee
      );

      // send future child some tokens
      await token13.connect(deployer).transfer(
        lvl3SubOwner.address,
        expectedPrice + stakeFee + (protocolFee * 2n)
      );

      const contractBalBefore = await token13.balanceOf(await zns.treasury.getAddress());
      const parentBalBefore = await token13.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await token13.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await token13.balanceOf(zeroVault.address);

      const childHash = await registrationWithSetup({
        zns,
        tokenOwner: lvl3SubOwner.address,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
        fullConfig: FULL_DISTR_CONFIG_EMPTY,
      });

      const contractBalAfter = await token13.balanceOf(await zns.treasury.getAddress());
      const parentBalAfter = await token13.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await token13.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceAfter = await token13.balanceOf(zeroVault.address);

      expect(parentBalAfter - parentBalBefore).to.eq(stakeFee);
      expect(childBalBefore - childBalAfter).to.eq(expectedPrice + protocolFee + stakeFee);
      expect(contractBalAfter - contractBalBefore).to.eq(expectedPrice);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(protocolFee);

      const protocolFeeOut = getStakingOrProtocolFee(expectedPrice);
      await token13.connect(lvl3SubOwner).approve(await zns.treasury.getAddress(), protocolFeeOut);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(childHash);

      // should offer refund !
      const contractBalAfterRevoke = await token13.balanceOf(await zns.treasury.getAddress());
      const childBalAfterRevoke = await token13.balanceOf(lvl3SubOwner.address);
      const parentBalAfterRevoke = await token13.balanceOf(lvl2SubOwner.address);
      const zeroVaultBalanceAfterRevoke = await token13.balanceOf(zeroVault.address);

      expect(contractBalAfter - contractBalAfterRevoke).to.eq(expectedPrice);
      expect(childBalAfterRevoke - childBalAfter).to.eq(expectedPrice - protocolFeeOut);
      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter - protocolFeeOut).to.eq(0);
    });

    it("CurvePricer - StakePayment - no fee - 2 decimals", async () => {
      const priceConfig = {
        maxPrice: ethers.parseUnits("234.46", decimalValues.two),
        curveMultiplier: BigInt(1000),
        maxLength: BigInt(20),
        baseLength: BigInt(2),
        precisionMultiplier: BigInt(1),
        feePercentage: BigInt(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        tokenOwner: lvl2SubOwner.address,
        parentHash: domain.hash,
        domainLabel: "curvestakenofee",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            priceConfig: encodePriceConfig(priceConfig),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            token: await token2.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });

      const label = "curvestakenofeechild";

      const { expectedPrice } = getPriceObject(label, priceConfig);
      const protocolFee = getStakingOrProtocolFee(expectedPrice);

      // send future child some tokens
      await token2.connect(deployer).transfer(
        lvl3SubOwner.address,
        expectedPrice + (protocolFee * 2n)
      );

      const contractBalBefore = await token2.balanceOf(await zns.treasury.getAddress());
      const parentBalBefore = await token2.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await token2.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await token2.balanceOf(zeroVault.address);

      const childHash = await registrationWithSetup({
        zns,
        tokenOwner: lvl3SubOwner.address,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
      });

      const contractBalAfter = await token2.balanceOf(await zns.treasury.getAddress());
      const parentBalAfter = await token2.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await token2.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceAfter = await token2.balanceOf(zeroVault.address);

      expect(parentBalAfter - parentBalBefore).to.eq(0);
      expect(childBalBefore - childBalAfter).to.eq(expectedPrice + protocolFee);
      expect(contractBalAfter - contractBalBefore).to.eq(expectedPrice);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(protocolFee);

      await token2.connect(lvl3SubOwner).approve(await zns.treasury.getAddress(), protocolFee);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        childHash,
      );

      // should offer refund !
      const contractBalAfterRevoke = await token2.balanceOf(await zns.treasury.getAddress());
      const childBalAfterRevoke = await token2.balanceOf(lvl3SubOwner.address);
      const parentBalAfterRevoke = await token2.balanceOf(lvl2SubOwner.address);
      const zeroVaultBalanceAfterRevoke = await token2.balanceOf(zeroVault.address);

      expect(contractBalAfter - contractBalAfterRevoke).to.eq(expectedPrice);
      expect(childBalAfterRevoke - childBalAfter).to.eq(expectedPrice - protocolFee);
      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter - protocolFee).to.eq(0);
    });

    it("CurvePricer - DirectPayment - no fee - 18 decimals", async () => {
      const priceConfig = {
        ...DEFAULT_CURVE_PRICE_CONFIG,
        feePercentage: BigInt(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        tokenOwner: lvl2SubOwner.address,
        parentHash: domain.hash,
        domainLabel: "curvedirectnofee",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            priceConfig: encodePriceConfig(priceConfig),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            // zero has 18 decimals
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });

      const label = "asdirectnofeechild";

      const contractBalBefore = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const parentBalBefore = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.meowToken.balanceOf(zeroVault.address);

      const childHash = await registrationWithSetup({
        zns,
        tokenOwner: lvl3SubOwner.address,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
      });

      const parentBalAfter = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfter = await zns.meowToken.balanceOf(zeroVault.address);

      const { expectedPrice } = getPriceObject(label, priceConfig);
      const protocolFee = getStakingOrProtocolFee(expectedPrice);

      expect(parentBalAfter - parentBalBefore).to.eq(expectedPrice);
      expect(childBalBefore - childBalAfter).to.eq(expectedPrice + protocolFee);
      expect(contractBalAfter - contractBalBefore).to.eq(0);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(protocolFee);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        childHash,
      );

      // should NOT offer refund !
      const parentBalAfterRevoke = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfterRevoke = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfterRevoke = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfterRevoke = await zns.meowToken.balanceOf(zeroVault.address);

      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(childBalAfterRevoke - childBalAfter).to.eq(0);
      expect(contractBalAfterRevoke - contractBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter).to.eq(0);
    });

    it("FixedPricer + DirectPayment with price = 0 - should NOT perform any transfers", async () => {
      const priceConfig = {
        price: BigInt(0),
        feePercentage: BigInt(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        tokenOwner: lvl2SubOwner.address,
        parentHash: domain.hash,
        domainLabel: "zeroprice",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: encodePriceConfig(priceConfig),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });

      const contractBalBefore = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const parentBalBefore = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.meowToken.balanceOf(zeroVault.address);

      const label = "zeropricechild";
      const childHash = await registrationWithSetup({
        zns,
        tokenOwner: lvl3SubOwner.address,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
      });

      const parentBalAfter = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfter = await zns.meowToken.balanceOf(zeroVault.address);

      expect(parentBalAfter - parentBalBefore).to.eq(0);
      expect(childBalBefore - childBalAfter).to.eq(0);
      expect(contractBalAfter - contractBalBefore).to.eq(0);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(0);

      // validate transfer events are not happenning
      const latestBlock = await time.latestBlock();
      const transferFilterToParent = zns.meowToken.filters.Transfer(lvl3SubOwner.address, lvl2SubOwner.address);
      const transferFilterToTreasury = zns.meowToken.filters.Transfer(
        lvl3SubOwner.address,
        await zns.treasury.getAddress()
      );
      const transfersToParent = await zns.meowToken.queryFilter(
        transferFilterToParent,
        latestBlock - 3,
        latestBlock
      );
      const transfersToTreasury = await zns.meowToken.queryFilter(
        transferFilterToTreasury,
        latestBlock - 3,
        latestBlock
      );
      expect(transfersToParent.length).to.eq(0);
      expect(transfersToTreasury.length).to.eq(0);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        childHash,
      );

      // should NOT offer refund !
      const parentBalAfterRevoke = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfterRevoke = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfterRevoke = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfterRevoke = await zns.meowToken.balanceOf(zeroVault.address);

      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(childBalAfterRevoke - childBalAfter).to.eq(0);
      expect(contractBalAfterRevoke - contractBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter).to.eq(0);
    });

    it("CurvePricer + DirectPayment with price = 0 - should NOT perform any transfers", async () => {
      const priceConfig = {
        ...DEFAULT_CURVE_PRICE_CONFIG,
        maxPrice: BigInt(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        tokenOwner: lvl2SubOwner.address,
        parentHash: domain.hash,
        domainLabel: "zeropricead",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            priceConfig: encodePriceConfig(priceConfig),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });

      const contractBalBefore = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const parentBalBefore = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.meowToken.balanceOf(zeroVault.address);

      const label = "zeropricechildad";
      const childHash = await registrationWithSetup({
        zns,
        tokenOwner: lvl3SubOwner.address,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
      });

      const parentBalAfter = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfter = await zns.meowToken.balanceOf(zeroVault.address);

      expect(parentBalAfter - parentBalBefore).to.eq(0);
      expect(childBalBefore - childBalAfter).to.eq(0);
      expect(contractBalAfter - contractBalBefore).to.eq(0);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(0);

      // validate transfer events are not happenning
      const latestBlock = await time.latestBlock();
      const transferFilterToParent = zns.meowToken.filters.Transfer(
        lvl3SubOwner.address,
        lvl2SubOwner.address
      );
      const transferFilterToTreasury = zns.meowToken.filters.Transfer(
        lvl3SubOwner.address,
        await zns.treasury.getAddress()
      );
      const transfersToParent = await zns.meowToken.queryFilter(
        transferFilterToParent,
        latestBlock - 3,
        latestBlock
      );
      const transfersToTreasury = await zns.meowToken.queryFilter(
        transferFilterToTreasury,
        latestBlock - 3,
        latestBlock
      );
      expect(transfersToParent.length).to.eq(0);
      expect(transfersToTreasury.length).to.eq(0);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        childHash,
      );

      // should NOT offer refund !
      const parentBalAfterRevoke = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfterRevoke = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfterRevoke = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfterRevoke = await zns.meowToken.balanceOf(zeroVault.address);

      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(childBalAfterRevoke - childBalAfter).to.eq(0);
      expect(contractBalAfterRevoke - contractBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter).to.eq(0);
    });

    it("CurvePricer + StakePayment with price = 0 - should NOT perform any transfers", async () => {
      const priceConfig = {
        ...DEFAULT_CURVE_PRICE_CONFIG,
        maxPrice: BigInt(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        tokenOwner: lvl2SubOwner.address,
        parentHash: domain.hash,
        domainLabel: "zeropriceas",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            priceConfig: encodePriceConfig(priceConfig),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });

      const contractBalBefore = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const parentBalBefore = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.meowToken.balanceOf(zeroVault.address);

      const label = "zeropricechildas";
      const childHash = await registrationWithSetup({
        zns,
        tokenOwner: lvl3SubOwner.address,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
      });

      const parentBalAfter = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfter = await zns.meowToken.balanceOf(zeroVault.address);

      expect(parentBalAfter - parentBalBefore).to.eq(0);
      expect(childBalBefore - childBalAfter).to.eq(0);
      expect(contractBalAfter - contractBalBefore).to.eq(0);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(0);

      // validate transfer events are not happenning
      const latestBlock = await time.latestBlock();
      const transferFilterToParent = zns.meowToken.filters.Transfer(lvl3SubOwner.address, lvl2SubOwner.address);
      const transferFilterToTreasury = zns.meowToken.filters.Transfer(
        lvl3SubOwner.address,
        await zns.treasury.getAddress()
      );
      const transfersToParent = await zns.meowToken.queryFilter(
        transferFilterToParent,
        latestBlock - 3,
        latestBlock
      );
      const transfersToTreasury = await zns.meowToken.queryFilter(
        transferFilterToTreasury,
        latestBlock - 3,
        latestBlock
      );
      expect(transfersToParent.length).to.eq(0);
      expect(transfersToTreasury.length).to.eq(0);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        childHash,
      );

      // should NOT offer refund !
      const parentBalAfterRevoke = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfterRevoke = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfterRevoke = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfterRevoke = await zns.meowToken.balanceOf(zeroVault.address);

      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(childBalAfterRevoke - childBalAfter).to.eq(0);
      expect(contractBalAfterRevoke - contractBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter).to.eq(0);
    });

    it("FixedPricer + StakePayment with price = 0 - should NOT perform any transfers", async () => {
      const priceConfig = {
        price: BigInt(0),
        // we are trying to set a feePercentage, but that should still result to 0 fee
        // since fee is based on price
        feePercentage: BigInt(5),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        tokenOwner: lvl2SubOwner.address,
        parentHash: domain.hash,
        domainLabel: "zeropricefs",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: encodePriceConfig(priceConfig),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });

      const contractBalBefore = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const parentBalBefore = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.meowToken.balanceOf(zeroVault.address);

      const label = "zeropricechildfs";
      const childHash = await registrationWithSetup({
        zns,
        tokenOwner: lvl3SubOwner.address,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
      });

      const parentBalAfter = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfter = await zns.meowToken.balanceOf(zeroVault.address);

      expect(parentBalAfter - parentBalBefore).to.eq(0);
      expect(childBalBefore - childBalAfter).to.eq(0);
      expect(contractBalAfter - contractBalBefore).to.eq(0);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(0);

      // validate transfer events are not happenning
      const latestBlock = await time.latestBlock();
      const transferFilterToParent = zns.meowToken.filters.Transfer(lvl3SubOwner.address, lvl2SubOwner.address);
      const transferFilterToTreasury = zns.meowToken.filters.Transfer(
        lvl3SubOwner.address,
        await zns.treasury.getAddress()
      );
      const transfersToParent = await zns.meowToken.queryFilter(
        transferFilterToParent,
        latestBlock - 3,
        latestBlock
      );
      const transfersToTreasury = await zns.meowToken.queryFilter(
        transferFilterToTreasury,
        latestBlock - 3,
        latestBlock
      );
      expect(transfersToParent.length).to.eq(0);
      expect(transfersToTreasury.length).to.eq(0);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        childHash,
      );

      // should NOT offer refund !
      const parentBalAfterRevoke = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfterRevoke = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfterRevoke = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfterRevoke = await zns.meowToken.balanceOf(zeroVault.address);

      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(childBalAfterRevoke - childBalAfter).to.eq(0);
      expect(contractBalAfterRevoke - contractBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter).to.eq(0);
    });

    it("Setting price config in incorrect decimals triggers incorrect pricing", async () => {
      // we will use token with 5 decimals, but set prices in 18 decimals
      const priceConfigIncorrect : ICurvePriceConfig = {
        maxPrice: ethers.parseUnits("234.46", decimalValues.eighteen),
        curveMultiplier: BigInt(1000),
        maxLength: BigInt(20),
        baseLength: BigInt(2),
        precisionMultiplier: BigInt(1),
        feePercentage: BigInt(111),
      };

      // see `token` in paymentConfig
      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        tokenOwner: lvl2SubOwner.address,
        parentHash: domain.hash,
        domainLabel: "incorrectparent",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            priceConfig: encodePriceConfig(priceConfigIncorrect),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            // ! this token has 5 decimals !
            token: await token5.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });

      const label = "incorrectchild";

      const priceConfigCorrect = {
        ...priceConfigIncorrect,
        maxPrice: ethers.parseUnits("234.46", decimalValues.five),
      };

      // For protocol fee calculations
      const rootPriceConfig = await zns.rootRegistrar.rootPriceConfig();

      // calc prices off-chain
      const {
        expectedPrice: priceIncorrect,
        stakeFee: stakeFeeIncorrect,
      } = getPriceObject(label, priceConfigIncorrect);
      const protocolFeeIncorrect = getStakingOrProtocolFee(
        priceIncorrect + stakeFeeIncorrect,
        decodePriceConfig(rootPriceConfig).feePercentage
      );

      const {
        expectedPrice: priceCorrect,
        stakeFee: stakeFeeCorrect,
      } = getPriceObject(label, priceConfigCorrect);
      const protocolFeeCorrect = getStakingOrProtocolFee(
        priceCorrect + stakeFeeCorrect,
        decodePriceConfig(rootPriceConfig).feePercentage
      );

      const distrConfig = await zns.subRegistrar.distrConfigs(subdomainParentHash);

      expect(distrConfig.priceConfig).to.eq(encodePriceConfig(priceConfigIncorrect));

      const {
        price: priceFromSC,
        stakeFee: feeFromSC,
      } = await zns.curvePricer.getPriceAndFee(
        distrConfig.priceConfig,
        label,
        true
      );

      const protocolFeeFromSC = await zns.curvePricer.getFeeForPrice(
        rootPriceConfig,
        priceFromSC + feeFromSC
      );

      expect(priceFromSC).to.not.eq(priceCorrect);
      expect(priceFromSC).to.eq(priceIncorrect);
      expect(feeFromSC).to.not.eq(stakeFeeCorrect);
      expect(feeFromSC).to.eq(stakeFeeIncorrect);
      expect(protocolFeeFromSC).to.not.eq(protocolFeeCorrect);
      expect(protocolFeeFromSC).to.eq(protocolFeeIncorrect);

      const priceDiff = priceIncorrect - priceCorrect;
      // the difference should be very large
      expect(priceDiff).to.be.gt(
        BigInt(10) ** decimalValues.eighteen
      );

      // we sending him 10^20 tokens
      await token5.connect(deployer).transfer(
        lvl3SubOwner.address,
        ethers.parseUnits("10000000000000000000", decimalValues.five)
      );

      // client tx approving the correct price will fail registration
      await token5.connect(lvl3SubOwner).approve(
        await zns.treasury.getAddress(),
        priceCorrect + stakeFeeCorrect + protocolFeeCorrect
      );

      await expect(
        zns.subRegistrar.registerSubdomain({
          parentHash: subdomainParentHash,
          label,
          domainAddress: lvl3SubOwner.address,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: distrConfigEmpty,
          paymentConfig: paymentConfigEmpty,
        })
      ).to.be.revertedWithCustomError(
        zns.meowToken,
        INSUFFICIENT_ALLOWANCE_ERC_ERR
      );

      // let's try to buy with the incorrect price
      const userBalanceBefore = await token5.balanceOf(lvl3SubOwner.address);

      await registrationWithSetup({
        zns,
        tokenOwner: lvl3SubOwner.address,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
      });

      const userBalanceAfter = await token5.balanceOf(lvl3SubOwner.address);

      // user should have paid the incorrect price
      expect(userBalanceBefore - userBalanceAfter).to.eq(
        priceIncorrect + stakeFeeIncorrect + protocolFeeIncorrect
      );
    });
  });

  describe("Registration access", () => {
    let domainConfigs : Array<IDomainConfigForTest>;
    let regResults : Array<IPathRegResult>;
    let fixedPrice : bigint;
    let fixedFeePercentage : bigint;

    let configBytes : string;

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
      ] = await hre.ethers.getSigners();
      // zeroVault address is used to hold the fee charged to the user when registering
      zns = await deployZNS({
        deployer,
        governorAddresses: [deployer.address, governor.address],
        adminAddresses: [admin.address],
        zeroVaultAddress: zeroVault.address,
      });

      fixedPrice = ethers.parseEther("397");
      fixedFeePercentage = BigInt(200);

      configBytes = encodePriceConfig({ price: fixedPrice, feePercentage: fixedFeePercentage });

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
              priceConfig: configBytes,
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
          domainLabel: "levelone",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              priceConfig: configBytes,
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: lvl2SubOwner.address,
            },
          },
        },
      ];

      regResults = await registerDomainPath({
        zns,
        domainConfigs,
        zeroVaultAddress: zeroVault.address,
      });
    });

    it("should allow parent owner to register a subdomain under himself even if accessType is LOCKED", async () => {
      await zns.subRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.LOCKED,
      );

      const balBefore = await zns.meowToken.balanceOf(lvl2SubOwner.address);

      const hash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        tokenOwner: lvl2SubOwner.address,
        parentHash: regResults[1].domainHash,
        domainLabel: "ownercheck",
      });

      const latestBlock = await time.latestBlock();
      // look for an event where user pays himself
      const filter = zns.meowToken.filters.Transfer(lvl2SubOwner.address, lvl2SubOwner.address);
      const events = await zns.meowToken.queryFilter(
        filter,
        latestBlock - 50,
        latestBlock
      );
      // this means NO transfers have been executed, which is what we need
      expect(events.length).to.eq(0);

      const balAfter = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      // the diff is 0 because user should not pay himself
      expect(balAfter - balBefore).to.eq(0);

      // check registry
      const dataFromReg = await zns.registry.getDomainRecord(hash);
      expect(dataFromReg.owner).to.eq(lvl2SubOwner.address);
      expect(dataFromReg.resolver).to.eq(await zns.addressResolver.getAddress());

      // check domain token
      const tokenId = BigInt(hash).toString();
      const tokenOwner = await zns.domainToken.ownerOf(tokenId);
      expect(tokenOwner).to.eq(lvl2SubOwner.address);

      // revert back to OPEN
      await zns.subRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.OPEN,
      );
    });

    it("should allow parent owner's operator to register but assign subdomain hash to the owner", async () => {
      await zns.subRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.LOCKED,
      );

      await zns.registry.connect(lvl2SubOwner).setOwnersOperator(operator.address, true);

      const balBefore = await zns.meowToken.balanceOf(operator.address);

      await defaultSubdomainRegistration({
        zns,
        user: operator,
        parentHash: regResults[1].domainHash,
        subdomainLabel: "opcheck",
      });

      // operator call should assign subdomain to actual owner of parent - lvl2SubOwner
      const hash = await getDomainHashFromEvent({
        zns,
        user: lvl2SubOwner,
      });

      const latestBlock = await time.latestBlock();
      // look for an event where user pays himself
      const filter = zns.meowToken.filters.Transfer(operator.address, operator.address);
      const events = await zns.meowToken.queryFilter(
        filter,
        latestBlock - 50,
        latestBlock
      );
      // this means NO transfers have been executed, which is what we need
      expect(events.length).to.eq(0);

      const balAfter = await zns.meowToken.balanceOf(operator.address);
      // the diff is 0 because user should not pay himself
      expect(balAfter - balBefore).to.eq(0);

      // check registry that owner of sub is set to owner of parent instead of operator
      const dataFromReg = await zns.registry.getDomainRecord(hash);
      expect(dataFromReg.owner).to.eq(lvl2SubOwner.address);
      expect(dataFromReg.resolver).to.eq(await zns.addressResolver.getAddress());

      // check domain token
      const tokenId = BigInt(hash).toString();
      const tokenOwner = await zns.domainToken.ownerOf(tokenId);
      expect(tokenOwner).to.eq(lvl2SubOwner.address);

      // revert back to OPEN
      await zns.subRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.OPEN,
      );
    });

    it("should NOT allow others to register a domain when parent's accessType is LOCKED", async () => {
      // register parent with locked access
      const res = await registerDomainPath({
        zns,
        domainConfigs: [
          {
            user: lvl3SubOwner,
            tokenOwner: lvl3SubOwner.address,
            domainLabel: "leveltwo",
            parentHash: regResults[1].domainHash,
            // when we do not specify accessType or config, it defaults to LOCKED
            // we can also set it as 0 specifically if setting a config
            fullConfig: FULL_DISTR_CONFIG_EMPTY,
          },
        ],
        zeroVaultAddress: zeroVault.address,
      });

      // try to register child
      await expect(
        zns.subRegistrar.connect(lvl5SubOwner).registerSubdomain({
          parentHash: res[0].domainHash,
          label: "tobedenied",
          domainAddress: ethers.ZeroAddress,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: distrConfigEmpty,
          paymentConfig: paymentConfigEmpty,
        })
      ).to.be.revertedWithCustomError(
        zns.subRegistrar,
        DISTRIBUTION_LOCKED_NOT_EXIST_ERR
      );
    });

    it("should allow anyone to register a domain when parent's accessType is OPEN", async () => {
      const { domainHash: parentHash } = regResults[1];
      const domainLabel = "alloweded";

      const {
        expectedPrice,
      } = getPriceObject(
        domainLabel,
        decodePriceConfig(domainConfigs[1].fullConfig.distrConfig.priceConfig)
      );

      const protocolFee = getStakingOrProtocolFee(expectedPrice);
      // approve direct payment
      await zns.meowToken.connect(lvl5SubOwner).approve(
        await zns.treasury.getAddress(),
        expectedPrice + protocolFee
      );

      await defaultSubdomainRegistration({
        user: lvl5SubOwner,
        zns,
        parentHash,
        subdomainLabel: domainLabel,
      });

      const hash = await getDomainHashFromEvent({
        zns,
        user: lvl5SubOwner,
      });

      // check registry
      const dataFromReg = await zns.registry.getDomainRecord(hash);
      expect(dataFromReg.owner).to.eq(lvl5SubOwner.address);
      expect(dataFromReg.resolver).to.eq(zns.addressResolver.target);

      // check domain token
      const tokenId = BigInt(hash).toString();
      const tokenOwner = await zns.domainToken.ownerOf(tokenId);
      expect(tokenOwner).to.eq(lvl5SubOwner.address);
    });

    // eslint-disable-next-line max-len
    it("should ONLY allow mintlisted addresses and NOT allow other ones to register a domain when parent's accessType is MINTLIST", async () => {
      // approve direct payment
      await zns.meowToken.connect(lvl3SubOwner).approve(await zns.treasury.getAddress(), fixedPrice);
      // register parent with mintlisted access
      const parentHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        tokenOwner: lvl3SubOwner.address,
        parentHash: regResults[1].domainHash,
        domainLabel: "mintlistparent",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: encodePriceConfig({
              price: fixedPrice,
              feePercentage: fixedFeePercentage,
            }),
            paymentType: PaymentType.DIRECT,
            accessType: AccessType.MINTLIST,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl3SubOwner.address,
          },
        },
      });

      // mintlist potential child user
      await zns.subRegistrar.connect(lvl3SubOwner).updateMintlistForDomain(
        parentHash,
        [lvl4SubOwner.address],
        [true],
      );

      // register child
      const hash = await registrationWithSetup({
        zns,
        user: lvl4SubOwner,
        tokenOwner: lvl4SubOwner.address,
        parentHash,
        domainLabel: "mintlisted",
      });

      // check registry
      const dataFromReg = await zns.registry.getDomainRecord(hash);
      expect(dataFromReg.owner).to.eq(lvl4SubOwner.address);
      expect(dataFromReg.resolver).to.eq(await zns.addressResolver.getAddress());

      // check domain token
      const tokenId = BigInt(hash).toString();
      const tokenOwner = await zns.domainToken.ownerOf(tokenId);
      expect(tokenOwner).to.eq(lvl4SubOwner.address);

      // try to register child with non-mintlisted user
      await expect(
        zns.subRegistrar.connect(lvl5SubOwner).registerSubdomain({
          parentHash,
          label: "notmintlisted",
          domainAddress: ethers.ZeroAddress,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: distrConfigEmpty,
          paymentConfig: paymentConfigEmpty,
        })
      ).to.be.revertedWithCustomError(
        zns.subRegistrar,
        SENDER_NOT_APPROVED_ERR
      );

      // remove user from mintlist
      await zns.subRegistrar.connect(lvl3SubOwner).updateMintlistForDomain(
        parentHash,
        [lvl4SubOwner.address],
        [false],
      );

      // try to register again
      await expect(
        zns.subRegistrar.connect(lvl4SubOwner).registerSubdomain({
          parentHash,
          label: "notmintlisted",
          domainAddress: ethers.ZeroAddress,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: distrConfigEmpty,
          paymentConfig: paymentConfigEmpty,
        })
      ).to.be.revertedWithCustomError(
        zns.subRegistrar,
        SENDER_NOT_APPROVED_ERR
      );
    });

    // eslint-disable-next-line max-len
    it("#updateMintlistForDomain() should NOT allow setting if called by non-authorized account or registrar", async () => {
      const { domainHash } = regResults[1];

      // assign operator in registry
      // to see that he CAN do it
      await zns.registry.connect(lvl2SubOwner).setOwnersOperator(
        operator.address,
        true,
      );

      // try with operator
      await zns.subRegistrar.connect(operator).updateMintlistForDomain(
        domainHash,
        [lvl5SubOwner.address],
        [true],
      );

      const mintlisted = await zns.subRegistrar.isMintlistedForDomain(
        domainHash,
        lvl5SubOwner.address
      );
      assert.ok(mintlisted, "User did NOT get mintlisted, but should've");

      // try with non-authorized
      await expect(
        zns.subRegistrar.connect(lvl5SubOwner).updateMintlistForDomain(domainHash, [lvl5SubOwner.address], [true])
      ).to.be.revertedWithCustomError(
        zns.subRegistrar,
        NOT_AUTHORIZED_ERR
      );
    });

    it("#updateMintlistForDomain() should fire a #MintlistUpdated event with correct params", async () => {
      const { domainHash } = regResults[1];

      const candidatesArr = [
        lvl5SubOwner.address,
        lvl6SubOwner.address,
        lvl3SubOwner.address,
        lvl4SubOwner.address,
      ];

      const allowedArr = [
        true,
        true,
        false,
        true,
      ];

      await zns.subRegistrar.connect(lvl2SubOwner).updateMintlistForDomain(
        domainHash,
        candidatesArr,
        allowedArr
      );

      const latestBlock = await time.latestBlock();
      const filter = zns.subRegistrar.filters.MintlistUpdated(domainHash);
      const events = await zns.subRegistrar.queryFilter(
        filter,
        latestBlock - 3,
        latestBlock
      );
      const event = events[events.length - 1];

      const ownerIndex = await zns.subRegistrar.mintlist(domainHash);

      expect(event.args?.domainHash).to.eq(domainHash);
      expect(event.args?.ownerIndex).to.eq(ownerIndex);
      expect(event.args?.candidates).to.deep.eq(candidatesArr);
      expect(event.args?.allowed).to.deep.eq(allowedArr);
    });

    it("should switch accessType for existing parent domain", async () => {
      await zns.subRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.LOCKED
      );

      await expect(
        zns.subRegistrar.connect(lvl5SubOwner).registerSubdomain({
          parentHash: regResults[1].domainHash,
          label: "notallowed",
          domainAddress: ethers.ZeroAddress,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: distrConfigEmpty,
          paymentConfig: paymentConfigEmpty,
        })
      ).to.be.revertedWithCustomError(
        zns.subRegistrar,
        DISTRIBUTION_LOCKED_NOT_EXIST_ERR
      );

      // switch to mintlist
      await zns.subRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.MINTLIST
      );

      // add to mintlist
      await zns.subRegistrar.connect(lvl2SubOwner).updateMintlistForDomain(
        regResults[1].domainHash,
        [lvl5SubOwner.address],
        [true],
      );

      const label = "alloweddddd";

      // approve
      const {
        expectedPrice,
        stakeFee,
      } = getPriceObject(
        label,
        decodePriceConfig(domainConfigs[1].fullConfig.distrConfig.priceConfig)
      );

      const paymentToParent = domainConfigs[1].fullConfig.distrConfig.paymentType === PaymentType.STAKE
        ? expectedPrice + stakeFee
        : expectedPrice;

      const protocolFee = getStakingOrProtocolFee(paymentToParent);
      await zns.meowToken.connect(lvl5SubOwner).approve(
        await zns.treasury.getAddress(),
        paymentToParent + protocolFee
      );

      // register
      await defaultSubdomainRegistration({
        zns,
        user: lvl5SubOwner,
        parentHash: regResults[1].domainHash,
        subdomainLabel: "alloweddddd",
      });

      const hash = await getDomainHashFromEvent({
        zns,
        user: lvl5SubOwner,
      });

      // check registry
      const dataFromReg = await zns.registry.getDomainRecord(hash);
      expect(dataFromReg.owner).to.eq(lvl5SubOwner.address);

      // switch back to open
      await zns.subRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.OPEN
      );
    });

    // eslint-disable-next-line max-len
    it("should NOT allow to register subdomains under the parent that hasn't set up his distribution config", async () => {
      const parentHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        tokenOwner: lvl3SubOwner.address,
        parentHash: regResults[1].domainHash,
        domainLabel: "parentnoconfig",
        fullConfig: FULL_DISTR_CONFIG_EMPTY, // accessType is 0 when supplying empty config
      });

      await expect(
        zns.subRegistrar.connect(lvl4SubOwner).registerSubdomain({
          parentHash,
          label: "notallowed",
          domainAddress: ethers.ZeroAddress,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: distrConfigEmpty,
          paymentConfig: paymentConfigEmpty,
        })
      ).to.be.revertedWithCustomError(
        zns.subRegistrar,
        DISTRIBUTION_LOCKED_NOT_EXIST_ERR
      );
    });
  });

  describe("Existing subdomain ops", () => {
    let domainConfigs : Array<IDomainConfigForTest>;
    let regResults : Array<IPathRegResult>;
    let fixedFeePercentage : bigint;
    let fixedPrice : bigint;

    let priceConfigBytes : string;

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
      ] = await hre.ethers.getSigners();
      // zeroVault address is used to hold the fee charged to the user when registering
      zns = await deployZNS({
        deployer,
        governorAddresses: [deployer.address, governor.address],
        adminAddresses: [admin.address],
        zeroVaultAddress: zeroVault.address,
      });

      fixedPrice = ethers.parseEther("397");
      fixedFeePercentage = BigInt(200);

      priceConfigBytes = encodePriceConfig({ price: fixedPrice, feePercentage: fixedFeePercentage });

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
          tokenOwner: rootOwner.address,
          domainLabel: "root",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              priceConfig: encodePriceConfig({ price: fixedPrice, feePercentage: fixedFeePercentage }),
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
          tokenOwner: lvl2SubOwner.address,
          domainLabel: "leveltwo",
          tokenURI: "http://example.com/leveltwo",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              priceConfig: priceConfigBytes,
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
          tokenOwner: lvl3SubOwner.address,
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
        zeroVaultAddress: zeroVault.address,
      });
    });

    it("should NOT allow to register an existing subdomain that has not been revoked", async () => {
      await expect(
        defaultSubdomainRegistration({
          zns,
          user: lvl2SubOwner,
          parentHash: regResults[0].domainHash,
          subdomainLabel: domainConfigs[1].domainLabel,
          tokenOwner: ethers.ZeroAddress,
          domainContent: lvl2SubOwner.address,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: domainConfigs[1].fullConfig.distrConfig,
          paymentConfig: paymentConfigEmpty,
        })
      ).to.be.revertedWithCustomError(
        zns.rootRegistrar,
        DOMAIN_EXISTS_ERR
      );
    });

    it("should NOT allow revoking when the caller is NOT an owner of hash in Registry", async () => {
      // change owner of the domain
      await zns.registry.connect(lvl2SubOwner).updateDomainOwner(
        regResults[1].domainHash,
        rootOwner.address
      );

      // fail
      await expect(
        zns.rootRegistrar.connect(lvl2SubOwner).revokeDomain(regResults[1].domainHash)
      ).to.be.revertedWithCustomError(
        zns.rootRegistrar,
        NOT_AUTHORIZED_ERR,
      ).withArgs(lvl2SubOwner.address, regResults[1].domainHash);

      // change owner back
      await zns.registry.connect(rootOwner).updateDomainOwner(
        regResults[1].domainHash,
        lvl2SubOwner.address
      );
    });

    it("should allow to UPDATE domain data for subdomain", async () => {
      const dataFromReg = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromReg.owner).to.eq(lvl2SubOwner.address);
      expect(dataFromReg.resolver).to.eq(await zns.addressResolver.getAddress());

      await zns.registry.connect(lvl2SubOwner).updateDomainRecord(
        regResults[1].domainHash,
        lvl3SubOwner.address,
        ethers.ZeroAddress,
      );

      const dataFromRegAfter = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromRegAfter.owner).to.eq(lvl3SubOwner.address);
      expect(dataFromRegAfter.resolver).to.eq(ethers.ZeroAddress);

      // reclaim to switch ownership back to original owner
      await zns.rootRegistrar.connect(lvl3SubOwner).assignDomainToken(
        regResults[1].domainHash,
        lvl3SubOwner.address,
      );

      const dataFromRegAfterReclaim = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromRegAfterReclaim.owner).to.eq(lvl3SubOwner.address);
      expect(dataFromRegAfterReclaim.resolver).to.eq(ethers.ZeroAddress);

      // move domain and token back to original owner
      await zns.registry.connect(lvl3SubOwner).updateDomainOwner(
        regResults[1].domainHash,
        lvl2SubOwner.address
      );
      await zns.rootRegistrar.connect(lvl2SubOwner).assignDomainToken(
        regResults[1].domainHash,
        lvl2SubOwner.address,
      );
    });

    describe("#setDistributionConfigForDomain()", () => {
      it("should re-set distribution config for an existing subdomain", async () => {
        const domainHash = regResults[2].domainHash;

        const distrConfigBefore = await zns.subRegistrar.distrConfigs(domainHash);
        expect(distrConfigBefore.accessType).to.not.eq(AccessType.MINTLIST);
        expect(distrConfigBefore.pricerContract).to.not.eq(await zns.fixedPricer.getAddress());
        expect(
          distrConfigBefore.paymentType
        ).to.not.eq(
          PaymentType.STAKE
        );

        const newConfig = {
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

      it("should NOT allow to set distribution config for a non-authorized account", async () => {
        const domainHash = regResults[1].domainHash;

        const newConfig = {
          pricerContract: await zns.curvePricer.getAddress(),
          priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
          paymentType: PaymentType.STAKE,
          accessType: AccessType.MINTLIST,
        };

        await expect(
          zns.subRegistrar.connect(deployer).setDistributionConfigForDomain(
            domainHash,
            newConfig
          )
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          NOT_AUTHORIZED_ERR
        );
      });

      it("should revert if pricerContract is passed as 0x0 address", async () => {
        const domainHash = regResults[2].domainHash;

        const newConfig = {
          pricerContract: ethers.ZeroAddress,
          priceConfig: DEFAULT_FIXED_PRICER_CONFIG_BYTES,
          paymentType: PaymentType.STAKE,
          accessType: AccessType.MINTLIST,
        };

        await expect(
          zns.subRegistrar.connect(lvl3SubOwner).setDistributionConfigForDomain(
            domainHash,
            newConfig
          )
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          ZERO_ADDRESS_ERR
        );
      });
    });

    describe("#setPricerDataForDomain()", () => {
      it("should re-set pricer contract for an existing subdomain", async () => {
        const domainHash = regResults[2].domainHash;

        const pricerContractBefore = await zns.subRegistrar.distrConfigs(domainHash);
        expect(pricerContractBefore.pricerContract).to.eq(domainConfigs[2].fullConfig.distrConfig.pricerContract);

        await zns.subRegistrar.connect(lvl3SubOwner).setPricerDataForDomain(
          domainHash,
          DEFAULT_CURVE_PRICE_CONFIG_BYTES,
          await zns.curvePricer.getAddress(),
        );

        const pricerContractAfter = await zns.subRegistrar.distrConfigs(domainHash);
        expect(pricerContractAfter.pricerContract).to.eq(await zns.curvePricer.getAddress());

        // reset it back
        await zns.subRegistrar.connect(lvl3SubOwner).setPricerDataForDomain(
          domainHash,
          domainConfigs[2].fullConfig.distrConfig.priceConfig,
          domainConfigs[2].fullConfig.distrConfig.pricerContract,
        );
      });

      it("should NOT allow setting for non-authorized account", async () => {
        const domainHash = regResults[2].domainHash;

        await expect(
          zns.subRegistrar.connect(lvl2SubOwner).setPricerDataForDomain(
            domainHash,
            DEFAULT_CURVE_PRICE_CONFIG_BYTES,
            await zns.curvePricer.getAddress()
          )
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          NOT_AUTHORIZED_ERR
        );
      });

      it("should NOT set pricerContract to 0x0 address", async () => {
        const domainHash = regResults[2].domainHash;

        await expect(
          zns.subRegistrar.connect(lvl3SubOwner).setPricerDataForDomain(
            domainHash,
            DEFAULT_FIXED_PRICER_CONFIG_BYTES,
            ethers.ZeroAddress
          )
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          ZERO_ADDRESS_ERR
        );
      });
    });

    describe("#setPaymentTypeForDomain()", () => {
      it("should re-set payment type for an existing subdomain", async () => {
        const domainHash = regResults[2].domainHash;

        const { paymentType: paymentTypeBefore } = await zns.subRegistrar.distrConfigs(domainHash);
        expect(paymentTypeBefore).to.eq(domainConfigs[2].fullConfig.distrConfig.paymentType);

        await zns.subRegistrar.connect(lvl3SubOwner).setPaymentTypeForDomain(
          domainHash,
          PaymentType.STAKE,
        );

        const { paymentType: paymentTypeAfter } = await zns.subRegistrar.distrConfigs(domainHash);
        expect(paymentTypeAfter).to.eq(PaymentType.STAKE);

        // reset it back
        await zns.subRegistrar.connect(lvl3SubOwner).setPaymentTypeForDomain(
          domainHash,
          domainConfigs[2].fullConfig.distrConfig.paymentType,
        );
      });

      it("should NOT allow setting for non-authorized account", async () => {
        const domainHash = regResults[2].domainHash;

        await expect(
          zns.subRegistrar.connect(lvl2SubOwner).setPaymentTypeForDomain(domainHash, PaymentType.STAKE)
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          NOT_AUTHORIZED_ERR
        );
      });

      it("should emit #PaymentTypeSet event with correct params", async () => {
        const domainHash = regResults[2].domainHash;

        await expect(
          zns.subRegistrar.connect(lvl3SubOwner).setPaymentTypeForDomain(
            domainHash,
            PaymentType.STAKE,
          )
        ).to.emit(zns.subRegistrar, "PaymentTypeSet").withArgs(
          domainHash,
          PaymentType.STAKE,
        );

        // reset back
        await zns.subRegistrar.connect(lvl3SubOwner).setPaymentTypeForDomain(
          domainHash,
          domainConfigs[2].fullConfig.distrConfig.paymentType,
        );
      });
    });

    // eslint-disable-next-line max-len
    it("should TRANSFER ownership of a subdomain and let the receiver revoke with REFUND", async () => {
      const { amount: stakedBefore } = await zns.treasury.stakedForDomain(regResults[1].domainHash);

      await zns.registry.connect(lvl2SubOwner).updateDomainOwner(
        regResults[1].domainHash,
        lvl3SubOwner.address,
      );

      // Verify owner in registry
      const dataFromReg = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromReg.owner).to.eq(lvl3SubOwner.address);

      // Verify domain token is still owned
      const tokenOwner = await zns.domainToken.ownerOf(regResults[1].domainHash);
      expect(tokenOwner).to.eq(lvl2SubOwner.address);
      // verify stake still existing
      const { amount: stakedAfter } = await zns.treasury.stakedForDomain(regResults[1].domainHash);
      expect(stakedAfter).to.eq(stakedBefore);

      const userBalbefore = await zns.meowToken.balanceOf(lvl3SubOwner.address);

      const protocolFee = getStakingOrProtocolFee(stakedAfter);

      await zns.meowToken.connect(lvl3SubOwner).approve(await zns.treasury.getAddress(), protocolFee);
      // try revoking
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        regResults[1].domainHash,
      );

      // verify that refund has been acquired by the new owner
      const userBalAfter = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      expect(userBalAfter - userBalbefore).to.eq(fixedPrice - protocolFee);
    });
  });

  describe("State setters", () => {
    before(async () => {
      [
        deployer,
        admin,
        random,
      ] = await hre.ethers.getSigners();

      zns = await deployZNS({
        deployer,
        governorAddresses: [deployer.address],
        adminAddresses: [admin.address],
      });
    });

    it("Should NOT let initialize the implementation contract", async () => {
      const factory = new ZNSSubRegistrar__factory(deployer);
      const impl = await getProxyImplAddress(await zns.subRegistrar.getAddress());
      const implContract = factory.attach(impl) as ZNSSubRegistrar;

      await expect(
        implContract.initialize(
          deployer.address,
          deployer.address,
          deployer.address,
        )
      ).to.be.revertedWithCustomError(implContract, INITIALIZED_ERR);
    });

    it("#setRootRegistrar() should set the new root registrar correctly and emit #RootRegistrarSet event", async () => {
      const tx = await zns.subRegistrar.connect(admin).setRootRegistrar(random.address);

      await expect(tx).to.emit(zns.subRegistrar, "RootRegistrarSet").withArgs(random.address);

      expect(await zns.subRegistrar.rootRegistrar()).to.equal(random.address);
    });

    it("#setRootRegistrar() should NOT be callable by anyone other than ADMIN_ROLE", async () => {
      await expect(zns.subRegistrar.connect(random).setRootRegistrar(random.address))
        .to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(random.address, ADMIN_ROLE);
    });

    it("#setRootRegistrar should NOT set registrar as 0x0 address", async () => {
      await expect(
        zns.subRegistrar.connect(admin).setRootRegistrar(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(
        zns.subRegistrar,
        ZERO_ADDRESS_ERR
      );
    });

    it("#setRegistry() should set the new registry correctly and emit #RegistrySet event", async () => {
      const tx = await zns.subRegistrar.connect(admin).setRegistry(random.address);

      await expect(tx).to.emit(zns.subRegistrar, "RegistrySet").withArgs(random.address);

      expect(await zns.subRegistrar.registry()).to.equal(random.address);
    });

    it("#setRegistry() should not be callable by anyone other than ADMIN_ROLE", async () => {
      await expect(zns.subRegistrar.connect(random).setRegistry(random.address))
        .to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(random.address, ADMIN_ROLE);
    });

    it("#pauseRegistration() should pause the registration process and emit #RegistrationPauseSet event", async () => {
      const tx = await zns.subRegistrar.connect(admin).pauseRegistration();

      await expect(tx).to.emit(zns.subRegistrar, "RegistrationPauseSet").withArgs(true);

      expect(await zns.subRegistrar.registrationPaused()).to.equal(true);
    });

    it("#pauseRegistration() should not be callable by anyone other than ADMIN_ROLE", async () => {
      await expect(zns.subRegistrar.connect(random).pauseRegistration())
        .to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(random.address, ADMIN_ROLE);
    });

    it("#pauseRegistration() should not allow to pause if already paused", async () => {
      await expect(zns.subRegistrar.connect(admin).pauseRegistration())
        .to.be.revertedWithCustomError(zns.subRegistrar, PAUSE_SAME_VALUE_ERR);
    });

    // eslint-disable-next-line max-len
    it("#unpauseRegistration() should unpause the registration process and emit #RegistrationPauseSet event", async () => {
      const tx = await zns.subRegistrar.connect(admin).unpauseRegistration();

      await expect(tx).to.emit(zns.subRegistrar, "RegistrationPauseSet").withArgs(false);

      expect(await zns.subRegistrar.registrationPaused()).to.equal(false);
    });

    it("#unpauseRegistration() should not be callable by anyone other than ADMIN_ROLE", async () => {
      await expect(zns.subRegistrar.connect(random).unpauseRegistration())
        .to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(random.address, ADMIN_ROLE);
    });

    it("#unpauseRegistration() should not allow to unpause if already unpaused", async () => {
      await expect(zns.subRegistrar.connect(admin).unpauseRegistration())
        .to.be.revertedWithCustomError(zns.subRegistrar, PAUSE_SAME_VALUE_ERR);
    });

    describe("#setAccessController", () => {
      it("should allow ADMIN to set a valid AccessController", async () => {
        await zns.subRegistrar.connect(deployer).setAccessController(zns.accessController.target);

        const currentAccessController = await zns.subRegistrar.getAccessController();

        expect(currentAccessController).to.equal(zns.accessController.target);
      });

      it("should allow re-setting the AccessController to another valid contract", async () => {
        expect(
          await zns.subRegistrar.getAccessController()
        ).to.equal(
          zns.accessController.target
        );

        const ZNSAccessControllerFactory = await ethers.getContractFactory("ZNSAccessController", deployer);
        const newAccessController = await ZNSAccessControllerFactory.deploy(
          [deployer.address],
          [deployer.address]
        );

        // then change the AccessController
        await zns.subRegistrar.connect(deployer).setAccessController(newAccessController.target);

        expect(
          await zns.subRegistrar.getAccessController()
        ).to.equal(
          newAccessController.target
        );
      });

      it("should emit AccessControllerSet event when setting a valid AccessController", async () => {
        await expect(
          zns.subRegistrar.connect(deployer).setAccessController(zns.accessController.target)
        ).to.emit(
          zns.subRegistrar,
          "AccessControllerSet"
        ).withArgs(zns.accessController.target);
      });

      it("should revert when a non-ADMIN tries to set AccessController", async () => {
        await expect(
          zns.subRegistrar.connect(lvl2SubOwner).setAccessController(zns.accessController.target)
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          AC_UNAUTHORIZED_ERR
        ).withArgs(lvl2SubOwner.address, ADMIN_ROLE);
      });

      it("should revert when setting an AccessController as EOA address", async () => {
        await expect(
          zns.subRegistrar.connect(deployer).setAccessController(lvl2SubOwner.address)
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          AC_WRONGADDRESS_ERR
        ).withArgs(lvl2SubOwner.address);
      });

      it("should revert when setting an AccessController as another non-AC contract address", async () => {
        await expect(
          zns.subRegistrar.connect(deployer).setAccessController(zns.subRegistrar.target)
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          AC_WRONGADDRESS_ERR
        ).withArgs(zns.subRegistrar.target);
      });

      it("should revert when setting a zero address as AccessController", async () => {
        await expect(
          zns.subRegistrar.connect(admin).setAccessController(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          AC_WRONGADDRESS_ERR
        ).withArgs(ethers.ZeroAddress);
      });
    });
  });

  describe("UUPS", () => {
    let fixedPrice : bigint;

    let domain : Domain;

    beforeEach(async () => {
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
          zns.meowToken.mint(address, ethers.parseEther("1000000")))
      );
      await zns.meowToken.connect(rootOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      fixedPrice = ethers.parseEther("397.13");
      // register root domain
      domain = new Domain({
        zns,
        domainConfig: {
          owner: rootOwner,
          tokenOwner: rootOwner.address,
          label: "root",
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: encodePriceConfig({
              price: fixedPrice,
              feePercentage: BigInt(0),
            }),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });

      await domain.register();
    });

    it("Allows an authorized user to upgrade the contract", async () => {
      // SubRegistrar to upgrade to
      const factory = new ZNSSubRegistrarUpgradeMock__factory(deployer);
      const newRegistrar = await factory.deploy();
      await newRegistrar.waitForDeployment();

      // Confirm the deployer is a governor, as set in `deployZNS` helper
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const tx = zns.subRegistrar.connect(deployer).upgradeToAndCall(
        await newRegistrar.getAddress(),
        "0x"
      );
      await expect(tx).to.not.be.reverted;

      await expect(
        zns.subRegistrar.connect(deployer).initialize(
          await zns.accessController.getAddress(),
          await zns.registry.getAddress(),
          await zns.rootRegistrar.getAddress(),
        )
      ).to.be.revertedWithCustomError(zns.subRegistrar, INITIALIZED_ERR);
    });

    it("Fails to upgrade if the caller is not authorized", async () => {
      // SubRegistrar to upgrade to
      const factory = new ZNSSubRegistrarUpgradeMock__factory(deployer);
      const newRegistrar = await factory.deploy();
      await newRegistrar.waitForDeployment();

      // Confirm the account is not a governor
      await expect(
        zns.accessController.checkGovernor(lvl2SubOwner.address)
      ).to.be.revertedWithCustomError(
        zns.accessController,
        AC_UNAUTHORIZED_ERR
      ).withArgs(lvl2SubOwner.address, GOVERNOR_ROLE);

      const tx = zns.subRegistrar.connect(lvl2SubOwner).upgradeToAndCall(
        await newRegistrar.getAddress(),
        "0x"
      );

      await expect(tx).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(lvl2SubOwner.address, GOVERNOR_ROLE);
    });

    it("Verifies that variable values are not changed in the upgrade process", async () => {
      // Confirm deployer has the correct role first
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const registrarFactory = new ZNSSubRegistrarUpgradeMock__factory(deployer);
      const registrar = await registrarFactory.deploy();
      await registrar.waitForDeployment();

      const domainLabel = "world";

      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
      await zns.meowToken.mint(lvl2SubOwner.address, ethers.parseEther("1000000"));

      const domainHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        tokenOwner: lvl2SubOwner.address,
        domainLabel,
        parentHash: domain.hash,
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: encodePriceConfig({
              price: fixedPrice,
              feePercentage: BigInt(0),
            }),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });

      await zns.subRegistrar.setRootRegistrar(lvl2SubOwner.address);

      const rootDistrConfig = await zns.subRegistrar.distrConfigs(domain.hash);

      const contractCalls = [
        zns.subRegistrar.getAccessController(),
        zns.subRegistrar.registry(),
        zns.subRegistrar.rootRegistrar(),
        zns.registry.exists(domainHash),
        zns.treasury.stakedForDomain(domainHash),
        zns.domainToken.name(),
        zns.domainToken.symbol(),
        zns.fixedPricer.getPrice(rootDistrConfig.priceConfig, domainLabel, false),
      ];

      await validateUpgrade(deployer, zns.subRegistrar, registrar, registrarFactory, contractCalls);
    });

    it("Allows to add more fields to the existing struct in a mapping", async () => {
      // SubRegistrar to upgrade to
      const factory = new ZNSSubRegistrarUpgradeMock__factory(deployer);
      const newRegistrar = await factory.deploy();
      await newRegistrar.waitForDeployment();

      const tx = zns.subRegistrar.connect(deployer).upgradeToAndCall(
        await newRegistrar.getAddress(),
        "0x"
      );
      await expect(tx).to.not.be.reverted;

      // create new proxy object
      const newRegistrarProxy = factory.attach(await zns.subRegistrar.getAddress()) as ZNSSubRegistrarUpgradeMock;

      // check values in storage
      const rootConfigBefore = await newRegistrarProxy.distrConfigs(domain.hash);
      expect(rootConfigBefore.accessType).to.eq(AccessType.OPEN);
      expect(rootConfigBefore.pricerContract).to.eq(await zns.fixedPricer.getAddress());
      expect(rootConfigBefore.paymentType).to.eq(PaymentType.DIRECT);

      await zns.meowToken.mint(lvl2SubOwner.address, ethers.parseEther("1000000"));
      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), ethers.parseEther("1000000"));

      const subConfigToSet = {
        accessType: AccessType.MINTLIST,
        pricerContract: await zns.curvePricer.getAddress(),
        priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
        paymentType: PaymentType.STAKE,
        newAddress: lvl2SubOwner.address,
        newUint: BigInt(1912171236),
      };

      // register a subdomain with new logic
      await newRegistrarProxy.connect(lvl2SubOwner).registerSubdomain({
        parentHash: domain.hash,
        label: "subbb",
        domainAddress: lvl2SubOwner.address,
        tokenOwner: ethers.ZeroAddress,
        tokenURI: DEFAULT_TOKEN_URI,
        distrConfig: subConfigToSet,
        paymentConfig: paymentConfigEmpty,
      });

      const subHash = await getDomainHashFromEvent({
        zns,
        user: lvl2SubOwner,
      });

      const rootConfigAfter = await zns.subRegistrar.distrConfigs(domain.hash);
      expect(rootConfigAfter.accessType).to.eq(rootConfigBefore.accessType);
      expect(rootConfigAfter.pricerContract).to.eq(rootConfigBefore.pricerContract);
      expect(rootConfigAfter.priceConfig).to.eq(rootConfigBefore.priceConfig);
      expect(rootConfigAfter.paymentType).to.eq(rootConfigBefore.paymentType);
      expect(rootConfigAfter.length).to.eq(4);

      const updatedStructConfig = {
        accessType: AccessType.OPEN,
        pricerContract: await zns.fixedPricer.getAddress(),
        priceConfig: DEFAULT_FIXED_PRICER_CONFIG_BYTES,
        paymentType: PaymentType.DIRECT,
        newAddress: lvl2SubOwner.address,
        newUint: BigInt(123),
      };

      // try setting new fields to the new struct
      await newRegistrarProxy.connect(rootOwner).setDistributionConfigForDomain(
        domain.hash,
        updatedStructConfig
      );

      // check what we got for new
      const rootConfigFinal = await newRegistrarProxy.distrConfigs(domain.hash);
      const subConfigAfter = await newRegistrarProxy.distrConfigs(subHash);

      // validate the new config has been set correctly
      expect(subConfigAfter.accessType).to.eq(subConfigToSet.accessType);
      expect(subConfigAfter.pricerContract).to.eq(subConfigToSet.pricerContract);
      expect(subConfigAfter.paymentType).to.eq(subConfigToSet.paymentType);
      expect(subConfigAfter.newAddress).to.eq(subConfigToSet.newAddress);
      expect(subConfigAfter.newUint).to.eq(subConfigToSet.newUint);

      // validate the old values stayed the same and new values been added
      expect(rootConfigFinal.accessType).to.eq(rootConfigBefore.accessType);
      expect(rootConfigFinal.pricerContract).to.eq(rootConfigBefore.pricerContract);
      expect(rootConfigFinal.paymentType).to.eq(rootConfigBefore.paymentType);
      expect(rootConfigFinal.newAddress).to.eq(updatedStructConfig.newAddress);
      expect(rootConfigFinal.newUint).to.eq(updatedStructConfig.newUint);

      // check that crucial state vars stayed the same
      expect(await newRegistrarProxy.getAccessController()).to.eq(await zns.accessController.getAddress());
      expect(await newRegistrarProxy.registry()).to.eq(await zns.registry.getAddress());
      expect(await newRegistrarProxy.rootRegistrar()).to.eq(await zns.rootRegistrar.getAddress());
    });
  });
});
