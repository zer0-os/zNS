import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  normalizeName,
  validateUpgrade,
  AccessType,
  OwnerOf,
  PaymentType,
  getAccessRevertMsg,
  hashDomainLabel,
  DEFAULT_TOKEN_URI,
  distrConfigEmpty,
  INVALID_LENGTH_ERR,
  INITIALIZED_ERR,
  INVALID_TOKENID_ERC_ERR,
  REGISTRAR_ROLE,
  DEFAULT_PRECISION_MULTIPLIER,
  DEFAULT_PRICE_CONFIG,
  DEFAULT_PROTOCOL_FEE_PERCENT,
  NOT_AUTHORIZED_REG_ERR,
  NOT_BOTH_OWNER_RAR_ERR,
  NOT_TOKEN_OWNER_RAR_ERR,
  ONLY_NAME_OWNER_REG_ERR,
  ONLY_OWNER_REGISTRAR_REG_ERR,
  INVALID_NAME_ERR,
  paymentConfigEmpty,
} from "./helpers";
import { IDistributionConfig } from "./helpers/types";
import * as ethers from "ethers";
import { defaultRootRegistration } from "./helpers/register-setup";
import { checkBalance } from "./helpers/balances";
import { getPriceObject, getStakingOrProtocolFee } from "./helpers/pricing";
import { getDomainHashFromEvent } from "./helpers/events";
import { IDeployCampaignConfig, TZNSContractState } from "../src/deploy/campaign/types";
import { ADMIN_ROLE, GOVERNOR_ROLE } from "../src/deploy/constants";
import {
  IERC20,
  ZNSRootRegistrar,
  ZNSRootRegistrar__factory,
  ZNSRootRegistrarUpgradeMock__factory,
} from "../typechain";
import { PaymentConfigStruct } from "../typechain/contracts/treasury/IZNSTreasury";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { getProxyImplAddress } from "./helpers/utils";
import { upgrades } from "hardhat";
import { MongoDBAdapter } from "../src/deploy/db/mongo-adapter/mongo-adapter";
import { getConfig } from "../src/deploy/campaign/environments";

require("@nomicfoundation/hardhat-chai-matchers");


