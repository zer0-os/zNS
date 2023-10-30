import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  AccessType, defaultTokenURI,
  deployZNS,
  distrConfigEmpty,
  hashDomainLabel,
  INVALID_TOKENID_ERC_ERR,
  normalizeName,
  NOT_AUTHORIZED_REG_ERR,
  NOT_BOTH_OWNER_RAR_ERR,
  NOT_TOKEN_OWNER_RAR_ERR,
  ONLY_NAME_OWNER_REG_ERR,
  ONLY_OWNER_REGISTRAR_REG_ERR, OwnerOf, PaymentType, REGISTRAR_ROLE,
  validateUpgrade,
} from "./helpers";
import { IDistributionConfig, IZNSContracts } from "./helpers/types";
import * as ethers from "ethers";
import { BigNumber } from "ethers";
import { defaultRootRegistration } from "./helpers/register-setup";
import { checkBalance } from "./helpers/balances";
import { precisionMultiDefault, priceConfigDefault, registrationFeePercDefault } from "./helpers/constants";
import { getPriceObject } from "./helpers/pricing";
import { getDomainHashFromReceipt, getTokenIdFromReceipt } from "./helpers/events";
import { getAccessRevertMsg, INVALID_NAME_ERR } from "./helpers/errors";
import { ADMIN_ROLE, GOVERNOR_ROLE } from "./helpers/access";
import { ZNSRootRegistrar__factory, ZNSRootRegistrarUpgradeMock__factory } from "../typechain";
import { PaymentConfigStruct } from "../typechain/contracts/treasury/IZNSTreasury";
// import { ICurvePriceConfig } from "../typechain/contracts/price/IZNSCurvePricer";
import { parseEther } from "ethers/lib/utils";

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
  const defaultDomain = normalizeName("wilder");
  let userBalanceInitial : BigNumber;

  beforeEach(async () => {
    [deployer, zeroVault, user, operator, governor, admin, randomUser] = await hre.ethers.getSigners();
    // zeroVault address is used to hold the fee charged to the user when registering
    zns = await deployZNS({
      deployer,
      governorAddresses: [deployer.address, governor.address],
      adminAddresses: [admin.address],
      priceConfig: priceConfigDefault,
      zeroVaultAddress: zeroVault.address,
    });

    userBalanceInitial = ethers.utils.parseEther("100000000000");
    // Give funds to user
    await zns.zeroToken.connect(user).approve(zns.treasury.address, ethers.constants.MaxUint256);
    await zns.zeroToken.mint(user.address, userBalanceInitial);
  });

  it("Gas tests", async () => {
    const tokenURI = "https://example.com/817c64af";
    const distrConfig : IDistributionConfig = {
      pricerContract: zns.curvePricer.address,
      paymentType: 1,
      accessType: 1,
    };

    const tx = await zns.rootRegistrar.connect(deployer).registerRootDomain(
      defaultDomain,
      deployer.address,
      tokenURI,
      distrConfig
    );

    const receipt = await tx.wait();

    const domainHash = await getDomainHashFromReceipt(receipt);

    // Registering as deployer (owner of parent) and user is different gas values
    await zns.subRegistrar.connect(deployer).registerSubdomain(
      domainHash,
      "subdomain",
      deployer.address,
      tokenURI,
      distrConfigEmpty
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

  it("Allows transfer of 0x0 domain ownership after deployment", async () => {
    await zns.registry.updateDomainOwner(ethers.constants.HashZero, user.address);
    expect(await zns.registry.getDomainOwner(ethers.constants.HashZero)).to.equal(user.address);
  });

  it("Confirms a new 0x0 owner can modify the configs in the treasury and curve pricer", async () => {
    await zns.registry.updateDomainOwner(ethers.constants.HashZero, user.address);

    const newTreasuryConfig : PaymentConfigStruct = {
      token: zeroVault.address, // Just needs to be a different address
      beneficiary: user.address,
    };

    // Modify the treasury
    const treasuryTx = await zns.treasury.connect(user).setPaymentConfig(ethers.constants.HashZero, newTreasuryConfig);

    await expect(treasuryTx).to.emit(
      zns.treasury,
      "BeneficiarySet"
    ).withArgs(
      ethers.constants.HashZero,
      user.address
    );
    await expect(treasuryTx).to.emit(
      zns.treasury,
      "PaymentTokenSet"
    ).withArgs(
      ethers.constants.HashZero,
      zeroVault.address
    );

    // Modify the curve pricer
    const newPricerConfig = {
      baseLength: BigNumber.from("6"),
      maxLength: BigNumber.from("35"),
      maxPrice: parseEther("150"),
      minPrice: parseEther("10"),
      precisionMultiplier: precisionMultiDefault,
      feePercentage: registrationFeePercDefault,
    };

    const pricerTx = await zns.curvePricer.connect(user).setPriceConfig(ethers.constants.HashZero, newPricerConfig);

    await expect(pricerTx).to.emit(zns.curvePricer, "PriceConfigSet").withArgs(
      ethers.constants.HashZero,
      newPricerConfig.maxPrice,
      newPricerConfig.minPrice,
      newPricerConfig.maxLength,
      newPricerConfig.baseLength,
      newPricerConfig.precisionMultiplier,
      newPricerConfig.feePercentage,
    );
  });

  it("Confirms a user has funds and allowance for the Registrar", async () => {
    const balance = await zns.zeroToken.balanceOf(user.address);
    expect(balance).to.eq(userBalanceInitial);

    const allowance = await zns.zeroToken.allowance(user.address, zns.treasury.address);
    expect(allowance).to.eq(ethers.constants.MaxUint256);
  });

  it("Should revert when initialize() without ADMIN_ROLE", async () => {
    const userHasAdmin = await zns.accessController.hasRole(ADMIN_ROLE, user.address);
    expect(userHasAdmin).to.be.false;

    const registrarFactory = new ZNSRootRegistrar__factory(deployer);
    const registrar = await registrarFactory.connect(user).deploy();
    await registrar.deployed();

    const tx = registrar.connect(user).initialize(
      zns.accessController.address,
      randomUser.address,
      randomUser.address,
      randomUser.address,
      randomUser.address,
      randomUser.address,
    );

    await expect(tx).to.be.revertedWith(getAccessRevertMsg(user.address, ADMIN_ROLE));
  });

  it("Should NOT initialize twice", async () => {
    const tx = zns.rootRegistrar.connect(deployer).initialize(
      zns.accessController.address,
      randomUser.address,
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
          parentHash: ethers.constants.HashZero,
          domainHash: ethers.constants.HashZero,
          label: "randomname",
          registrant: ethers.constants.AddressZero,
          price: "0",
          stakeFee: "0",
          domainAddress: ethers.constants.AddressZero,
          tokenURI: "",
          isStakePayment: false,
        })
      ).to.be.revertedWith(
        getAccessRevertMsg(randomUser.address, REGISTRAR_ROLE)
      );
    });

    it("#isOwnerOf() returns correct bools", async () => {
      const topLevelTx = await defaultRootRegistration({
        user,
        zns,
        domainName: defaultDomain,
      });
      const domainHash = await getDomainHashFromReceipt(topLevelTx);
      const tokenId = BigNumber.from(domainHash);

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
        zns.rootRegistrar.connect(admin).setSubRegistrar(ethers.constants.AddressZero)
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
      ).to.be.revertedWith("ZNSRootRegistrar: Domain Name not provided");
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
        ethers.constants.AddressZero,
        defaultTokenURI,
        distrConfigEmpty
      );

      await expect(tx1).to.emit(zns.rootRegistrar, "DomainRegistered").withArgs(
        ethers.constants.HashZero,
        lettersHash,
        BigNumber.from(lettersHash),
        letters,
        deployer.address,
        ethers.constants.AddressZero,
      );

      const tx2 = zns.rootRegistrar.connect(deployer).registerRootDomain(
        alphaNumeric,
        ethers.constants.AddressZero,
        defaultTokenURI,
        distrConfigEmpty
      );

      await expect(tx2).to.emit(zns.rootRegistrar, "DomainRegistered").withArgs(
        ethers.constants.HashZero,
        alphaNumericHash,
        BigNumber.from(alphaNumericHash),
        alphaNumeric,
        deployer.address,
        ethers.constants.AddressZero,
      );

      const tx3 = zns.rootRegistrar.connect(deployer).registerRootDomain(
        withHyphen,
        ethers.constants.AddressZero,
        defaultTokenURI,
        distrConfigEmpty
      );

      await expect(tx3).to.emit(zns.rootRegistrar, "DomainRegistered").withArgs(
        ethers.constants.HashZero,
        withHyphenHash,
        BigNumber.from(withHyphenHash),
        withHyphen,
        deployer.address,
        ethers.constants.AddressZero,
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
        ethers.constants.AddressZero,
        tokenURI,
        distrConfigEmpty
      );

      const hashFromTS = hashDomainLabel(defaultDomain);

      await expect(tx).to.emit(zns.rootRegistrar, "DomainRegistered").withArgs(
        ethers.constants.HashZero,
        hashFromTS,
        BigNumber.from(hashFromTS),
        defaultDomain,
        user.address,
        ethers.constants.AddressZero,
      );

      const tokenURISC = await zns.domainToken.tokenURI(hashFromTS);
      expect(tokenURISC).to.eq(tokenURI);
    });

    it("Successfully registers a domain with distrConfig and adds it to state properly", async () => {
      const distrConfig = {
        pricerContract: zns.fixedPricer.address,
        accessType: AccessType.OPEN,
        paymentType: PaymentType.DIRECT,
      };
      const tokenURI = "https://example.com/817c64af";

      const tx = await zns.rootRegistrar.connect(user).registerRootDomain(
        defaultDomain,
        ethers.constants.AddressZero,
        tokenURI,
        distrConfig
      );

      const receipt = await tx.wait(0);

      const domainHash = await getDomainHashFromReceipt(receipt);

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
      const balanceBeforeUser = await zns.zeroToken.balanceOf(user.address);
      const balanceBeforeVault = await zns.zeroToken.balanceOf(zeroVault.address);

      // Deploy "wilder" with default configuration
      const tx = await defaultRootRegistration({
        user,
        zns,
        domainName: defaultDomain,
      });
      const domainHash = await getDomainHashFromReceipt(tx);
      const {
        totalPrice,
        expectedPrice,
        stakeFee,
      } = await getPriceObject(defaultDomain, priceConfigDefault);

      await checkBalance({
        token: zns.zeroToken,
        balanceBefore: balanceBeforeUser,
        userAddress: user.address,
        target: totalPrice,
      });

      await checkBalance({
        token: zns.zeroToken,
        balanceBefore: balanceBeforeVault,
        userAddress: zeroVault.address,
        target: stakeFee,
        shouldDecrease: false,
      });

      const { amount: staked, token } = await zns.treasury.stakedForDomain(domainHash);

      expect(staked).to.eq(expectedPrice);
      expect(token).to.eq(zns.zeroToken.address);
    });

    it("Sets the correct data in Registry", async () => {
      const tx = await defaultRootRegistration({
        user,
        zns,
        domainName: defaultDomain,
      });

      const namehashRef = hashDomainLabel(defaultDomain);
      const domainHash = await getDomainHashFromReceipt(tx);
      expect(domainHash).to.eq(namehashRef);

      const {
        owner: ownerFromReg,
        resolver: resolverFromReg,
      } = await zns.registry.getDomainRecord(domainHash);

      expect(ownerFromReg).to.eq(user.address);
      expect(resolverFromReg).to.eq(zns.addressResolver.address);
    });

    it("Fails when the user does not have enough funds", async () => {
      const balance = await zns.zeroToken.balanceOf(user.address);
      await zns.zeroToken.connect(user).transfer(randomUser.address, balance);

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
        ethers.constants.AddressZero,
        defaultTokenURI,
        distrConfigEmpty
      );

      await expect(tx).to.not.be.reverted;
    });

    it("Records the correct domain hash", async () => {
      const tx = await defaultRootRegistration({
        user,
        zns,
        domainName: defaultDomain,
      });

      const domainHash = await getDomainHashFromReceipt(tx);

      const exists = await zns.registry.exists(domainHash);
      expect(exists).to.be.true;
      expect(domainHash).to.eq(hashDomainLabel(defaultDomain));
    });

    it("Creates and finds the correct tokenId", async () => {
      const tx = await defaultRootRegistration({
        user,
        zns,
        domainName: defaultDomain,
      });

      const tokenId = await getTokenIdFromReceipt(tx);
      const owner = await zns.domainToken.ownerOf(tokenId);
      expect(owner).to.eq(user.address);
    });

    it("Resolves the correct address from the domain", async () => {
      const tx = await defaultRootRegistration({
        user,
        zns,
        domainName: defaultDomain,
        domainContent: zns.rootRegistrar.address,
      });
      const domainHash = await getDomainHashFromReceipt(tx);

      const resolvedAddress = await zns.addressResolver.getAddress(domainHash);
      expect(resolvedAddress).to.eq(zns.rootRegistrar.address);
    });

    it("Should NOT charge any tokens if price and/or stake fee is 0", async () => {
      // set config on CurvePricer for the price to be 0
      await zns.curvePricer.connect(deployer).setMaxPrice(ethers.constants.HashZero, "0");
      await zns.curvePricer.connect(deployer).setMinPrice(ethers.constants.HashZero, "0");

      const userBalanceBefore = await zns.zeroToken.balanceOf(user.address);
      const vaultBalanceBefore = await zns.zeroToken.balanceOf(zeroVault.address);

      // register a domain
      await zns.rootRegistrar.connect(user).registerRootDomain(
        defaultDomain,
        ethers.constants.AddressZero,
        defaultTokenURI,
        distrConfigEmpty
      );

      const userBalanceAfter = await zns.zeroToken.balanceOf(user.address);
      const vaultBalanceAfter = await zns.zeroToken.balanceOf(zeroVault.address);

      expect(userBalanceBefore).to.eq(userBalanceAfter);
      expect(vaultBalanceBefore).to.eq(vaultBalanceAfter);

      // check existence in Registry
      const domainHash = hashDomainLabel(defaultDomain);
      const exists = await zns.registry.exists(domainHash);
      expect(exists).to.be.true;

      // make sure no transfers happened
      const transferEventFilter = zns.zeroToken.filters.Transfer(
        user.address,
      );
      const events = await zns.zeroToken.queryFilter(transferEventFilter);
      expect(events.length).to.eq(0);
    });
  });

  describe("Reclaiming Domains", () => {
    it("Can reclaim name/stake if Token is owned", async () => {
      // Register Top level
      const topLevelTx = await defaultRootRegistration({ user: deployer, zns, domainName: defaultDomain });
      const domainHash = await getDomainHashFromReceipt(topLevelTx);
      const tokenId = await getTokenIdFromReceipt(topLevelTx);
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
      expect(tokenAfterReclaim).to.equal(zns.zeroToken.address);
      expect(token).to.equal(tokenAfterReclaim);
    });

    it("Reclaiming domain token emits DomainReclaimed event", async () => {
      const topLevelTx = await defaultRootRegistration({ user: deployer, zns, domainName: defaultDomain });
      const domainHash = await getDomainHashFromReceipt(topLevelTx);
      const tokenId = await getTokenIdFromReceipt(topLevelTx);

      // Transfer the domain token
      await zns.domainToken.connect(deployer).transferFrom(deployer.address, user.address, tokenId);
      // Reclaim the Domain
      const tx = await zns.rootRegistrar.connect(user).reclaimDomain(domainHash);
      const receipt = await tx.wait(0);

      // Verify Transfer event is emitted
      expect(receipt.events?.[1].event).to.eq("DomainReclaimed");
      expect(receipt.events?.[1].args?.domainHash).to.eq(
        domainHash
      );
      expect(receipt.events?.[1].args?.registrant).to.eq(
        user.address
      );
    });

    it("Cannot reclaim name/stake if token is not owned", async () => {
      const topLevelTx = await defaultRootRegistration({ user: deployer, zns, domainName: defaultDomain });
      const domainHash = await getDomainHashFromReceipt(topLevelTx);
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
      const topLevelTx = await defaultRootRegistration({ user: deployer, zns, domainName: defaultDomain });
      const domainHash = await getDomainHashFromReceipt(topLevelTx);
      const tokenId = await getTokenIdFromReceipt(topLevelTx);
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
      expect(tokenAfterReclaim).to.equal(zns.zeroToken.address);
      expect(token).to.equal(tokenAfterReclaim);
    });

    it("Can revoke and unstake after reclaiming", async () => {
      // Verify Balance
      const balance = await zns.zeroToken.balanceOf(user.address);
      expect(balance).to.eq(userBalanceInitial);

      // Register Top level
      const topLevelTx = await defaultRootRegistration({ user: deployer, zns, domainName: defaultDomain });
      const domainHash = await getDomainHashFromReceipt(topLevelTx);
      const tokenId = await getTokenIdFromReceipt(topLevelTx);

      // Validated staked values
      const {
        expectedPrice: expectedStaked,
      } = await getPriceObject(defaultDomain, priceConfigDefault);
      const { amount: staked, token } = await zns.treasury.stakedForDomain(domainHash);
      expect(staked).to.eq(expectedStaked);
      expect(token).to.eq(zns.zeroToken.address);

      // Transfer the domain token
      await zns.domainToken.connect(deployer).transferFrom(deployer.address, user.address, tokenId);

      // Reclaim the Domain
      await zns.rootRegistrar.connect(user).reclaimDomain(domainHash);

      // Revoke the Domain
      await zns.rootRegistrar.connect(user).revokeDomain(domainHash);

      // Validated funds are unstaked
      const { amount: finalstaked, token: finalToken } = await zns.treasury.stakedForDomain(domainHash);
      expect(finalstaked).to.equal(ethers.BigNumber.from("0"));
      expect(finalToken).to.equal(ethers.constants.AddressZero);

      // Verify final balances
      const computedFinalBalance = balance.add(staked);
      const finalBalance = await zns.zeroToken.balanceOf(user.address);
      expect(computedFinalBalance).to.equal(finalBalance);
    });
  });

  describe("Revoking Domains", () => {
    it("Revokes a Top level Domain - Happy Path", async () => {
      // Register Top level
      const topLevelTx = await defaultRootRegistration({
        user,
        zns,
        domainName: defaultDomain,
        distrConfig: {
          pricerContract: zns.fixedPricer.address,
          paymentType: PaymentType.DIRECT,
          accessType: AccessType.OPEN,
        },
      });

      const domainHash = await getDomainHashFromReceipt(topLevelTx);

      const ogPrice = BigNumber.from(135);
      await zns.fixedPricer.connect(user).setPrice(domainHash, ogPrice);
      expect(await zns.fixedPricer.getPrice(domainHash, defaultDomain, false)).to.eq(ogPrice);

      const tokenId = await getTokenIdFromReceipt(topLevelTx);

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
      const balance = await zns.zeroToken.balanceOf(user.address);
      expect(balance).to.eq(userBalanceInitial);

      // Register Top level
      const tx = await defaultRootRegistration({ user, zns, domainName: defaultDomain });
      const domainHash = await getDomainHashFromReceipt(tx);

      // Validated staked values
      const {
        expectedPrice: expectedStaked,
        stakeFee: expectedStakeFee,
      } = await getPriceObject(defaultDomain, priceConfigDefault);
      const { amount: staked, token } = await zns.treasury.stakedForDomain(domainHash);
      expect(staked).to.eq(expectedStaked);
      expect(token).to.eq(zns.zeroToken.address);

      // Get balance after staking
      const balanceAfterStaking = await zns.zeroToken.balanceOf(user.address);

      // Revoke the domain
      await zns.rootRegistrar.connect(user).revokeDomain(domainHash);

      // Validated funds are unstaked
      const { amount: finalstaked, token: finalToken } = await zns.treasury.stakedForDomain(domainHash);
      expect(finalstaked).to.equal(ethers.BigNumber.from("0"));
      expect(finalToken).to.equal(ethers.constants.AddressZero);

      // Verify final balances
      const computedBalanceAfterStaking = balanceAfterStaking.add(staked);
      const balanceMinusFee = balance.sub(expectedStakeFee);
      expect(computedBalanceAfterStaking).to.equal(balanceMinusFee);
      const finalBalance = await zns.zeroToken.balanceOf(user.address);
      expect(computedBalanceAfterStaking).to.equal(finalBalance);
    });

    it("Cannot revoke if Name is owned by another user", async () => {
      // Register Top level
      const topLevelTx = await defaultRootRegistration({ user: deployer, zns, domainName: defaultDomain });
      const parentDomainHash = await getDomainHashFromReceipt(topLevelTx);
      const owner = await zns.registry.connect(user).getDomainOwner(parentDomainHash);
      expect(owner).to.not.equal(user.address);

      // Try to revoke domain
      const tx = zns.rootRegistrar.connect(user).revokeDomain(parentDomainHash);
      await expect(tx).to.be.revertedWith(NOT_BOTH_OWNER_RAR_ERR);
    });

    it("No one can revoke if Token and Name have different owners", async () => {
      // Register Top level
      const topLevelTx = await defaultRootRegistration({ user: deployer, zns, domainName: defaultDomain });
      const parentDomainHash = await getDomainHashFromReceipt(topLevelTx);
      const owner = await zns.registry.connect(user).getDomainOwner(parentDomainHash);
      expect(owner).to.not.equal(user.address);

      const tokenId = BigNumber.from(parentDomainHash);

      await zns.domainToken.transferFrom(deployer.address, user.address, tokenId);

      // Try to revoke domain as a new owner of the token
      const tx = zns.rootRegistrar.connect(user).revokeDomain(parentDomainHash);
      await expect(tx).to.be.revertedWith(NOT_BOTH_OWNER_RAR_ERR);

      const tx2 = zns.rootRegistrar.connect(deployer).revokeDomain(parentDomainHash);
      await expect(tx2).to.be.revertedWith(NOT_BOTH_OWNER_RAR_ERR);
    });

    it("After domain has been revoked, an old operator can NOT access Registry", async () => {
      // Register Top level
      const tx = await defaultRootRegistration({ user, zns, domainName: defaultDomain });
      const domainHash = await getDomainHashFromReceipt(tx);

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
        const tx = zns.rootRegistrar.connect(deployer).setAccessController(ethers.constants.AddressZero);
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
        const tx = zns.rootRegistrar.connect(deployer).setRegistry(ethers.constants.AddressZero);
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
        const tx = zns.rootRegistrar.connect(deployer).setTreasury(ethers.constants.AddressZero);
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
        const tx = zns.rootRegistrar.connect(deployer).setDomainToken(ethers.constants.AddressZero);
        await expect(tx).to.be.revertedWith("ZNSRootRegistrar: domainToken_ is 0x0 address");
      });
    });

    describe("#setAddressResolver", () => {
      it("Should set AddressResolver and fire AddressResolverSet event", async () => {
        const currentResolver = await zns.rootRegistrar.addressResolver();
        const tx = await zns.rootRegistrar.connect(deployer).setAddressResolver(randomUser.address);
        const newResolver = await zns.rootRegistrar.addressResolver();

        await expect(tx).to.emit(zns.rootRegistrar, "AddressResolverSet").withArgs(randomUser.address);

        expect(newResolver).to.equal(randomUser.address);
        expect(currentResolver).to.not.equal(newResolver);
      });

      it("Should revert if not called by ADMIN", async () => {
        const tx = zns.rootRegistrar.connect(user).setAddressResolver(randomUser.address);
        await expect(tx).to.be.revertedWith(
          getAccessRevertMsg(user.address, ADMIN_ROLE)
        );
      });

      it("Should revert if AddressResolver is address zero", async () => {
        const tx = zns.rootRegistrar.connect(deployer).setAddressResolver(ethers.constants.AddressZero);
        await expect(tx).to.be.revertedWith("ZNSRootRegistrar: addressResolver_ is 0x0 address");
      });
    });
  });

  describe("UUPS", () => {
    it("Allows an authorized user to upgrade the contract", async () => {
      // Confirm deployer has the correct role first
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const registrarFactory = new ZNSRootRegistrar__factory(deployer);
      const registrar = await registrarFactory.deploy();
      await registrar.deployed();

      const upgradeTx = zns.rootRegistrar.connect(deployer).upgradeTo(registrar.address);
      await expect(upgradeTx).to.not.be.reverted;
    });

    it("Fails to upgrade when an unauthorized users calls", async () => {
      const registrarFactory = new ZNSRootRegistrar__factory(deployer);
      const registrar = await registrarFactory.deploy();
      await registrar.deployed();

      const tx = zns.rootRegistrar.connect(randomUser).upgradeTo(registrar.address);

      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(randomUser.address, GOVERNOR_ROLE)
      );
    });

    it("Verifies that variable values are not changed in the upgrade process", async () => {
      // Confirm deployer has the correct role first
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const registrarFactory = new ZNSRootRegistrarUpgradeMock__factory(deployer);
      const registrar = await registrarFactory.deploy();
      await registrar.deployed();

      const domainName = "world";
      const domainHash = hashDomainLabel(domainName);

      await zns.zeroToken.connect(randomUser).approve(zns.treasury.address, ethers.constants.MaxUint256);
      await zns.zeroToken.mint(randomUser.address, priceConfigDefault.maxPrice);

      await zns.rootRegistrar.connect(randomUser).registerRootDomain(
        domainName,
        randomUser.address,
        defaultTokenURI,
        distrConfigEmpty
      );

      await zns.rootRegistrar.setAddressResolver(randomUser.address);

      const contractCalls = [
        zns.rootRegistrar.getAccessController(),
        zns.rootRegistrar.registry(),
        zns.rootRegistrar.treasury(),
        zns.rootRegistrar.domainToken(),
        zns.rootRegistrar.addressResolver(),
        zns.registry.exists(domainHash),
        zns.treasury.stakedForDomain(domainHash),
        zns.domainToken.name(),
        zns.domainToken.symbol(),
        zns.curvePricer.getPrice(ethers.constants.HashZero, domainName, false),
      ];

      await validateUpgrade(deployer, zns.rootRegistrar, registrar, registrarFactory, contractCalls);
    });
  });
});
