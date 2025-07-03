import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  MongoDBAdapter,
} from "@zero-tech/zdc";
import {
  normalizeName,
  validateUpgrade,
  AccessType,
  PaymentType,
  hashDomainLabel,
  DEFAULT_TOKEN_URI,
  distrConfigEmpty,
  INVALID_LENGTH_ERR,
  INITIALIZED_ERR,
  NONEXISTENT_TOKEN_ERC_ERR,
  REGISTRAR_ROLE,
  DEFAULT_PRECISION_MULTIPLIER,
  DEFAULT_CURVE_PRICE_CONFIG,
  DEFAULT_PROTOCOL_FEE_PERCENT,
  NOT_AUTHORIZED_ERR,
  INVALID_LABEL_ERR,
  paymentConfigEmpty,
  AC_UNAUTHORIZED_ERR,
  INSUFFICIENT_BALANCE_ERC_ERR,
  ZERO_ADDRESS_ERR,
  DOMAIN_EXISTS_ERR,
  DEFAULT_CURVE_PRICE_CONFIG_BYTES,
  DEFAULT_FIXED_PRICER_CONFIG_BYTES,
  ZERO_VALUE_CURVE_PRICE_CONFIG_BYTES,
  ZERO_VALUE_FIXED_PRICE_CONFIG_BYTES,
  DIVISION_BY_ZERO_ERR,
  INVALID_CONFIG_LENGTH_ERR,
  PAUSE_SAME_VALUE_ERR, REGISTRATION_PAUSED_ERR, AC_WRONGADDRESS_ERR, createEncodeFixedPriceConfig,
} from "./helpers";
import * as ethers from "ethers";
import { defaultRootRegistration } from "./helpers/register-setup";
import { checkBalance } from "./helpers/balances";
import { decodePriceConfig, encodePriceConfig, getPriceObject, getStakingOrProtocolFee } from "./helpers/pricing";
import { ADMIN_ROLE, GOVERNOR_ROLE, DOMAIN_TOKEN_ROLE } from "../src/deploy/constants";
import {
  IDistributionConfig,
  IRootDomainConfig,
} from "./helpers/types";
import { getDomainHashFromEvent, getDomainRegisteredEvents } from "./helpers/events";
import {
  IERC20,
  ZNSRootRegistrar,
  ZNSRootRegistrar__factory,
  ZNSRootRegistrarUpgradeMock__factory,
} from "../typechain";
import { PaymentConfigStruct } from "../typechain/contracts/treasury/IZNSTreasury";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { getProxyImplAddress } from "./helpers/utils";
import { getConfig } from "../src/deploy/campaign/get-config";
import { ZeroHash } from "ethers";
import { ICurvePriceConfig, IFixedPriceConfig  } from "../src/deploy/missions/types";
import { IZNSContracts } from "../src/deploy/campaign/types";
import Domain from "./helpers/domain/domain";

require("@nomicfoundation/hardhat-chai-matchers");