// This is the only test converted to use the new Campaign, other
// contract specific tests are using `deployZNS()` helper
describe("ZNSRootRegistrar", () => {
  let deployer : SignerWithAddress;
  let user : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let randomUser : SignerWithAddress;

  let zns : TZNSContractState;
  let zeroVault : SignerWithAddress;
  let operator : SignerWithAddress;
  let userBalanceInitial : bigint;

  let mongoAdapter : MongoDBAdapter;

  const defaultDomain = normalizeName("wilder");

  beforeEach(async () => {
    // zeroVault address is used to hold the fee charged to the user when registering
    [deployer, zeroVault, user, operator, governor, admin, randomUser] = await hre.ethers.getSigners();

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
  });

  it("Sets the payment config when provided with the domain registration", async () => {
    const tokenURI = "https://example.com/817c64af";
    const distrConfig : IDistributionConfig = {
      pricerContract: await zns.curvePricer.getAddress(),
      paymentType: PaymentType.STAKE,
      accessType: AccessType.OPEN,
    };

    await zns.rootRegistrar.connect(user).registerRootDomain(
      defaultDomain,
      await zns.addressResolver.getAddress(),
      tokenURI,
      distrConfig,
      {
        token: await zns.meowToken.getAddress(),
        beneficiary: user.address,
      }
    );

    const domainHash = hashDomainLabel(defaultDomain);
    const config = await zns.treasury.paymentConfigs(domainHash);
    expect(config.token).to.eq(await zns.meowToken.getAddress());
    expect(config.beneficiary).to.eq(user.address);
  });

  it("Does not set the payment config when the beneficiary is the zero address", async () => {
    const tokenURI = "https://example.com/817c64af";
    const distrConfig : IDistributionConfig = {
      pricerContract: await zns.curvePricer.getAddress(),
      paymentType: PaymentType.STAKE,
      accessType: AccessType.OPEN,
    };

    await zns.rootRegistrar.connect(user).registerRootDomain(
      defaultDomain,
      await zns.addressResolver.getAddress(),
      tokenURI,
      distrConfig,
      paymentConfigEmpty
    );

    const domainHash = hashDomainLabel(defaultDomain);
    const config = await zns.treasury.paymentConfigs(domainHash);
    expect(config.token).to.eq(ethers.ZeroAddress);
    expect(config.beneficiary).to.eq(ethers.ZeroAddress);
  });

  it("Gas tests", async () => {
    const tokenURI = "https://example.com/817c64af";
    const distrConfig : IDistributionConfig = {
      pricerContract: await zns.curvePricer.getAddress(),
      paymentType: PaymentType.STAKE,
      accessType: AccessType.OPEN,
    };

    await zns.rootRegistrar.connect(deployer).registerRootDomain(
      defaultDomain,
      deployer.address,
      tokenURI,
      distrConfig,
      {
        token: ethers.ZeroAddress,
        beneficiary: ethers.ZeroAddress,
      }
    );

    const domainHash = await getDomainHashFromEvent({
      zns,
      user: deployer,
    });

    // Registering as deployer (owner of parent) and user is different gas values
    await zns.subRegistrar.connect(deployer).registerSubdomain(
      domainHash,
      "subdomain",
      deployer.address,
      tokenURI,
      distrConfigEmpty,
      paymentConfigEmpty,
    );

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

    await zns.subRegistrar.updateMintlistForDomain(
      domainHash,
      candidates,
      allowed
    );
  });

  it("Should NOT initialize the implementation contract", async () => {
    const factory = new ZNSRootRegistrar__factory(deployer);
    const impl = await getProxyImplAddress(await zns.rootRegistrar.getAddress());
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const implContract = factory.attach(impl) as ZNSRootRegistrar;

    await expect(
      implContract.initialize(
        operator.address,
        operator.address,
        operator.address,
        operator.address,
        operator.address,
      )
    ).to.be.revertedWith(INITIALIZED_ERR);
  });

  it("Allows transfer of 0x0 domain ownership after deployment", async () => {
    await zns.registry.updateDomainOwner(ethers.ZeroHash, user.address);
    expect(await zns.registry.getDomainOwner(ethers.ZeroHash)).to.equal(user.address);
  });

  it("Confirms a new 0x0 owner can modify the configs in the treasury and curve pricer", async () => {
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
    const newPricerConfig = {
      baseLength: BigInt("6"),
      maxLength: BigInt("35"),
      maxPrice: ethers.parseEther("150"),
      minPrice: ethers.parseEther("10"),
      precisionMultiplier: DEFAULT_PRECISION_MULTIPLIER,
      feePercentage: DEFAULT_PROTOCOL_FEE_PERCENT,
      isSet: true,
    };

    const pricerTx = await zns.curvePricer.connect(user).setPriceConfig(
      ethers.ZeroHash,
      newPricerConfig,
    );

    await expect(pricerTx).to.emit(zns.curvePricer, "PriceConfigSet").withArgs(
      ethers.ZeroHash,
      newPricerConfig.maxPrice,
      newPricerConfig.minPrice,
      newPricerConfig.maxLength,
      newPricerConfig.baseLength,
      newPricerConfig.precisionMultiplier,
      newPricerConfig.feePercentage,
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

    const tx = upgrades.deployProxy(
      registrarFactory,
      [
        await zns.accessController.getAddress(),
        await zns.registry.getAddress(),
        await zns.curvePricer.getAddress(),
        await zns.treasury.getAddress(),
        await zns.domainToken.getAddress(),
      ],
      {
        kind: "uups",
      }
    );

    await expect(tx).to.be.revertedWith(getAccessRevertMsg(user.address, ADMIN_ROLE));
  });

  it("Should NOT initialize twice", async () => {
    const tx = zns.rootRegistrar.connect(deployer).initialize(
      await zns.accessController.getAddress(),
      randomUser.address,
      randomUser.address,
      randomUser.address,
      randomUser.address,
    );

    await expect(tx).to.be.revertedWith("Initializable: contract is already initialized");
  });

  describe("General functionality", () => {
    it("#coreRegister() should revert if called by address without REGISTRAR_ROLE", async () => {
      const isRegistrar = await zns.accessController.hasRole(REGISTRAR_ROLE, randomUser.address);
      expect(isRegistrar).to.be.false;

      await expect(
        zns.rootRegistrar.connect(randomUser).coreRegister({
          parentHash: ethers.ZeroHash,
          domainHash: ethers.ZeroHash,
          label: "randomname",
          registrant: ethers.ZeroAddress,
          price: "0",
          stakeFee: "0",
          domainAddress: ethers.ZeroAddress,
          tokenURI: "",
          isStakePayment: false,
          paymentConfig: paymentConfigEmpty,
        })
      ).to.be.revertedWith(
        getAccessRevertMsg(randomUser.address, REGISTRAR_ROLE)
      );
    });

    it("#isOwnerOf() returns correct bools", async () => {
      await defaultRootRegistration({
        user,
        zns,
        domainName: defaultDomain,
      });
      const domainHash = await getDomainHashFromEvent({
        zns,
        user,
      });
      const tokenId = BigInt(domainHash);

      const isOwnerOfBothUser = await zns.rootRegistrar.isOwnerOf(
        domainHash,
        user.address,
        OwnerOf.BOTH
      );
      expect(isOwnerOfBothUser).to.be.true;

      const isOwnerOfBothRandom = await zns.rootRegistrar.isOwnerOf(
        domainHash,
        randomUser.address,
        OwnerOf.BOTH
      );
      expect(isOwnerOfBothRandom).to.be.false;

      // transfer token
      await zns.domainToken.connect(user).transferFrom(user.address, randomUser.address, tokenId);
      const isOwnerOfTokenUser = await zns.rootRegistrar.isOwnerOf(
        domainHash,
        user.address,
        OwnerOf.TOKEN
      );
      expect(isOwnerOfTokenUser).to.be.false;

      const isOwnerOfTokenRandom = await zns.rootRegistrar.isOwnerOf(
        domainHash,
        randomUser.address,
        OwnerOf.TOKEN
      );
      expect(isOwnerOfTokenRandom).to.be.true;

      const isOwnerOfNameUser = await zns.rootRegistrar.isOwnerOf(
        domainHash,
        user.address,
        OwnerOf.NAME
      );
      expect(isOwnerOfNameUser).to.be.true;

      const isOwnerOfNameRandom = await zns.rootRegistrar.isOwnerOf(
        domainHash,
        randomUser.address,
        OwnerOf.NAME
      );
      expect(isOwnerOfNameRandom).to.be.false;

      await expect(
        zns.rootRegistrar.isOwnerOf(domainHash, user.address, 3)
      ).to.be.reverted;
    });

    it("#setSubRegistrar() should revert if called by address without ADMIN_ROLE", async () => {
      const isAdmin = await zns.accessController.hasRole(ADMIN_ROLE, randomUser.address);
      expect(isAdmin).to.be.false;

      await expect(
        zns.rootRegistrar.connect(randomUser).setSubRegistrar(randomUser.address)
      ).to.be.revertedWith(
        getAccessRevertMsg(randomUser.address, ADMIN_ROLE)
      );
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
      ).to.be.revertedWith(
        "ZNSRootRegistrar: subRegistrar_ is 0x0 address"
      );
    });
  });

  describe("Registers a root domain", () => {
    it("Can NOT register a TLD with an empty name", async () => {
      const emptyName = "";

      await expect(
        defaultRootRegistration({
          user: deployer,
          zns,
          domainName: emptyName,
        })
      ).to.be.revertedWith(INVALID_LENGTH_ERR);
    });

    it("Can register a TLD with characters [a-z0-9-]", async () => {
      const letters = "world";
      const lettersHash = hashDomainLabel(letters);

      const alphaNumeric = "0x0dwidler0x0";
      const alphaNumericHash = hashDomainLabel(alphaNumeric);

      const withHyphen = "0x0-dwidler-0x0";
      const withHyphenHash = hashDomainLabel(withHyphen);

      const tx1 = zns.rootRegistrar.connect(deployer).registerRootDomain(
        letters,
        ethers.ZeroAddress,
        DEFAULT_TOKEN_URI,
        distrConfigEmpty,
        {
          token: ethers.ZeroAddress,
          beneficiary: ethers.ZeroAddress,
        }
      );

      await expect(tx1).to.emit(zns.rootRegistrar, "DomainRegistered").withArgs(
        ethers.ZeroHash,
        lettersHash,
        letters,
        BigInt(lettersHash),
        DEFAULT_TOKEN_URI,
        deployer.address,
        ethers.ZeroAddress,
      );

      const tx2 = zns.rootRegistrar.connect(deployer).registerRootDomain(
        alphaNumeric,
        ethers.ZeroAddress,
        DEFAULT_TOKEN_URI,
        distrConfigEmpty,
        {
          token: ethers.ZeroAddress,
          beneficiary: ethers.ZeroAddress,
        }
      );

      await expect(tx2).to.emit(zns.rootRegistrar, "DomainRegistered").withArgs(
        ethers.ZeroHash,
        alphaNumericHash,
        alphaNumeric,
        BigInt(alphaNumericHash),
        DEFAULT_TOKEN_URI,
        deployer.address,
        ethers.ZeroAddress,
      );

      const tx3 = zns.rootRegistrar.connect(deployer).registerRootDomain(
        withHyphen,
        ethers.ZeroAddress,
        DEFAULT_TOKEN_URI,
        distrConfigEmpty,
        {
          token: ethers.ZeroAddress,
          beneficiary: ethers.ZeroAddress,
        }
      );

      await expect(tx3).to.emit(zns.rootRegistrar, "DomainRegistered").withArgs(
        ethers.ZeroHash,
        withHyphenHash,
        withHyphen,
        BigInt(withHyphenHash),
        DEFAULT_TOKEN_URI,
        deployer.address,
        ethers.ZeroAddress,
      );
    });

    it("Fails for domains that use any invalid character", async () => {
      // Valid names must match the pattern [a-z0-9]
      const nameA = "WILDER";
      const nameB = "!?w1Id3r!?";
      const nameC = "!%$#^*?!#👍3^29";
      const nameD = "wo.rld";

      await expect(
        defaultRootRegistration({
          user: deployer,
          zns,
          domainName: nameA,
        })
      ).to.be.revertedWith(INVALID_NAME_ERR);

      await expect(
        defaultRootRegistration({
          user: deployer,
          zns,
          domainName: nameB,
        })
      ).to.be.revertedWith(INVALID_NAME_ERR);

      await expect(
        defaultRootRegistration({
          user: deployer,
          zns,
          domainName: nameC,
        })
      ).to.be.revertedWith(INVALID_NAME_ERR);

      await expect(
        defaultRootRegistration({
          user: deployer,
          zns,
          domainName: nameD,
        })
      ).to.be.revertedWith(INVALID_NAME_ERR);
    });

    // eslint-disable-next-line max-len
    it("Successfully registers a domain without a resolver or resolver content and fires a #DomainRegistered event", async () => {
      const tokenURI = "https://example.com/817c64af";
      const tx = await zns.rootRegistrar.connect(user).registerRootDomain(
        defaultDomain,
        ethers.ZeroAddress,
        tokenURI,
        distrConfigEmpty,
        {
          token: ethers.ZeroAddress,
          beneficiary: ethers.ZeroAddress,
        }
      );

      const hashFromTS = hashDomainLabel(defaultDomain);

      await expect(tx).to.emit(zns.rootRegistrar, "DomainRegistered").withArgs(
        ethers.ZeroHash,
        hashFromTS,
        defaultDomain,
        BigInt(hashFromTS),
        tokenURI,
        user.address,
        ethers.ZeroAddress,
      );

      const tokenURISC = await zns.domainToken.tokenURI(hashFromTS);
      expect(tokenURISC).to.eq(tokenURI);
    });

    it("Successfully registers a domain with distrConfig and adds it to state properly", async () => {
      const distrConfig = {
        pricerContract: await zns.fixedPricer.getAddress(),
        accessType: AccessType.OPEN,
        paymentType: PaymentType.DIRECT,
      };
      const tokenURI = "https://example.com/817c64af";

      await zns.rootRegistrar.connect(user).registerRootDomain(
        defaultDomain,
        ethers.ZeroAddress,
        tokenURI,
        distrConfig,
        {
          token: ethers.ZeroAddress,
          beneficiary: ethers.ZeroAddress,
        }
      );

      const domainHash = await getDomainHashFromEvent({
        zns,
        user,
      });

      const {
        pricerContract,
        accessType,
        paymentType,
      } = await zns.subRegistrar.distrConfigs(domainHash);

      expect(pricerContract).to.eq(distrConfig.pricerContract);
      expect(paymentType).to.eq(distrConfig.paymentType);
      expect(accessType).to.eq(distrConfig.accessType);

      const tokenURISC = await zns.domainToken.tokenURI(domainHash);
      expect(tokenURISC).to.eq(tokenURI);
    });

    it("Stakes and saves the correct amount and token, takes the correct fee and sends fee to Zero Vault", async () => {
      const balanceBeforeUser = await zns.meowToken.balanceOf(user.address);
      const balanceBeforeVault = await zns.meowToken.balanceOf(zeroVault.address);

      // Deploy "wilder" with default configuration
      await defaultRootRegistration({
        user,
        zns,
        domainName: defaultDomain,
      });
      const domainHash = await getDomainHashFromEvent({
        zns,
        user,
      });

      const {
        totalPrice,
        expectedPrice,
        stakeFee,
      } = getPriceObject(defaultDomain, DEFAULT_PRICE_CONFIG);

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

      const { amount: staked, token } = await zns.treasury.stakedForDomain(domainHash);

      expect(staked).to.eq(expectedPrice);
      expect(token).to.eq(await zns.meowToken.getAddress());
    });

    it("Sets the correct data in Registry", async () => {
      await defaultRootRegistration({
        user,
        zns,
        domainName: defaultDomain,
      });

      const namehashRef = hashDomainLabel(defaultDomain);
      const domainHash = await getDomainHashFromEvent({
        zns,
        user,
      });

      expect(domainHash).to.eq(namehashRef);

      const {
        owner: ownerFromReg,
        resolver: resolverFromReg,
      } = await zns.registry.getDomainRecord(domainHash);

      expect(ownerFromReg).to.eq(user.address);
      expect(resolverFromReg).to.eq(await zns.addressResolver.getAddress());
    });

    it("Fails when the user does not have enough funds", async () => {
      const balance = await zns.meowToken.balanceOf(user.address);
      await zns.meowToken.connect(user).transfer(randomUser.address, balance);

      const tx = defaultRootRegistration({
        user,
        zns,
        domainName: defaultDomain,
      });
      await expect(tx).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Disallows creation of a duplicate domain", async () => {
      await defaultRootRegistration({
        user,
        zns,
        domainName: defaultDomain,
      });
      const failTx = defaultRootRegistration({
        user: deployer,
        zns,
        domainName: defaultDomain,
      });

      await expect(failTx).to.be.revertedWith("ZNSRootRegistrar: Domain already exists");
    });

    it("Successfully registers a domain without resolver content", async () => {
      const tx = zns.rootRegistrar.connect(user).registerRootDomain(
        defaultDomain,
        ethers.ZeroAddress,
        DEFAULT_TOKEN_URI,
        distrConfigEmpty,
        {
          token: ethers.ZeroAddress,
          beneficiary: ethers.ZeroAddress,
        }
      );

      await expect(tx).to.not.be.reverted;
    });

    it("Records the correct domain hash", async () => {
      await defaultRootRegistration({
        user,
        zns,
        domainName: defaultDomain,
      });

      const domainHash = await getDomainHashFromEvent({
        zns,
        user,
      });

      const exists = await zns.registry.exists(domainHash);
      expect(exists).to.be.true;
      expect(domainHash).to.eq(hashDomainLabel(defaultDomain));
    });

    it("Creates and finds the correct tokenId", async () => {
      await defaultRootRegistration({
        user,
        zns,
        domainName: defaultDomain,
      });

      const tokenId = BigInt(
        await getDomainHashFromEvent({
          zns,
          user,
        })
      );
      const owner = await zns.domainToken.ownerOf(tokenId);
      expect(owner).to.eq(user.address);
    });

    it("Resolves the correct address from the domain", async () => {
      await defaultRootRegistration({
        user,
        zns,
        domainName: defaultDomain,
        domainContent: await zns.rootRegistrar.getAddress(),
      });
      const domainHash = await getDomainHashFromEvent({
        zns,
        user,
      });

      const resolvedAddress = await zns.addressResolver.resolveDomainAddress(domainHash);
      expect(resolvedAddress).to.eq(await zns.rootRegistrar.getAddress());
    });

    it("Should NOT charge any tokens if price and/or stake fee is 0", async () => {
      // set config on CurvePricer for the price to be 0
      await zns.curvePricer.connect(deployer).setMaxPrice(ethers.ZeroHash, "0");
      await zns.curvePricer.connect(deployer).setMinPrice(ethers.ZeroHash, "0");

      const userBalanceBefore = await zns.meowToken.balanceOf(user.address);
      const vaultBalanceBefore = await zns.meowToken.balanceOf(zeroVault.address);

      // register a domain
      await zns.rootRegistrar.connect(user).registerRootDomain(
        defaultDomain,
        ethers.ZeroAddress,
        DEFAULT_TOKEN_URI,
        distrConfigEmpty,
        {
          token: ethers.ZeroAddress,
          beneficiary: ethers.ZeroAddress,
        }
      );

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
  });

  describe("Reclaiming Domains", () => {
    it("Can reclaim name/stake if Token is owned", async () => {
      // Register Top level
      await defaultRootRegistration({ user: deployer, zns, domainName: defaultDomain });
      const domainHash = await getDomainHashFromEvent({
        zns,
        user: deployer,
      });
      const tokenId = BigInt(domainHash);
      const { amount: staked, token } = await zns.treasury.stakedForDomain(domainHash);

      // Transfer the domain token
      await zns.domainToken.connect(deployer).transferFrom(deployer.address, user.address, tokenId);

      // Verify owner in registry
      const originalOwner = await zns.registry.connect(deployer).getDomainOwner(domainHash);
      expect(originalOwner).to.equal(deployer.address);

      // Reclaim the Domain
      await zns.rootRegistrar.connect(user).reclaimDomain(domainHash);

      // Verify domain token is still owned
      const owner = await zns.domainToken.connect(user).ownerOf(tokenId);
      expect(owner).to.equal(user.address);

      // Verify domain is owned in registry
      const registryOwner = await zns.registry.connect(user).getDomainOwner(domainHash);
      expect(registryOwner).to.equal(user.address);

      // Verify same amount is staked
      const { amount: stakedAfterReclaim, token: tokenAfterReclaim } = await zns.treasury.stakedForDomain(domainHash);
      expect(staked).to.equal(stakedAfterReclaim);
      expect(tokenAfterReclaim).to.equal(await zns.meowToken.getAddress());
      expect(token).to.equal(tokenAfterReclaim);
    });

    it("Reclaiming domain token emits DomainReclaimed event", async () => {
      await defaultRootRegistration({ user: deployer, zns, domainName: defaultDomain });
      const domainHash = await getDomainHashFromEvent({
        zns,
        user: deployer,
      });
      const tokenId = BigInt(domainHash);

      // Transfer the domain token
      await zns.domainToken.connect(deployer).transferFrom(deployer.address, user.address, tokenId);
      // Reclaim the Domain
      const tx = zns.rootRegistrar.connect(user).reclaimDomain(domainHash);
      await expect(tx).to.emit(zns.rootRegistrar, "DomainReclaimed").withArgs(
        domainHash,
        user.address
      );
    });

    it("Cannot reclaim name/stake if token is not owned", async () => {
      await defaultRootRegistration({ user: deployer, zns, domainName: defaultDomain });
      const domainHash = await getDomainHashFromEvent({
        zns,
        user: deployer,
      });
      // Reclaim the Domain
      const tx = zns.rootRegistrar.connect(user).reclaimDomain(domainHash);

      // Verify Domain is not reclaimed
      await expect(tx).to.be.revertedWith(NOT_TOKEN_OWNER_RAR_ERR);

      // Verify domain is not owned in registrar
      const registryOwner = await zns.registry.connect(user).getDomainOwner(domainHash);
      expect(registryOwner).to.equal(deployer.address);
    });

    it("Cannot reclaim if domain does not exist", async () => {
      const domainHash = "0xd34cfa279afd55afc6aa9c00aa5d01df60179840a93d10eed730058b8dd4146c";
      // Reclaim the Domain
      const tx = zns.rootRegistrar.connect(user).reclaimDomain(domainHash);

      // Verify Domain is not reclaimed
      await expect(tx).to.be.revertedWith(INVALID_TOKENID_ERC_ERR);
    });

    it("Domain Token can be reclaimed, transferred, and then reclaimed again", async () => {
      // Register Top level
      await defaultRootRegistration({ user: deployer, zns, domainName: defaultDomain });
      const domainHash = await getDomainHashFromEvent({
        zns,
        user: deployer,
      });
      const tokenId = BigInt(domainHash);
      const { amount: staked, token } = await zns.treasury.stakedForDomain(domainHash);

      // Transfer the domain token
      await zns.domainToken.connect(deployer).transferFrom(deployer.address, user.address, tokenId);

      // Reclaim the Domain
      await zns.rootRegistrar.connect(user).reclaimDomain(domainHash);
      // Verify domain token is still owned
      let owner = await zns.domainToken.connect(user).ownerOf(tokenId);
      expect(owner).to.equal(user.address);

      // Transfer the domain token back
      await zns.domainToken.connect(user).transferFrom(user.address, deployer.address, tokenId);

      // Reclaim the Domain again
      await zns.rootRegistrar.connect(deployer).reclaimDomain(domainHash);

      // Verify domain token is owned
      owner = await zns.domainToken.connect(deployer).ownerOf(tokenId);
      expect(owner).to.equal(deployer.address);

      // Verify domain is owned in registrar
      const registryOwner = await zns.registry.connect(deployer).getDomainOwner(domainHash);
      expect(registryOwner).to.equal(deployer.address);

      // Verify same amount is staked
      const { amount: stakedAfterReclaim, token: tokenAfterReclaim } = await zns.treasury.stakedForDomain(domainHash);
      expect(staked).to.equal(stakedAfterReclaim);
      expect(tokenAfterReclaim).to.equal(await zns.meowToken.getAddress());
      expect(token).to.equal(tokenAfterReclaim);
    });

    it("Can revoke and unstake after reclaiming", async () => {
      // Verify Balance
      const balance = await zns.meowToken.balanceOf(user.address);
      expect(balance).to.eq(userBalanceInitial);

      // Register Top level
      await defaultRootRegistration({ user: deployer, zns, domainName: defaultDomain });
      const domainHash = await getDomainHashFromEvent({
        zns,
        user: deployer,
      });
      const tokenId = BigInt(domainHash);

      // Validated staked values
      const {
        expectedPrice: expectedStaked,
      } = getPriceObject(defaultDomain, DEFAULT_PRICE_CONFIG);
      const { amount: staked, token } = await zns.treasury.stakedForDomain(domainHash);
      expect(staked).to.eq(expectedStaked);
      expect(token).to.eq(await zns.meowToken.getAddress());

      // Transfer the domain token
      await zns.domainToken.connect(deployer).transferFrom(deployer.address, user.address, tokenId);

      // Reclaim the Domain
      await zns.rootRegistrar.connect(user).reclaimDomain(domainHash);

      // Revoke the Domain
      await zns.rootRegistrar.connect(user).revokeDomain(domainHash);

      // Validated funds are unstaked
      const { amount: finalstaked, token: finalToken } = await zns.treasury.stakedForDomain(domainHash);
      expect(finalstaked).to.equal(BigInt("0"));
      expect(finalToken).to.equal(ethers.ZeroAddress);

      const protocolFee = getStakingOrProtocolFee(staked);

      // Verify final balances
      const computedFinalBalance = balance + staked - protocolFee;
      const finalBalance = await zns.meowToken.balanceOf(user.address);
      expect(computedFinalBalance).to.equal(finalBalance);
    });
  });

  describe("Revoking Domains", () => {
    it("Charges a protocol fee to the owner as part of the revoke flow", async () => {
      await defaultRootRegistration({
        user,
        zns,
        domainName: defaultDomain,
        distrConfig: {
          pricerContract: await zns.curvePricer.getAddress(),
          paymentType: PaymentType.STAKE,
          accessType: AccessType.OPEN,
        },
      });

      const domainHash = await getDomainHashFromEvent({
        zns,
        user,
      });

      const price = await zns.curvePricer.getPrice(ethers.ZeroHash, defaultDomain, false);
      const protocolFee = await zns.curvePricer.getFeeForPrice(ethers.ZeroHash, price);

      const balanceBefore = await zns.meowToken.balanceOf(user.address);

      // is revoke meant to be free if owner of parent? register subdomain is
      await zns.rootRegistrar.connect(user).revokeDomain(domainHash);

      const balanceAfter = await zns.meowToken.balanceOf(user.address);

      expect(balanceAfter).to.eq(balanceBefore + price - protocolFee);
    });

    it("Revokes a Top level Domain, locks distribution and removes mintlist", async () => {
      // Register Top level
      await defaultRootRegistration({
        user,
        zns,
        domainName: defaultDomain,
        distrConfig: {
          pricerContract: await zns.fixedPricer.getAddress(),
          paymentType: PaymentType.DIRECT,
          accessType: AccessType.OPEN,
        },
      });

      const domainHash = await getDomainHashFromEvent({
        zns,
        user,
      });

      // add mintlist to check revocation
      await zns.subRegistrar.connect(user).updateMintlistForDomain(
        domainHash,
        [user.address, zeroVault.address],
        [true, true]
      );

      const ogPrice = BigInt(135);
      await zns.fixedPricer.connect(user).setPriceConfig(
        domainHash,
        {
          price: ogPrice,
          feePercentage: BigInt(0),
          isSet: true,
        }
      );
      expect(await zns.fixedPricer.getPrice(domainHash, defaultDomain, false)).to.eq(ogPrice);

      const tokenId = BigInt(
        await getDomainHashFromEvent({
          zns,
          user,
        })
      );

      // Revoke the domain and then verify
      await zns.rootRegistrar.connect(user).revokeDomain(domainHash);

      // Verify token has been burned
      const ownerOfTx = zns.domainToken.connect(user).ownerOf(tokenId);
      await expect(ownerOfTx).to.be.revertedWith(
        INVALID_TOKENID_ERC_ERR
      );

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
      await expect(tx).to.be.revertedWith(NOT_BOTH_OWNER_RAR_ERR);
    });

    it("Revoking domain unstakes", async () => {
      // Verify Balance
      const balance = await zns.meowToken.balanceOf(user.address);
      expect(balance).to.eq(userBalanceInitial);

      // Register Top level
      await defaultRootRegistration({ user, zns, domainName: defaultDomain });
      const domainHash = await getDomainHashFromEvent({
        zns,
        user,
      });

      // Validated staked values
      const {
        expectedPrice: expectedStaked,
        stakeFee: expectedStakeFee,
      } = getPriceObject(defaultDomain, DEFAULT_PRICE_CONFIG);
      const { amount: staked, token } = await zns.treasury.stakedForDomain(domainHash);
      expect(staked).to.eq(expectedStaked);
      expect(token).to.eq(await zns.meowToken.getAddress());

      // Get balance after staking
      const balanceAfterStaking = await zns.meowToken.balanceOf(user.address);

      // Revoke the domain
      await zns.rootRegistrar.connect(user).revokeDomain(domainHash);


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
      await defaultRootRegistration({ user: deployer, zns, domainName: defaultDomain });
      const parentDomainHash = await getDomainHashFromEvent({
        zns,
        user: deployer,
      });
      const owner = await zns.registry.connect(user).getDomainOwner(parentDomainHash);
      expect(owner).to.not.equal(user.address);

      // Try to revoke domain
      const tx = zns.rootRegistrar.connect(user).revokeDomain(parentDomainHash);
      await expect(tx).to.be.revertedWith(NOT_BOTH_OWNER_RAR_ERR);
    });

    it("No one can revoke if Token and Name have different owners", async () => {
      // Register Top level
      await defaultRootRegistration({ user: deployer, zns, domainName: defaultDomain });
      const parentDomainHash = await getDomainHashFromEvent({
        zns,
        user: deployer,
      });
      const owner = await zns.registry.connect(user).getDomainOwner(parentDomainHash);
      expect(owner).to.not.equal(user.address);

      const tokenId = BigInt(parentDomainHash);

      await zns.domainToken.transferFrom(deployer.address, user.address, tokenId);

      // Try to revoke domain as a new owner of the token
      const tx = zns.rootRegistrar.connect(user).revokeDomain(parentDomainHash);
      await expect(tx).to.be.revertedWith(NOT_BOTH_OWNER_RAR_ERR);

      const tx2 = zns.rootRegistrar.connect(deployer).revokeDomain(parentDomainHash);
      await expect(tx2).to.be.revertedWith(NOT_BOTH_OWNER_RAR_ERR);
    });

    it("After domain has been revoked, an old operator can NOT access Registry", async () => {
      // Register Top level
      await defaultRootRegistration({ user, zns, domainName: defaultDomain });
      const domainHash = await getDomainHashFromEvent({
        zns,
        user,
      });

      // assign an operator
      await zns.registry.connect(user).setOwnersOperator(operator.address, true);

      // Revoke the domain
      await zns.rootRegistrar.connect(user).revokeDomain(domainHash);

      // check operator access to the revoked domain
      const tx2 = zns.registry
        .connect(operator)
        .updateDomainOwner(
          domainHash,
          operator.address
        );
      await expect(tx2).to.be.revertedWith(
        ONLY_OWNER_REGISTRAR_REG_ERR
      );

      const tx3 = zns.registry
        .connect(operator)
        .updateDomainRecord(
          domainHash,
          user.address,
          operator.address
        );
      await expect(tx3).to.be.revertedWith(
        ONLY_NAME_OWNER_REG_ERR
      );

      const tx4 = zns.registry
        .connect(operator)
        .updateDomainResolver(
          domainHash,
          zeroVault.address
        );
      await expect(tx4).to.be.revertedWith(
        NOT_AUTHORIZED_REG_ERR
      );
    });
  });

  describe("State Setters", () => {
    describe("#setAccessController", () => {
      it("Should set AccessController and fire AccessControllerSet event", async () => {
        const currentAC = await zns.rootRegistrar.getAccessController();
        const tx = await zns.rootRegistrar.connect(deployer).setAccessController(randomUser.address);
        const newAC = await zns.rootRegistrar.getAccessController();

        await expect(tx).to.emit(zns.rootRegistrar, "AccessControllerSet").withArgs(randomUser.address);

        expect(newAC).to.equal(randomUser.address);
        expect(currentAC).to.not.equal(newAC);
      });

      it("Should revert if not called by ADMIN", async () => {
        const tx = zns.rootRegistrar.connect(user).setAccessController(randomUser.address);
        await expect(tx).to.be.revertedWith(
          getAccessRevertMsg(user.address, ADMIN_ROLE)
        );
      });

      it("Should revert if new AccessController is address zero", async () => {
        const tx = zns.rootRegistrar.connect(deployer).setAccessController(ethers.ZeroAddress);
        await expect(tx).to.be.revertedWith("AC: _accessController is 0x0 address");
      });
    });

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
        await expect(tx).to.be.revertedWith(
          getAccessRevertMsg(user.address, ADMIN_ROLE)
        );
      });

      it("Should revert if ZNSRegistry is address zero", async () => {
        const tx = zns.rootRegistrar.connect(deployer).setRegistry(ethers.ZeroAddress);
        await expect(tx).to.be.revertedWith("ARegistryWired: _registry can not be 0x0 address");
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
        await expect(tx).to.be.revertedWith(
          getAccessRevertMsg(user.address, ADMIN_ROLE)
        );
      });

      it("Should revert if Treasury is address zero", async () => {
        const tx = zns.rootRegistrar.connect(deployer).setTreasury(ethers.ZeroAddress);
        await expect(tx).to.be.revertedWith("ZNSRootRegistrar: treasury_ is 0x0 address");
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
        await expect(tx).to.be.revertedWith(
          getAccessRevertMsg(user.address, ADMIN_ROLE)
        );
      });

      it("Should revert if DomainToken is address zero", async () => {
        const tx = zns.rootRegistrar.connect(deployer).setDomainToken(ethers.ZeroAddress);
        await expect(tx).to.be.revertedWith("ZNSRootRegistrar: domainToken_ is 0x0 address");
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

      const upgradeTx = zns.rootRegistrar.connect(deployer).upgradeTo(await registrar.getAddress());
      await expect(upgradeTx).to.not.be.reverted;
    });

    it("Fails to upgrade when an unauthorized users calls", async () => {
      const registrarFactory = new ZNSRootRegistrar__factory(deployer);
      const registrar = await registrarFactory.deploy();
      await registrar.waitForDeployment();

      const tx = zns.rootRegistrar.connect(randomUser).upgradeTo(await registrar.getAddress());

      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(randomUser.address, GOVERNOR_ROLE)
      );
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
      await zns.meowToken.mint(randomUser.address, DEFAULT_PRICE_CONFIG.maxPrice);

      await zns.rootRegistrar.connect(randomUser).registerRootDomain(
        domainName,
        randomUser.address,
        DEFAULT_TOKEN_URI,
        distrConfigEmpty,
        {
          token: ethers.ZeroAddress,
          beneficiary: ethers.ZeroAddress,
        }
      );


      const contractCalls = [
        zns.rootRegistrar.getAccessController(),
        zns.rootRegistrar.registry(),
        zns.rootRegistrar.treasury(),
        zns.rootRegistrar.domainToken(),
        zns.registry.exists(domainHash),
        zns.treasury.stakedForDomain(domainHash),
        zns.domainToken.name(),
        zns.domainToken.symbol(),
        zns.curvePricer.getPrice(ethers.ZeroHash, domainName, false),
      ];

      await validateUpgrade(deployer, zns.rootRegistrar, registrar, registrarFactory, contractCalls);
    });
  });
});