describe("ZNSRootRegistrar", () => {
  let deployer : SignerWithAddress;
  let user : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let randomUser : SignerWithAddress;

  let zns : IZNSContracts;
  let zeroVault : SignerWithAddress;
  let operator : SignerWithAddress;
  let userBalanceInitial : bigint;

  let mongoAdapter : MongoDBAdapter;

  let domain : Domain;

  const tokenURI = "https://example.com/817c64af";
  const defaultDomain = normalizeName("wilder");

  let directPaymentDomainHash : string;

  beforeEach(async () => {
    // zeroVault address is used to hold the fee charged to the user when registering
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

    zns = campaign.state.contracts;

    await zns.accessController.connect(deployer).grantRole(DOMAIN_TOKEN_ROLE, await zns.domainToken.getAddress());

    mongoAdapter = campaign.dbAdapter;

    await zns.meowToken.connect(deployer).approve(
      await zns.treasury.getAddress(),
      ethers.MaxUint256
    );

    userBalanceInitial = ethers.parseEther("1000000000000000000");

    // Give funds to user
    await zns.meowToken.connect(user).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
    await zns.meowToken.mint(user.address, userBalanceInitial);
  });

  afterEach(async () => {
    await mongoAdapter.dropDB();

    // TODO dom: remove
    domain = undefined as unknown as Domain;
  });

  it("Gas tests", async () => {
    const candidates = [
      deployer.address,
      user.address,
      governor.address,
      admin.address,
      randomUser.address,
    ];

    const allowed = [
      true,
      true,
      true,
      true,
      true,
    ];

    const distrConfig : IDistributionConfig = {
      pricerContract: await zns.curvePricer.getAddress(),
      paymentType: PaymentType.STAKE,
      priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
      accessType: AccessType.OPEN,
    };

    domain = new Domain({
      zns,
      domainConfig: {
        owner: deployer,
        label: defaultDomain,
        tokenOwner: ethers.ZeroAddress,
        parentHash: ethers.ZeroHash,
        distrConfig,
        paymentConfig: paymentConfigEmpty,
        domainAddress: ethers.ZeroAddress,
        tokenURI: DEFAULT_TOKEN_URI,
      },
    });
    await domain.register();

    await domain.updateMintlistForDomain(
      candidates,
      allowed
    );
  });

  it("Should NOT initialize the implementation contract", async () => {
    const otherFact = await hre.ethers.getContractFactory(
      "ZNSRootRegistrar",
      deployer
    );

    // const factory = new ZNSRootRegistrar__factory(deployer);
    const impl = await getProxyImplAddress(await zns.rootRegistrar.getAddress());
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const implContract = otherFact.attach(impl) as ZNSRootRegistrar;

    await expect(
      implContract.initialize(
        operator.address,
        operator.address,
        operator.address,
        operator.address,
        operator.address,
        operator.address,
        0n,
      )
    ).to.be.revertedWithCustomError(implContract, INITIALIZED_ERR);
  });

  it("Allows transfer of 0x0 domain ownership after deployment", async () => {
    await zns.registry.updateDomainOwner(ethers.ZeroHash, user.address);
    expect(await zns.registry.getDomainOwner(ethers.ZeroHash)).to.equal(user.address);
  });

  it("Confirms a new 0x0 owner can modify the configs in the treasury and curve pricer", async () => {
    await zns.accessController.connect(deployer).grantRole(ADMIN_ROLE, user);
    await zns.registry.updateDomainOwner(ethers.ZeroHash, user.address);

    const newTreasuryConfig : PaymentConfigStruct = {
      token: zeroVault.address, // Just needs to be a different address
      beneficiary: user.address,
    };

    // Modify the treasury
    const treasuryTx = await zns.treasury.connect(user).setPaymentConfig(ethers.ZeroHash, newTreasuryConfig);

    await expect(treasuryTx).to.emit(
      zns.treasury,
      "BeneficiarySet"
    ).withArgs(
      ethers.ZeroHash,
      user.address
    );
    await expect(treasuryTx).to.emit(
      zns.treasury,
      "PaymentTokenSet"
    ).withArgs(
      ethers.ZeroHash,
      zeroVault.address
    );

    // Modify the curve pricer
    const newPricerConfig : ICurvePriceConfig = {
      baseLength: BigInt("6"),
      maxLength: BigInt("35"),
      maxPrice: ethers.parseEther("150"),
      curveMultiplier: BigInt(1000),
      precisionMultiplier: DEFAULT_PRECISION_MULTIPLIER,
      feePercentage: DEFAULT_PROTOCOL_FEE_PERCENT,
    };

    const asBytes = encodePriceConfig(newPricerConfig);

    const pricerTx = await zns.rootRegistrar.connect(user).setRootPricerAndConfig(
      await zns.curvePricer.getAddress(),
      asBytes,
    );

    await expect(pricerTx).to.emit(zns.rootRegistrar, "RootPricerSet").withArgs(
      await zns.curvePricer.getAddress(),
      asBytes
    );
  });

  it("Confirms a user has funds and allowance for the Registrar", async () => {
    const balance = await zns.meowToken.balanceOf(user.address);
    expect(balance).to.eq(userBalanceInitial);

    const allowance = await zns.meowToken.allowance(user.address, await zns.treasury.getAddress());
    expect(allowance).to.eq(ethers.MaxUint256);
  });

  it("Should revert when initialize() without ADMIN_ROLE", async () => {
    const userHasAdmin = await zns.accessController.hasRole(ADMIN_ROLE, user.address);
    expect(userHasAdmin).to.be.false;

    const registrarFactory = new ZNSRootRegistrar__factory(user);

    const tx = hre.upgrades.deployProxy(
      registrarFactory,
      [
        await zns.accessController.getAddress(),
        await zns.registry.getAddress(),
        await zns.curvePricer.getAddress(),
        DEFAULT_CURVE_PRICE_CONFIG_BYTES,
        await zns.treasury.getAddress(),
        await zns.domainToken.getAddress(),
        0n,
      ],
      {
        kind: "uups",
      }
    );

    await expect(tx).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
      .withArgs(user.address, ADMIN_ROLE);
  });

  it("Should NOT initialize twice", async () => {
    const tx = zns.rootRegistrar.connect(deployer).initialize(
      await zns.accessController.getAddress(),
      randomUser.address,
      randomUser.address,
      ZeroHash,
      randomUser.address,
      randomUser.address,
      0n,
    );

    await expect(tx).to.be.revertedWithCustomError(
      zns.rootRegistrar,
      INITIALIZED_ERR
    );
  });

  describe("General functionality", () => {
    it("#coreRegister() should revert if called by address without REGISTRAR_ROLE", async () => {
      const isRegistrar = await zns.accessController.hasRole(REGISTRAR_ROLE, randomUser.address);
      expect(isRegistrar).to.be.false;

      await expect(zns.rootRegistrar.connect(randomUser).coreRegister({
        parentHash: ethers.ZeroHash,
        domainHash: ethers.ZeroHash,
        label: "randomname",
        domainOwner: ethers.ZeroAddress,
        tokenOwner: ethers.ZeroAddress,
        domainAddress: ethers.ZeroAddress,
        price: "0",
        stakeFee: "0",
        tokenURI: "",
        isStakePayment: false,
        paymentConfig: paymentConfigEmpty,
      })).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(randomUser.address,REGISTRAR_ROLE);
    });

    it("#setSubRegistrar() should revert if called by address without ADMIN_ROLE", async () => {
      const isAdmin = await zns.accessController.hasRole(ADMIN_ROLE, randomUser.address);
      expect(isAdmin).to.be.false;

      await expect(zns.rootRegistrar.connect(randomUser).setSubRegistrar(randomUser.address))
        .to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(randomUser.address, ADMIN_ROLE);
    });

    it("#setSubRegistrar() should set the correct address", async () => {
      await zns.rootRegistrar.connect(admin).setSubRegistrar(randomUser.address);

      expect(
        await zns.rootRegistrar.subRegistrar()
      ).to.equal(randomUser.address);
    });

    it("#setSubRegistrar() should NOT set the address to zero address", async () => {
      await expect(
        zns.rootRegistrar.connect(admin).setSubRegistrar(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(
        zns.rootRegistrar,
        ZERO_ADDRESS_ERR
      );
    });

    it("#pauseRegistration() should revert if called by address without ADMIN_ROLE", async () => {
      const isAdmin = await zns.accessController.hasRole(ADMIN_ROLE, randomUser.address);
      expect(isAdmin).to.be.false;

      await expect(zns.rootRegistrar.connect(randomUser).pauseRegistration())
        .to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(randomUser.address, ADMIN_ROLE);
    });

    it("#pauseRegistration() should pause the registration and emit #RegistrationPauseSet event", async () => {
      await expect(zns.rootRegistrar.connect(admin).pauseRegistration())
        .to.emit(zns.rootRegistrar, "RegistrationPauseSet")
        .withArgs(true);

      expect(await zns.rootRegistrar.registrationPaused()).to.be.true;
    });

    it("#pauseRegistration() should NOT pause the registration if already paused", async () => {
      await zns.rootRegistrar.connect(admin).pauseRegistration();
      expect(await zns.rootRegistrar.registrationPaused()).to.be.true;

      await expect(zns.rootRegistrar.connect(admin).pauseRegistration())
        .to.be.revertedWithCustomError(zns.rootRegistrar, PAUSE_SAME_VALUE_ERR);
    });

    it("#unpauseRegistration() should revert if called by address without ADMIN_ROLE", async () => {
      const isAdmin = await zns.accessController.hasRole(ADMIN_ROLE, randomUser.address);
      expect(isAdmin).to.be.false;

      await expect(zns.rootRegistrar.connect(randomUser).unpauseRegistration())
        .to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(randomUser.address, ADMIN_ROLE);
    });

    it("#unpauseRegistration() should unpause the registration and emit #RegistrationPauseSet", async () => {
      await zns.rootRegistrar.connect(admin).pauseRegistration();
      expect(await zns.rootRegistrar.registrationPaused()).to.be.true;

      await expect(zns.rootRegistrar.connect(admin).unpauseRegistration())
        .to.emit(zns.rootRegistrar, "RegistrationPauseSet")
        .withArgs(false);

      expect(await zns.rootRegistrar.registrationPaused()).to.be.false;
    });

    it("#unpauseRegistration() should NOT unpause the registration if already unpaused", async () => {
      await expect(zns.rootRegistrar.connect(admin).unpauseRegistration())
        .to.be.revertedWithCustomError(zns.rootRegistrar, PAUSE_SAME_VALUE_ERR);
    });
  });

  describe("Registers a root domain", () => {
    it("Can NOT register a root domain with an empty name", async () => {
      const emptyName = "";

      domain = new Domain({
        zns,
        domainConfig: {
          owner: deployer,
          label: emptyName,
        },
      });

      await expect(
        domain.register()
      ).to.be.revertedWithCustomError(zns.curvePricer, INVALID_LENGTH_ERR);
    });

    it("Can register a root domain with characters [a-z0-9-]", async () => {
      const labels = ["world", "0x0dwidler0x0", "0x0-dwidler-0x0"];

      for (const label of labels) {
        const args = {
          zns,
          domainConfig: {
            owner: deployer,
            label,
          },
        };

        domain = new Domain(args);
        await domain.registerAndValidateDomain();
      }
    });

    it("Fails for domains that use any invalid character", async () => {
      // Valid names must match the pattern [a-z0-9]
      const labels = ["WILDER", "!?w1Id3r!", "?", "!%$#^*?!#👍3^29", "wo.rld"];

      for (const label of labels) {
        const args = {
          zns,
          domainConfig: {
            owner: deployer,
            label,
          },
        };

        domain = new Domain(args);

        await expect(
          domain.register()
        ).to.be.revertedWithCustomError(zns.curvePricer, INVALID_LABEL_ERR);
      }
    });

    it("Fails when registering during a registration pause when called publicly", async () => {
      await zns.rootRegistrar.connect(admin).pauseRegistration();
      expect(await zns.rootRegistrar.registrationPaused()).to.be.true;

      domain = new Domain({
        zns,
        domainConfig: {
          owner: user,
          label: defaultDomain,
        },
      });

      await expect(
        domain.register()
      ).to.be.revertedWithCustomError(zns.rootRegistrar, REGISTRATION_PAUSED_ERR);

      await zns.rootRegistrar.connect(admin).unpauseRegistration();
    });

    it("Successfully registers as ADMIN_ROLE during a registration pause", async () => {
      await zns.rootRegistrar.connect(admin).pauseRegistration();
      expect(await zns.rootRegistrar.registrationPaused()).to.be.true;

      domain = new Domain({
        zns,
        domainConfig: {
          owner: admin,
          label: defaultDomain,
        },
      });
      await domain.registerAndValidateDomain();

      await zns.rootRegistrar.connect(admin).unpauseRegistration();
    });

    // eslint-disable-next-line max-len
    it("Successfully registers a domain without a resolver or resolver content and fires a #DomainRegistered event", async () => {
      domain = new Domain({
        zns,
        domainConfig: {
          owner: user,
          label: defaultDomain,
          tokenURI,
        },
      });

      await domain.registerAndValidateDomain();
    });

    it("Successfully registers a domain with distrConfig and adds it to state properly", async () => {
      const distrConfig : IDistributionConfig = {
        pricerContract: await zns.fixedPricer.getAddress(),
        priceConfig: ZERO_VALUE_FIXED_PRICE_CONFIG_BYTES,
        accessType: AccessType.OPEN,
        paymentType: PaymentType.DIRECT,
      };

      domain = new Domain({
        zns,
        domainConfig: {
          owner: user,
          label: defaultDomain,
          tokenURI,
          distrConfig,
        },
      });

      await domain.registerAndValidateDomain();

      const {
        pricerContract,
        accessType,
        paymentType,
      } = await zns.subRegistrar.distrConfigs(domain.hash);

      expect(pricerContract).to.eq(distrConfig.pricerContract);
      expect(paymentType).to.eq(distrConfig.paymentType);
      expect(accessType).to.eq(distrConfig.accessType);
    });

    it("Registers a domain with assigning token owner to a different address", async () => {
      domain = new Domain({
        zns,
        domainConfig: {
          owner: user,
          label: defaultDomain,
          tokenOwner: randomUser.address,
          tokenURI,
        },
      });
      await domain.registerAndValidateDomain(randomUser);

      expect(await domain.ownerOfToken()).to.eq(randomUser.address);
    });

    it("Stakes and saves the correct amount and token, takes the correct fee and sends fee to Zero Vault", async () => {
      const balanceBeforeUser = await zns.meowToken.balanceOf(user.address);
      const balanceBeforeVault = await zns.meowToken.balanceOf(zeroVault.address);

      // Deploy "wilder" with default configuration
      domain = new Domain({
        zns,
        domainConfig: {
          owner: user,
          label: defaultDomain,
          tokenURI,
        },
      });
      await domain.register();

      const {
        totalPrice,
        expectedPrice,
        stakeFee,
      } = getPriceObject(defaultDomain, DEFAULT_CURVE_PRICE_CONFIG);

      await checkBalance({
        token: zns.meowToken as IERC20,
        balanceBefore: balanceBeforeUser,
        userAddress: user.address,
        target: totalPrice,
      });

      await checkBalance({
        token: zns.meowToken as IERC20,
        balanceBefore: balanceBeforeVault,
        userAddress: zeroVault.address,
        target: stakeFee,
        shouldDecrease: false,
      });

      const { amount: staked, token } = await zns.treasury.stakedForDomain(domain.hash);

      expect(staked).to.eq(expectedPrice);
      expect(token).to.eq(await zns.meowToken.getAddress());
    });

    it("Takes direct payment when `rootPaymentType` is set to DIRECT", async () => {
      // change `rootPaymentType` to DIRECT
      await zns.rootRegistrar.connect(deployer).setRootPaymentType(PaymentType.DIRECT);

      const balanceBeforeUser = await zns.meowToken.balanceOf(user.address);
      const balanceBeforeVault = await zns.meowToken.balanceOf(zeroVault.address);
      const { beneficiary } = await zns.treasury.paymentConfigs(ethers.ZeroHash);
      expect(beneficiary).to.eq(zeroVault.address);

      const directPaymentDomainName = "direct-payment";

      domain = new Domain({
        zns,
        domainConfig: {
          owner: user,
          label: directPaymentDomainName,
          tokenURI,
        },
      });
      await domain.register();

      const { amount: staked, token } = await zns.treasury.stakedForDomain(domain.hash);
      expect(staked).to.eq(0n);
      expect(token).to.eq(hre.ethers.ZeroAddress);

      const {
        expectedPrice,
        stakeFee,
        totalPrice,
      } = getPriceObject(directPaymentDomainName, DEFAULT_CURVE_PRICE_CONFIG);

      const priceConfig = await zns.rootRegistrar.rootPriceConfig();
      const decodedPriceConfig = await zns.curvePricer.decodePriceConfig(priceConfig);
      expect(decodedPriceConfig.baseLength).to.eq(DEFAULT_CURVE_PRICE_CONFIG.baseLength);
      expect(decodedPriceConfig.maxLength).to.eq(DEFAULT_CURVE_PRICE_CONFIG.maxLength);
      expect(decodedPriceConfig.maxPrice).to.eq(DEFAULT_CURVE_PRICE_CONFIG.maxPrice);
      expect(decodedPriceConfig.curveMultiplier).to.eq(DEFAULT_CURVE_PRICE_CONFIG.curveMultiplier);
      expect(decodedPriceConfig.precisionMultiplier).to.eq(DEFAULT_CURVE_PRICE_CONFIG.precisionMultiplier);
      expect(decodedPriceConfig.feePercentage).to.eq(DEFAULT_CURVE_PRICE_CONFIG.feePercentage);
      expect(priceConfig).to.eq(DEFAULT_CURVE_PRICE_CONFIG_BYTES);

      const { price, stakeFee: stakeFeeFromPricer } = await zns.curvePricer.getPriceAndFee(
        priceConfig,
        directPaymentDomainName,
        true
      );
      expect(price).to.eq(expectedPrice);
      expect(stakeFeeFromPricer).to.eq(stakeFee);

      await checkBalance({
        token: zns.meowToken,
        balanceBefore: balanceBeforeUser,
        userAddress: user.address,
        target: totalPrice,
      });

      await checkBalance({
        token: zns.meowToken,
        balanceBefore: balanceBeforeVault,
        userAddress: zeroVault.address,
        target: totalPrice,
        shouldDecrease: false,
      });

      await zns.rootRegistrar.connect(deployer).setRootPaymentType(PaymentType.STAKE);
    });

    // eslint-disable-next-line max-len
    it("Stakes the correct amount when `rootPricer` is set to Fixed Pricer and `rootPriceConfig` to fixed price config", async () => {
      const newFixedPricerConfig : IFixedPriceConfig = {
        price: 123n,
        feePercentage: 19n,
      };

      await zns.rootRegistrar.connect(deployer).setRootPricerAndConfig(
        await zns.fixedPricer.getAddress(),
        createEncodeFixedPriceConfig(newFixedPricerConfig),
      );

      const balanceBeforeUser = await zns.meowToken.balanceOf(user.address);
      const balanceBeforeVault = await zns.meowToken.balanceOf(zeroVault.address);
      const balanceBeforeTreasury = await zns.meowToken.balanceOf(await zns.treasury.getAddress());

      await defaultRootRegistration({
        user,
        zns,
        domainName: "fixed-price",
      });

      const domainHash = await getDomainHashFromEvent({
        zns,
        user,
      });

      const { amount: staked, token } = await zns.treasury.stakedForDomain(domainHash);
      expect(staked).to.eq(newFixedPricerConfig.price);
      expect(token).to.eq(zns.meowToken.target);

      const { totalPrice, stakeFee, expectedPrice } = getPriceObject(defaultDomain, newFixedPricerConfig);

      await checkBalance({
        token: zns.meowToken,
        balanceBefore: balanceBeforeUser,
        userAddress: user.address,
        target: totalPrice,
      });

      await checkBalance({
        token: zns.meowToken,
        balanceBefore: balanceBeforeVault,
        userAddress: zeroVault.address,
        target: stakeFee,
        shouldDecrease: false,
      });

      await checkBalance({
        token: zns.meowToken,
        balanceBefore: balanceBeforeTreasury,
        userAddress: await zns.treasury.getAddress(),
        target: expectedPrice,
        shouldDecrease: false,
      });
    });

    it("Sets the correct data in Registry", async () => {
      domain = new Domain({
        zns,
        domainConfig: {
          owner: user,
          label: defaultDomain,
          tokenURI,
        },
      });
      // validates in Registry and events
      await domain.registerAndValidateDomain();

      const namehashRef = hashDomainLabel(defaultDomain);

      expect(domain.hash).to.eq(namehashRef);
    });

    it("Fails when the user does not have enough funds", async () => {
      const balance = await zns.meowToken.balanceOf(user.address);
      await zns.meowToken.connect(user).transfer(randomUser.address, balance);

      const tx = defaultRootRegistration({
        user,
        zns,
        domainName: defaultDomain,
      });

      // price returns as 0 when given config is 0, valid?
      const { price, stakeFee } = await zns.curvePricer.getPriceAndFee(
        DEFAULT_CURVE_PRICE_CONFIG_BYTES,
        defaultDomain,
        true
      );

      await expect(tx).to.be.revertedWithCustomError(
        zns.meowToken,
        INSUFFICIENT_BALANCE_ERC_ERR
      ).withArgs(user.address, 0n, price + stakeFee);
    });

    it("Disallows creation of a duplicate domain", async () => {
      domain = new Domain({
        zns,
        domainConfig: {
          owner: deployer,
          label: defaultDomain,
          tokenURI,
        },
      });
      await domain.register();

      // Try to register the same domain again
      await expect(
        domain.register()
      ).to.be.revertedWithCustomError(zns.rootRegistrar, DOMAIN_EXISTS_ERR);
    });

    it("Successfully registers a domain without resolver content", async () => {
      domain = new Domain({
        zns,
        domainConfig: {
          owner: user,
          label: defaultDomain,
          tokenURI: DEFAULT_TOKEN_URI,
        },
      });

      await expect(
        domain.register()
      ).to.not.be.reverted;
    });

    it("Creates and finds the correct tokenId", async () => {
      domain = new Domain({
        zns,
        domainConfig: {
          owner: user,
          label: defaultDomain,
        },
      });
      await domain.register();

      const owner = await zns.domainToken.ownerOf(await domain.tokenId);
      expect(owner).to.eq(user.address);
    });

    it("Resolves the correct address from the domain", async () => {
      domain = new Domain({
        zns,
        domainConfig: {
          owner: user,
          label: defaultDomain,
          domainAddress: await zns.rootRegistrar.getAddress(),
        },
      });
      await domain.register();

      const resolvedAddress = await zns.addressResolver.resolveDomainAddress(domain.hash);
      expect(resolvedAddress).to.eq(await zns.rootRegistrar.getAddress());
    });

    it("Should NOT charge any tokens if price and/or stake fee is 0", async () => {
      const localConfig = { ...DEFAULT_CURVE_PRICE_CONFIG };
      localConfig.maxPrice = 0n;

      await zns.rootRegistrar.connect(deployer).setRootPricerAndConfig(
        await zns.curvePricer.getAddress(),
        encodePriceConfig(localConfig),
      );

      const userBalanceBefore = await zns.meowToken.balanceOf(user.address);
      const vaultBalanceBefore = await zns.meowToken.balanceOf(zeroVault.address);

      // register a domain
      await zns.rootRegistrar.connect(user).registerRootDomain({
        name: defaultDomain,
        domainAddress: ethers.ZeroAddress,
        tokenOwner: ethers.ZeroAddress,
        tokenURI: DEFAULT_TOKEN_URI,
        distrConfig: distrConfigEmpty,
        paymentConfig: {
          token: ethers.ZeroAddress,
          beneficiary: ethers.ZeroAddress,
        },
      });

      const userBalanceAfter = await zns.meowToken.balanceOf(user.address);
      const vaultBalanceAfter = await zns.meowToken.balanceOf(zeroVault.address);

      expect(userBalanceBefore).to.eq(userBalanceAfter);
      expect(vaultBalanceBefore).to.eq(vaultBalanceAfter);

      // check existence in Registry
      const domainHash = hashDomainLabel(defaultDomain);
      const exists = await zns.registry.exists(domainHash);
      expect(exists).to.be.true;

      // make sure no transfers happened
      const transferEventFilter = zns.meowToken.filters.Transfer(
        user.address,
      );
      const events = await zns.meowToken.queryFilter(transferEventFilter);
      expect(events.length).to.eq(0);
    });

    it("Sets the payment config when provided with the domain registration", async () => {
      const distrConfig : IDistributionConfig = {
        pricerContract: await zns.curvePricer.getAddress(),
        paymentType: PaymentType.STAKE,
        accessType: AccessType.OPEN,
        priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
      };

      domain = new Domain({
        zns,
        domainConfig: {
          owner: user,
          label: defaultDomain,
          tokenURI,
          distrConfig,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: user.address,
          },
        },
      });
      await domain.register();

      const { token, beneficiary } = await zns.treasury.paymentConfigs(domain.hash);
      expect(token).to.eq(await zns.meowToken.getAddress());
      expect(beneficiary).to.eq(user.address);
    });

    it("Does not set the payment config when the beneficiary is the zero address", async () => {
      const distrConfig : IDistributionConfig = {
        pricerContract: await zns.curvePricer.getAddress(),
        paymentType: PaymentType.STAKE,
        accessType: AccessType.OPEN,
        priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
      };

      domain = new Domain({
        zns,
        domainConfig: {
          owner: user,
          label: defaultDomain,
          distrConfig,
          paymentConfig: {
            token: ethers.ZeroAddress,
            beneficiary: ethers.ZeroAddress,
          },
        },
      });
      await domain.register();

      const { token, beneficiary } = await zns.treasury.paymentConfigs(domain.hash);
      expect(token).to.eq(ethers.ZeroAddress);
      expect(beneficiary).to.eq(ethers.ZeroAddress);
    });
  });

  describe("Assigning Domain Token Owners - #assignDomainToken()", () => {
    it("Can assign token to another address and reclaim token if domain hash is owned", async () => {
      // Register Top level
      domain = new Domain({
        zns,
        domainConfig: {
          owner: deployer,
          label: defaultDomain,
          tokenURI,
        },
      });
      await domain.register();

      const { amount: staked, token } = await zns.treasury.stakedForDomain(domain.hash);

      // Change domain owner to different address
      await zns.registry.connect(deployer).updateDomainOwner(domain.hash, user.address);

      // Verify owner in Registry is changed
      expect(await domain.ownerOfHash()).to.equal(user.address);

      // Reclaim the Domain Token
      await domain.assignDomainToken(user.address, user);

      // Verify domain token is now owned by new hash owner
      expect(await domain.ownerOfToken()).to.equal(user.address);

      // Verify domain is still owned in registry
      expect(await domain.ownerOfHash()).to.equal(user.address);

      // Verify same amount is staked
      const { amount: stakedAfterReclaim, token: tokenAfterReclaim } = await zns.treasury.stakedForDomain(domain.hash);
      expect(staked).to.equal(stakedAfterReclaim);
      expect(tokenAfterReclaim).to.equal(await zns.meowToken.getAddress());
      expect(token).to.equal(tokenAfterReclaim);
    });

    it("Assigning domain token emits DomainTokenReassigned event", async () => {
      domain = new Domain({
        zns,
        domainConfig: {
          owner: deployer,
          label: defaultDomain,
        },
      });
      await domain.register();

      // Assign the Domain token
      await expect(
        domain.assignDomainToken(user.address, deployer)
      ).to.emit(zns.rootRegistrar, "DomainTokenReassigned").withArgs(
        domain.hash,
        user.address
      );
    });

    it("Cannot assign token if hash is not owned", async () => {
      domain = new Domain({
        zns,
        domainConfig: {
          owner: deployer,
          label: defaultDomain,
          tokenURI,
        },
      });
      await domain.register();

      // Reclaim the Domain
      await expect(
        domain.assignDomainToken(user.address, user)
      ).to.be.revertedWithCustomError(
        zns.rootRegistrar,
        NOT_AUTHORIZED_ERR,
      ).withArgs(user.address, domain.hash);

      // Verify domain is not owned in registry
      expect(
        await domain.ownerOfHash()
      ).to.equal(deployer.address);
    });

    it("Cannot assign token if domain does not exist", async () => {
      const domainHash = "0xd34cfa279afd55afc6aa9c00aa5d01df60179840a93d10eed730058b8dd4146c";
      // Reclaim the Domain
      const tx = zns.rootRegistrar.connect(user).assignDomainToken(domainHash, user.address);

      // Verify Domain is not reclaimed
      await expect(tx).to.be.revertedWithCustomError(
        zns.rootRegistrar,
        NOT_AUTHORIZED_ERR,
      ).withArgs(user.address, domainHash);
    });

    // eslint-disable-next-line max-len
    it("Domain hash can change owner, claim token, transfer, and then be assigned to a diff address again", async () => {
      // Register Top level
      domain = new Domain({
        zns,
        domainConfig: {
          owner: deployer,
          label: defaultDomain,
          tokenURI,
        },
      });
      await domain.register();
      const { amount: staked, token } = await zns.treasury.stakedForDomain(domain.hash);

      // Transfer the hash owner
      await zns.registry.connect(deployer).updateDomainOwner(domain.hash, user.address);

      // Claim the Domain token
      await domain.assignDomainToken(user.address, user);
      // Verify domain token is owned
      expect(await domain.ownerOfToken()).to.equal(user.address);

      // Transfer the domain token back
      await zns.domainToken.connect(user).transferFrom(user.address, deployer.address, domain.tokenId);

      // check that hash and token owners changed to the same address
      expect(await domain.ownerOfToken()).to.equal(deployer.address);
      expect(await domain.ownerOfHash()).to.equal(deployer.address);

      // Assign the Domain token to diff address again
      await domain.assignDomainToken(user.address, deployer);

      // Verify domain token is owned
      expect(await domain.ownerOfToken()).to.equal(user.address);
      // but not the hash
      expect(await domain.ownerOfHash()).to.equal(deployer.address);

      // Verify same amount is staked
      const { amount: stakedAfterReclaim, token: tokenAfterReclaim } = await zns.treasury.stakedForDomain(domain.hash);
      expect(staked).to.equal(stakedAfterReclaim);
      expect(tokenAfterReclaim).to.equal(await zns.meowToken.getAddress());
      expect(token).to.equal(tokenAfterReclaim);
    });

    it("Should revert if assigning to existing owner", async () => {
      // Register Top level
      domain = new Domain({
        zns,
        domainConfig: {
          owner: deployer,
          label: "tokennn",
        },
      });
      await domain.register();

      const domainHash = await domain.getDomainHashFromEvent(deployer);

      // Assign the Domain token
      await expect(
        domain.assignDomainToken(deployer.address)
      ).to.be.revertedWithCustomError(
        zns.rootRegistrar,
        "AlreadyTokenOwner",
      ).withArgs(domainHash, deployer.address);
    });
  });

  describe("Revoking Domains", () => {
    it("Can revoke even if token assigned to a different address", async () => {
      // Register Top level
      domain = new Domain({
        zns,
        domainConfig: {
          owner: deployer,
          label: defaultDomain,
        },
      });
      await domain.register();

      const domainHash = await domain.getDomainHashFromEvent(deployer);

      // Validated staked values
      const {
        expectedPrice: expectedStaked,
      } = getPriceObject(defaultDomain, DEFAULT_CURVE_PRICE_CONFIG);

      const { amount: staked, token } = await zns.treasury.stakedForDomain(domainHash);
      expect(staked).to.eq(expectedStaked);
      expect(token).to.eq(await zns.meowToken.getAddress());

      // Assign the domain token to a diff address
      await zns.rootRegistrar.connect(deployer).assignDomainToken(domainHash, user.address);
      // Verify domain token is owned
      const tokenOwner = await zns.domainToken.ownerOf(domainHash);
      expect(tokenOwner).to.equal(user.address);

      const balanceBefore = await zns.meowToken.balanceOf(deployer.address);

      // Revoke the Domain
      await zns.rootRegistrar.connect(deployer).revokeDomain(domainHash);

      // Validated funds are unstaked
      const { amount: finalstaked, token: finalToken } = await zns.treasury.stakedForDomain(domainHash);
      expect(finalstaked).to.equal(BigInt("0"));
      expect(finalToken).to.equal(ethers.ZeroAddress);

      const protocolFee = getStakingOrProtocolFee(staked);

      // Verify final balances
      const computedFinalBalance = balanceBefore + staked - protocolFee;
      const finalBalance = await zns.meowToken.balanceOf(deployer.address);
      expect(computedFinalBalance).to.equal(finalBalance);
    });

    it("Charges a protocol fee to the owner as part of the revoke flow", async () => {
      domain = new Domain({
        zns,
        domainConfig: {
          owner: user,
          label: defaultDomain,
        },
      });
      await domain.register();

      const domainHash = await domain.getDomainHashFromEvent(user);

      const price = await zns.curvePricer.getPrice(
        DEFAULT_CURVE_PRICE_CONFIG_BYTES,
        defaultDomain,
        false
      );

      const protocolFee = await zns.curvePricer.getFeeForPrice(
        DEFAULT_CURVE_PRICE_CONFIG_BYTES,
        price
      );

      await expect(
        zns.rootRegistrar.connect(user).revokeDomain(domainHash)
      ).to.changeTokenBalance(
        zns.meowToken,
        user,
        price - protocolFee
      );
    });

    it("Revokes without returning funds if domain was registered with DIRECT payment type", async () => {
      // change `rootPaymentType` to DIRECT
      await zns.rootRegistrar.connect(deployer).setRootPaymentType(PaymentType.DIRECT);

      const directPaymentDomainName = "direct-payment";

      domain = new Domain({
        zns,
        domainConfig: {
          owner: user,
          label: directPaymentDomainName,
        },
      });
      await domain.register();

      directPaymentDomainHash = await domain.getDomainHashFromEvent(user);

      const { amount: staked, token } = await zns.treasury.stakedForDomain(directPaymentDomainHash);
      expect(staked).to.eq(0n);
      expect(token).to.eq(hre.ethers.ZeroAddress);

      const userBalanceBefore = await zns.meowToken.balanceOf(user.address);
      const treasuryBalanceBefore = await zns.meowToken.balanceOf(await zns.treasury.getAddress());

      const owner = await zns.registry.getDomainOwner(directPaymentDomainHash);
      expect(owner).to.equal(user.address);

      // Revoke the domain and then verify
      await zns.rootRegistrar.connect(user).revokeDomain(directPaymentDomainHash);

      await checkBalance({
        token: zns.meowToken,
        balanceBefore: userBalanceBefore,
        userAddress: user.address,
        target: 0n, // no funds returned
      });

      await checkBalance({
        token: zns.meowToken,
        balanceBefore: treasuryBalanceBefore,
        userAddress: await zns.treasury.getAddress(),
        target: 0n, // no funds returned
      });

      // change `rootPaymentType` back to STAKE
      await zns.rootRegistrar.connect(deployer).setRootPaymentType(PaymentType.STAKE);
    });

    it("Revokes a Top level Domain, locks distribution and removes mintlist", async () => {
      // Register Top level
      domain = new Domain({
        zns,
        domainConfig: {
          owner: user,
          label: defaultDomain,
          tokenURI,
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: DEFAULT_FIXED_PRICER_CONFIG_BYTES,
            paymentType: PaymentType.DIRECT,
            accessType: AccessType.OPEN,
          },
        },
      });
      await domain.register();

      const domainHash = await domain.getDomainHashFromEvent(user);

      // add mintlist to check revocation
      await domain.updateMintlistForDomain(
        [user.address, zeroVault.address],
        [true, true],
        user
      );

      const ogPrice = BigInt(135);

      const newConfig : IFixedPriceConfig = {
        price: ogPrice,
        feePercentage: BigInt(0),
      };

      const asBytes = encodePriceConfig(newConfig);

      await domain.setPricerDataForDomain(
        newConfig,
        zns.fixedPricer.target as string,
      );

      expect(await zns.fixedPricer.getPrice(asBytes, defaultDomain, false)).to.eq(ogPrice);

      // Revoke the domain and then verify
      await domain.revoke(user);

      // Verify token has been burned
      await expect(
        domain.ownerOfToken()
      ).to.be.revertedWithCustomError(
        zns.domainToken,
        NONEXISTENT_TOKEN_ERC_ERR
      ).withArgs(BigInt(domainHash));

      // Verify Domain Record Deleted
      const exists = await zns.registry.exists(domainHash);
      expect(exists).to.be.false;

      // validate access type has been set to LOCKED
      const { accessType } = await zns.subRegistrar.distrConfigs(domainHash);
      expect(accessType).to.eq(AccessType.LOCKED);

      // validate mintlist has been removed
      expect(await zns.subRegistrar.isMintlistedForDomain(domainHash, user.address)).to.be.false;
      expect(await zns.subRegistrar.isMintlistedForDomain(domainHash, zeroVault.address)).to.be.false;
    });

    it("Cannot revoke a domain that doesnt exist", async () => {
      // Register Top level
      const fakeHash = "0xd34cfa279afd55afc6aa9c00aa5d01df60179840a93d10eed730058b8dd4146c";
      const exists = await zns.registry.exists(fakeHash);
      expect(exists).to.be.false;

      // Verify transaction is reverted
      const tx = zns.rootRegistrar.connect(user).revokeDomain(fakeHash);
      await expect(tx).to.be.revertedWithCustomError(
        zns.rootRegistrar,
        NOT_AUTHORIZED_ERR,
      );
    });

    it("Revoking domain unstakes", async () => {
      // Verify Balance
      const balance = await zns.meowToken.balanceOf(user.address);
      expect(balance).to.eq(userBalanceInitial);

      // Register Top level
      domain = new Domain({
        zns,
        domainConfig: {
          owner: user,
          label: defaultDomain,
        },
      });
      await domain.register();

      const domainHash = await domain.getDomainHashFromEvent(user);

      // Validated staked values
      const {
        expectedPrice: expectedStaked,
        stakeFee: expectedStakeFee,
      } = getPriceObject(defaultDomain, DEFAULT_CURVE_PRICE_CONFIG);
      const { amount: staked, token } = await zns.treasury.stakedForDomain(domainHash);
      expect(staked).to.eq(expectedStaked);
      expect(token).to.eq(await zns.meowToken.getAddress());

      // Get balance after staking
      const balanceAfterStaking = await zns.meowToken.balanceOf(user.address);

      // Revoke the domain
      await domain.revoke(user);

      // Validated funds are unstaked
      const { amount: finalstaked, token: finalToken } = await zns.treasury.stakedForDomain(domainHash);
      expect(finalstaked).to.equal(BigInt("0"));
      expect(finalToken).to.equal(ethers.ZeroAddress);

      const protocolFee = getStakingOrProtocolFee(staked);

      // Verify final balances
      const computedBalanceAfterStaking = balanceAfterStaking + staked;
      const balanceMinusFee = balance - expectedStakeFee;
      expect(computedBalanceAfterStaking).to.equal(balanceMinusFee);
      const finalBalance = await zns.meowToken.balanceOf(user.address);
      expect(computedBalanceAfterStaking - protocolFee).to.equal(finalBalance);
    });

    it("Cannot revoke if Name is owned by another user", async () => {
      // Register Top level
      domain = new Domain({
        zns,
        domainConfig: {
          owner: deployer,
          label: defaultDomain,
        },
      });
      await domain.register();
      const parentDomainHash = await domain.getDomainHashFromEvent(deployer);

      const owner = await domain.ownerOfHash();
      expect(owner).to.not.equal(user.address);

      // Try to revoke domain
      await expect(domain.revoke(user)).to.be.revertedWithCustomError(
        zns.rootRegistrar,
        NOT_AUTHORIZED_ERR
      ).withArgs(user.address, parentDomainHash);
    });

    it("Only token owner can NOT revoke if hash is owned by different address", async () => {
      // Register Top level
      domain = new Domain({
        zns,
        domainConfig: {
          owner: deployer,
          label: defaultDomain,
        },
      });
      await domain.register();

      expect(
        await domain.ownerOfHash()
      ).to.not.equal(user.address);

      await domain.assignDomainToken(user.address, deployer);

      // Try to revoke domain as a new owner of the token
      await expect(
        domain.revoke(user)
      ).to.be.revertedWithCustomError(
        zns.rootRegistrar,
        NOT_AUTHORIZED_ERR,
      );

      await expect(
        domain.revoke()
      ).to.not.be.reverted;
    });

    it("After domain has been revoked, an old operator can NOT access Registry", async () => {
      // Register Top level
      domain = new Domain({
        zns,
        domainConfig: {
          owner: user,
          label: defaultDomain,
        },
      });
      await domain.register();

      // assign an operator
      await domain.setOwnersOperator(operator.address, true);

      // Revoke the domain
      await domain.revoke();

      // check operator access to the revoked domain
      const tx2 = zns.registry
        .connect(operator)
        .updateDomainOwner(
          domain.hash,
          operator.address
        );
      await expect(tx2).to.be.revertedWithCustomError(
        zns.registry,
        NOT_AUTHORIZED_ERR
      );

      const tx3 = zns.registry
        .connect(operator)
        .updateDomainRecord(
          domain.hash,
          user.address,
          operator.address
        );
      await expect(tx3).to.be.revertedWithCustomError(zns.registry, NOT_AUTHORIZED_ERR);

      const tx4 = zns.registry
        .connect(operator)
        .updateDomainResolver(
          domain.hash,
          zeroVault.address
        );
      await expect(tx4).to.be.revertedWithCustomError(zns.registry, NOT_AUTHORIZED_ERR);
    });
  });

  describe("Bulk Root Domain Registration", () => {
    it("Should register an array of domains using #registerRootDomainBulk", async () => {
      const registrations : Array<IRootDomainConfig> = [];

      for (let i = 0; i < 5; i++) {
        const isOdd = i % 2 !== 0;

        const domainObj : IRootDomainConfig = {
          name: `domain${i + 1}`,
          domainAddress: user.address,
          tokenOwner: hre.ethers.ZeroAddress,
          tokenURI: `0://domainURI_${i + 1}`,
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            paymentType: isOdd ? PaymentType.STAKE : PaymentType.DIRECT,
            accessType: isOdd ? AccessType.LOCKED : AccessType.OPEN,
            priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: isOdd ? user.address : operator.address,
          },
        };

        registrations.push(domainObj);
      }

      await zns.rootRegistrar.connect(user).registerRootDomainBulk(registrations);

      for (const domain of registrations) {
        // get by `domainHash`
        const logs = await getDomainRegisteredEvents({
          zns,
          domainHash: hashDomainLabel(domain.name),
        });

        // "DomainRegistered" event log
        const {
          parentHash,
          domainHash,
          tokenOwner,
          label,
          tokenURI: localTokenURI,
          domainOwner,
          domainAddress,
        } = logs[0].args;

        expect(parentHash).to.eq(ethers.ZeroHash);
        expect(domainHash).to.eq(hashDomainLabel(domain.name));
        expect(label).to.eq(domain.name);
        expect(tokenOwner).to.eq(domainOwner);
        expect(localTokenURI).to.eq(domain.tokenURI);
        expect(domainOwner).to.eq(user.address);
        expect(domainAddress).to.eq(domain.domainAddress);
      }
    });

    it("Should revert when register the same domain twice using #registerRootDomainBulk", async () => {
      const domainObj = {
        name: "root",
        domainAddress: user.address,
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

      // Attempt to register the same domain again
      await expect(
        zns.rootRegistrar.connect(user).registerRootDomainBulk([domainObj, domainObj])
      ).to.be.revertedWithCustomError(zns.rootRegistrar, DOMAIN_EXISTS_ERR);
    });

    it("Should revert when registering during a registration pause using #registerRootDomainBulk", async () => {
      const domainObj = {
        name: "pausedDomain",
        domainAddress: user.address,
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

      // Pause the registration
      await zns.rootRegistrar.connect(admin).pauseRegistration();

      // Attempt to register a domain while paused
      await expect(
        zns.rootRegistrar.connect(user).registerRootDomainBulk([domainObj])
      ).to.be.revertedWithCustomError(zns.rootRegistrar, REGISTRATION_PAUSED_ERR);

      // unpause the registration
      await zns.rootRegistrar.connect(admin).unpauseRegistration();
    });
  });

  describe("State Setters", () => {
    describe("#setRegistry", () => {
      it("Should set ZNSRegistry and fire RegistrySet event", async () => {
        const currentRegistry = await zns.rootRegistrar.registry();
        const tx = await zns.rootRegistrar.connect(deployer).setRegistry(randomUser.address);
        const newRegistry = await zns.rootRegistrar.registry();

        await expect(tx).to.emit(zns.rootRegistrar, "RegistrySet").withArgs(randomUser.address);

        expect(newRegistry).to.equal(randomUser.address);
        expect(currentRegistry).to.not.equal(newRegistry);
      });

      it("Should revert if not called by ADMIN", async () => {
        const tx = zns.rootRegistrar.connect(user).setRegistry(randomUser.address);
        await expect(tx).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
          .withArgs(user.address,ADMIN_ROLE);
      });

      it("Should revert if ZNSRegistry is address zero", async () => {
        const tx = zns.rootRegistrar.connect(deployer).setRegistry(ethers.ZeroAddress);
        await expect(tx).to.be.revertedWithCustomError(
          zns.rootRegistrar,
          ZERO_ADDRESS_ERR
        );
      });
    });

    describe("#setTreasury", () => {
      it("Should set Treasury and fire TreasurySet event", async () => {
        const currentTreasury = await zns.rootRegistrar.treasury();
        const tx = await zns.rootRegistrar.connect(deployer).setTreasury(randomUser.address);
        const newTreasury = await zns.rootRegistrar.treasury();

        await expect(tx).to.emit(zns.rootRegistrar, "TreasurySet").withArgs(randomUser.address);

        expect(newTreasury).to.equal(randomUser.address);
        expect(currentTreasury).to.not.equal(newTreasury);
      });

      it("Should revert if not called by ADMIN", async () => {
        const tx = zns.rootRegistrar.connect(user).setTreasury(randomUser.address);
        await expect(tx).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
          .withArgs(user.address,ADMIN_ROLE);
      });

      it("Should revert if Treasury is address zero", async () => {
        const tx = zns.rootRegistrar.connect(deployer).setTreasury(ethers.ZeroAddress);
        await expect(tx).to.be.revertedWithCustomError(
          zns.rootRegistrar,
          ZERO_ADDRESS_ERR
        );
      });
    });

    describe("#setDomainToken", () => {
      it("Should set DomainToken and fire DomainTokenSet event", async () => {
        const currentToken = await zns.rootRegistrar.domainToken();
        const tx = await zns.rootRegistrar.connect(deployer).setDomainToken(randomUser.address);
        const newToken = await zns.rootRegistrar.domainToken();

        await expect(tx).to.emit(zns.rootRegistrar, "DomainTokenSet").withArgs(randomUser.address);

        expect(newToken).to.equal(randomUser.address);
        expect(currentToken).to.not.equal(newToken);
      });

      it("Should revert if not called by ADMIN", async () => {
        const tx = zns.rootRegistrar.connect(user).setDomainToken(randomUser.address);
        await expect(tx).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
          .withArgs(user.address,ADMIN_ROLE);
      });

      it("Should revert if DomainToken is address zero", async () => {
        const tx = zns.rootRegistrar.connect(deployer).setDomainToken(ethers.ZeroAddress);
        await expect(tx).to.be.revertedWithCustomError(
          zns.rootRegistrar,
          ZERO_ADDRESS_ERR
        );
      });
    });

    describe("#setRootPricerAndConfig", () => {
      it("should set the rootPricer correctly", async () => {
        const newPricer = zns.fixedPricer.target;
        await zns.rootRegistrar.connect(admin).setRootPricerAndConfig(
          newPricer,
          DEFAULT_FIXED_PRICER_CONFIG_BYTES,
        );

        expect(await zns.rootRegistrar.rootPricer()).to.eq(newPricer);

        // set back
        await zns.rootRegistrar.connect(admin).setRootPricerAndConfig(
          zns.curvePricer.target,
          DEFAULT_CURVE_PRICE_CONFIG_BYTES,
        );
      });

      it("Fails when setting 0x0 address as the new pricer", async () => {
        await expect(
          zns.rootRegistrar.connect(admin).setRootPricerAndConfig(
            ethers.ZeroAddress,
            ethers.ZeroHash
          )
        ).to.be.revertedWithCustomError(
          zns.rootRegistrar,
          ZERO_ADDRESS_ERR
        );
      });

      // fails when giving an invalid config with a pricer
      it("Fails when setting an invalid config with a pricer", async () => {
        const invalidConfig = { ...DEFAULT_CURVE_PRICE_CONFIG };
        invalidConfig.baseLength = 0n;
        invalidConfig.curveMultiplier = 0n;

        const asBytes = encodePriceConfig(invalidConfig);

        await expect(
          zns.rootRegistrar.connect(admin).setRootPricerAndConfig(
            zns.curvePricer.target,
            asBytes
          )
        ).to.be.revertedWithCustomError(
          zns.curvePricer,
          DIVISION_BY_ZERO_ERR
        );
      });

      // fails when anyone except the admin tries to set the pricer
      it("Fails when setting an invalid config with a pricer", async () => {
        const invalidConfig = { ...DEFAULT_CURVE_PRICE_CONFIG };
        invalidConfig.baseLength = 0n;
        invalidConfig.curveMultiplier = 0n;

        const asBytes = encodePriceConfig(invalidConfig);

        await expect(
          zns.rootRegistrar.connect(admin).setRootPricerAndConfig(
            zns.curvePricer.target,
            asBytes
          )
        ).to.be.revertedWithCustomError(
          zns.curvePricer,
          DIVISION_BY_ZERO_ERR
        );
      });
    });

    describe("#setRootPriceConfig", () => {
      it("should set the rootPricer config correctly", async () => {
        // Verify the curve pricer is currently set
        expect(
          (await zns.rootRegistrar.rootPricer())
        ).to.eq(zns.curvePricer.target);

        const newMaxPrice = hre.ethers.parseEther("13232");

        const localConfig = { ...DEFAULT_CURVE_PRICE_CONFIG };
        localConfig.maxPrice = newMaxPrice;

        const asBytes = encodePriceConfig(localConfig);

        // It will allow a valid curve config to be set
        await zns.rootRegistrar.connect(admin).setRootPriceConfig(
          asBytes,
        );

        expect(await zns.rootRegistrar.rootPriceConfig()).to.eq(asBytes);

        const decoded = decodePriceConfig(await zns.rootRegistrar.rootPriceConfig()) as ICurvePriceConfig;
        expect(decoded.maxPrice).to.eq(newMaxPrice);
      });

      it("Fails when setting 0x0 bytes as the new config", async () => {
        await expect(
          zns.rootRegistrar.connect(admin).setRootPriceConfig(
            ethers.ZeroHash
          )).to.be.revertedWithCustomError(
          zns.curvePricer,
          INVALID_CONFIG_LENGTH_ERR
        );
      });

      it("Fails when setting an invalid config with a pricer", async () => {
        const invalidConfig = { ...DEFAULT_CURVE_PRICE_CONFIG };
        // Breaks the validation
        invalidConfig.baseLength = 0n;
        invalidConfig.curveMultiplier = 0n;

        const asBytes = encodePriceConfig(invalidConfig);

        await expect(
          zns.rootRegistrar.connect(randomUser).setRootPriceConfig(
            asBytes
          )
        ).to.be.revertedWithCustomError(
          zns.accessController,
          AC_UNAUTHORIZED_ERR
        ).withArgs(randomUser.address, ADMIN_ROLE);
      });

      it("Fails when setting an invalid config with a pricer", async () => {
        // Trying to set a fixed pricer config for the curve pricer will fail
        await expect(
          zns.rootRegistrar.connect(admin).setRootPriceConfig(
            DEFAULT_FIXED_PRICER_CONFIG_BYTES
          )
        ).to.be.revertedWithCustomError(
          zns.curvePricer,
          INVALID_CONFIG_LENGTH_ERR
        );
      });
    });

    describe("#setAccessController", () => {
      it("should allow ADMIN to set a valid AccessController", async () => {
        await zns.rootRegistrar.connect(deployer).setAccessController(zns.accessController.target);

        const currentAccessController = await zns.rootRegistrar.getAccessController();

        expect(currentAccessController).to.equal(zns.accessController.target);
      });

      it("should allow re-setting the AccessController to another valid contract", async () => {
        expect(
          await zns.rootRegistrar.getAccessController()
        ).to.equal(
          zns.accessController.target
        );

        const ZNSAccessControllerFactory = await hre.ethers.getContractFactory("ZNSAccessController", deployer);
        const newAccessController = await ZNSAccessControllerFactory.deploy(
          [deployer.address],
          [deployer.address]
        );

        // then change the AccessController
        await zns.rootRegistrar.connect(deployer).setAccessController(newAccessController.target);

        expect(
          await zns.rootRegistrar.getAccessController()
        ).to.equal(
          newAccessController.target
        );
      });

      it("should emit AccessControllerSet event when setting a valid AccessController", async () => {
        await expect(
          zns.rootRegistrar.connect(deployer).setAccessController(zns.accessController.target)
        ).to.emit(
          zns.rootRegistrar,
          "AccessControllerSet"
        ).withArgs(zns.accessController.target);
      });

      it("should revert when a non-ADMIN tries to set AccessController", async () => {
        await expect(
          zns.rootRegistrar.connect(user).setAccessController(zns.accessController.target)
        ).to.be.revertedWithCustomError(
          zns.rootRegistrar,
          AC_UNAUTHORIZED_ERR
        ).withArgs(user.address, ADMIN_ROLE);
      });

      it("should revert when setting an AccessController as EOA address", async () => {
        await expect(
          zns.rootRegistrar.connect(deployer).setAccessController(user.address)
        ).to.be.revertedWithCustomError(
          zns.rootRegistrar,
          AC_WRONGADDRESS_ERR
        ).withArgs(user.address);
      });

      it("should revert when setting an AccessController as another non-AC contract address", async () => {
        await expect(
          zns.rootRegistrar.connect(deployer).setAccessController(zns.rootRegistrar.target)
        ).to.be.revertedWithCustomError(
          zns.rootRegistrar,
          AC_WRONGADDRESS_ERR
        ).withArgs(zns.rootRegistrar.target);
      });

      it("should revert when setting a zero address as AccessController", async () => {
        await expect(
          zns.rootRegistrar.connect(admin).setAccessController(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(
          zns.rootRegistrar,
          AC_WRONGADDRESS_ERR
        ).withArgs(ethers.ZeroAddress);
      });
    });
  });

  describe("UUPS", () => {
    it("Allows an authorized user to upgrade the contract", async () => {
      // Confirm deployer has the correct role first
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const registrarFactory = new ZNSRootRegistrar__factory(deployer);
      const registrar = await registrarFactory.deploy();
      await registrar.waitForDeployment();

      const upgradeTx = zns.rootRegistrar.connect(deployer).upgradeToAndCall(
        await registrar.getAddress(),
        "0x"
      );
      await expect(upgradeTx).to.not.be.reverted;
    });

    it("Fails to upgrade when an unauthorized users calls", async () => {
      const registrarFactory = new ZNSRootRegistrar__factory(deployer);
      const registrar = await registrarFactory.deploy();
      await registrar.waitForDeployment();

      const tx = zns.rootRegistrar.connect(randomUser).upgradeToAndCall(
        await registrar.getAddress(),
        "0x"
      );

      await expect(tx).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(randomUser.address, GOVERNOR_ROLE);
    });

    it("Verifies that variable values are not changed in the upgrade process", async () => {
      // Confirm deployer has the correct role first
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const registrarFactory = new ZNSRootRegistrarUpgradeMock__factory(deployer);
      const registrar = await registrarFactory.deploy();
      await registrar.waitForDeployment();

      const domainName = "world";
      const domainHash = hashDomainLabel(domainName);

      await zns.meowToken.connect(randomUser).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
      await zns.meowToken.mint(randomUser.address, DEFAULT_CURVE_PRICE_CONFIG.maxPrice);

      await zns.rootRegistrar.connect(randomUser).registerRootDomain({
        name: domainName,
        domainAddress: randomUser.address,
        tokenOwner: ethers.ZeroAddress,
        tokenURI: DEFAULT_TOKEN_URI,
        distrConfig: distrConfigEmpty,
        paymentConfig: {
          token: ethers.ZeroAddress,
          beneficiary: ethers.ZeroAddress,
        },
      });

      const contractCalls = [
        zns.rootRegistrar.getAccessController(),
        zns.rootRegistrar.registry(),
        zns.rootRegistrar.treasury(),
        zns.rootRegistrar.domainToken(),
        zns.registry.exists(domainHash),
        zns.treasury.stakedForDomain(domainHash),
        zns.domainToken.name(),
        zns.domainToken.symbol(),
        zns.curvePricer.getPrice(ZERO_VALUE_CURVE_PRICE_CONFIG_BYTES, domainName, true),
      ];

      await validateUpgrade(deployer, zns.rootRegistrar, registrar, registrarFactory, contractCalls);
    });
  });
});
