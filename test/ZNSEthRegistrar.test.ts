import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  deployZNS, hashDomainName, INVALID_TOKENID_ERC_ERR,
  NOT_AUTHORIZED_REG_ERR,
  NOT_NAME_OWNER_RAR_ERR, NOT_TOKEN_OWNER_RAR_ERR,
  ONLY_NAME_OWNER_REG_ERR,
  ONLY_OWNER_REGISTRAR_REG_ERR,
  validateUpgrade,
} from "./helpers";
import { ZNSContracts } from "./helpers/types";
import * as ethers from "ethers";
import { defaultRegistration } from "./helpers/registerDomain";
import { checkBalance } from "./helpers/balances";
import { priceConfigDefault } from "./helpers/constants";
import { getPrice, getPriceObject } from "./helpers/pricing";
import { getDomainHashFromEvent, getTokenIdFromEvent } from "./helpers/events";
import { BigNumber } from "ethers";
import { getAccessRevertMsg } from "./helpers/errors";
import { ADMIN_ROLE, GOVERNOR_ROLE } from "./helpers/access";
import { ZNSEthRegistrar__factory, ZNSEthRegistrarUpgradeMock__factory } from "../typechain";

require("@nomicfoundation/hardhat-chai-matchers");

describe("ZNSEthRegistrar", () => {
  let deployer : SignerWithAddress;
  let user : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let randomUser : SignerWithAddress;

  let zns : ZNSContracts;
  let zeroVault : SignerWithAddress;
  let operator : SignerWithAddress;
  const defaultDomain = "wilder";

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

    // Give funds to user
    await zns.zeroToken.connect(user).approve(zns.treasury.address, ethers.constants.MaxUint256);
    await zns.zeroToken.mint(user.address, ethers.utils.parseEther("1500"));
  });

  it("Confirms a user has funds and allowance for the Registrar", async () => {
    const balance = await zns.zeroToken.balanceOf(user.address);
    expect(balance).to.eq(priceConfigDefault.maxPrice);

    const allowance = await zns.zeroToken.allowance(user.address, zns.treasury.address);
    expect(allowance).to.eq(ethers.constants.MaxUint256);
  });

  it("Should revert when initialize() without ADMIN_ROLE", async () => {
    const userHasAdmin = await zns.accessController.hasRole(ADMIN_ROLE, user.address);
    expect(userHasAdmin).to.be.false;

    const registrarFactory = new ZNSEthRegistrar__factory(deployer);
    const registrar = await registrarFactory.connect(user).deploy();
    await registrar.deployed();

    const tx = registrar.connect(user).initialize(
      zns.accessController.address,
      randomUser.address,
      randomUser.address,
      randomUser.address,
      randomUser.address,
    );

    await expect(tx).to.be.revertedWith(getAccessRevertMsg(user.address, ADMIN_ROLE));
  });

  describe("Registers a top level domain", () => {
    it("Can NOT register a TLD with an empty name", async () => {
      const emptyName = "";

      await expect(
        defaultRegistration(deployer, zns, emptyName)
      ).to.be.revertedWith("ZNSEthRegistrar: Domain Name not provided");
    });

    it("Successfully registers a domain without a resolver or resolver content", async () => {
      const tx = zns.registrar.connect(user).registerDomain(
        defaultDomain,
        ethers.constants.AddressZero,
      );

      await expect(tx).to.not.be.reverted;
    });

    it("Stakes the correct amount, takes the correct fee and sends fee to Zero Vault", async () => {
      const balanceBeforeUser = await zns.zeroToken.balanceOf(user.address);
      const balanceBeforeVault = await zns.zeroToken.balanceOf(zeroVault.address);

      // Deploy "wilder" with default configuration
      const tx = await defaultRegistration(user, zns, defaultDomain, user.address);
      const domainHash = await getDomainHashFromEvent(tx);
      const {
        totalPrice,
        expectedPrice,
        fee,
      } = await getPriceObject(defaultDomain, zns.priceOracle);

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
        target: fee,
        shouldDecrease: false,
      });

      const staked = await zns.treasury.stakedForDomain(domainHash);

      expect(staked).to.eq(expectedPrice);
    });

    it("Sets the correct data in Registry", async () => {
      const tx = await defaultRegistration(
        deployer,
        zns,
        defaultDomain
      );
      const domainHash = await getDomainHashFromEvent(tx);

      const {
        owner: ownerFromReg,
        resolver: resolverFromReg,
      } = await zns.registry.getDomainRecord(domainHash);

      expect(ownerFromReg).to.eq(deployer.address);
      expect(resolverFromReg).to.eq(zns.addressResolver.address);
    });

    it("Fails when the user does not have enough funds", async () => {
      await zns.zeroToken.connect(user).transfer(zns.zeroToken.address, priceConfigDefault.maxPrice);

      const tx = defaultRegistration(user, zns, defaultDomain);
      await expect(tx).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    // TODO this needs to be checked also with ENS namehash lib
    //  to make sure that hashing process allows for these characters as well
    it("Allows unicode characters in domain names", async () => {
      const unicodeDomain = "œ柸þ€§ﾪ";

      const tx = await defaultRegistration(user, zns, unicodeDomain);

      const domainHash = await getDomainHashFromEvent(tx);
      expect(await zns.registry.exists(domainHash)).to.be.true;

      const expectedStaked = await getPrice(unicodeDomain, zns.priceOracle);
      const staked = await zns.treasury.stakedForDomain(domainHash);
      expect(expectedStaked).to.eq(staked);
    });

    it("Disallows creation of a duplicate domain", async () => {
      await defaultRegistration(user, zns, defaultDomain);
      const failTx = defaultRegistration(deployer, zns, defaultDomain);

      await expect(failTx).to.be.revertedWith("ZNSEthRegistrar: Domain already exists");
    });

    it("Successfully registers a domain without resolver content", async () => {
      const tx = zns.registrar.connect(user).registerDomain(
        defaultDomain,
        ethers.constants.AddressZero,
      );

      await expect(tx).to.not.be.reverted;
    });

    it("Records the correct domain hash", async () => {
      const tx = await defaultRegistration(deployer, zns, defaultDomain);

      const domainHash = await getDomainHashFromEvent(tx);

      const exists = await zns.registry.exists(domainHash);
      expect(exists).to.be.true;
    });

    it("Creates and finds the correct tokenId", async () => {
      const tx = await defaultRegistration(deployer, zns, defaultDomain);

      const tokenId = await getTokenIdFromEvent(tx);
      const owner = await zns.domainToken.ownerOf(tokenId);
      expect(owner).to.eq(deployer.address);
    });

    it("Resolves the correct address from the domain", async () => {
      const tx = await defaultRegistration(deployer, zns, defaultDomain);
      const domainHash = await getDomainHashFromEvent(tx);

      const resolvedAddress = await zns.addressResolver.getAddress(domainHash);
      expect(resolvedAddress).to.eq(zns.registrar.address);
    });
  });

  describe("Reclaiming Domains", () => {
    it("Can reclaim name/stake if Token is owned", async () => {
      // Register Top level
      const topLevelTx = await defaultRegistration(deployer, zns, defaultDomain);
      const domainHash = await getDomainHashFromEvent(topLevelTx);
      const tokenId = await getTokenIdFromEvent(topLevelTx);
      const staked = await zns.treasury.stakedForDomain(domainHash);

      // Transfer the domain token
      await zns.domainToken.connect(deployer).transferFrom(deployer.address, user.address, tokenId);

      // Verify owner in registry
      const originalOwner  = await zns.registry.connect(deployer).getDomainOwner(domainHash);
      expect(originalOwner).to.equal(deployer.address);

      // Reclaim the Domain
      await zns.registrar.connect(user).reclaimDomain(domainHash);

      // Verify domain token is still owned
      const owner  = await zns.domainToken.connect(user).ownerOf(tokenId);
      expect(owner).to.equal(user.address);

      // Verify domain is owned in registry
      const registryOwner = await zns.registry.connect(user).getDomainOwner(domainHash);
      expect(registryOwner).to.equal(user.address);

      // Verify same amount is staked
      const stakedAfterReclaim = await zns.treasury.stakedForDomain(domainHash);
      expect(staked).to.equal(stakedAfterReclaim);
    });

    it("Reclaiming domain token emits DomainReclaimed event", async () => {
      const topLevelTx = await defaultRegistration(deployer, zns, defaultDomain);
      const domainHash = await getDomainHashFromEvent(topLevelTx);
      const tokenId = await getTokenIdFromEvent(topLevelTx);

      // Transfer the domain token
      await zns.domainToken.connect(deployer).transferFrom(deployer.address, user.address, tokenId);
      // Reclaim the Domain
      const tx = await zns.registrar.connect(user).reclaimDomain(domainHash);
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
      const topLevelTx = await defaultRegistration(deployer, zns, defaultDomain);
      const domainHash = await getDomainHashFromEvent(topLevelTx);
      // Reclaim the Domain
      const tx = zns.registrar.connect(user).reclaimDomain(domainHash);

      // Verify Domain is not reclaimed
      await expect(tx).to.be.revertedWith(NOT_TOKEN_OWNER_RAR_ERR);

      // Verify domain is not owned in registrar
      const registryOwner = await zns.registry.connect(user).getDomainOwner(domainHash);
      expect(registryOwner).to.equal(deployer.address);
    });

    it("Cannot reclaim if domain does not exist", async () => {
      const domainHash = "0xd34cfa279afd55afc6aa9c00aa5d01df60179840a93d10eed730058b8dd4146c";
      // Reclaim the Domain
      const tx = zns.registrar.connect(user).reclaimDomain(domainHash);

      // Verify Domain is not reclaimed
      await expect(tx).to.be.revertedWith(INVALID_TOKENID_ERC_ERR);
    });

    it("Domain Token can be reclaimed, transferred, and then reclaimed again", async () => {
      // Register Top level
      const topLevelTx = await defaultRegistration(deployer, zns, defaultDomain);
      const domainHash = await getDomainHashFromEvent(topLevelTx);
      const tokenId = await getTokenIdFromEvent(topLevelTx);
      const staked = await zns.treasury.stakedForDomain(domainHash);

      // Transfer the domain token
      await zns.domainToken.connect(deployer).transferFrom(deployer.address, user.address, tokenId);

      // Reclaim the Domain
      await zns.registrar.connect(user).reclaimDomain(domainHash);
      // Verify domain token is still owned
      let owner  = await zns.domainToken.connect(user).ownerOf(tokenId);
      expect(owner).to.equal(user.address);

      // Transfer the domain token back
      await zns.domainToken.connect(user).transferFrom(user.address, deployer.address, tokenId);

      // Reclaim the Domain again
      await zns.registrar.connect(deployer).reclaimDomain(domainHash);

      // Verify domain token is owned
      owner  = await zns.domainToken.connect(deployer).ownerOf(tokenId);
      expect(owner).to.equal(deployer.address);

      // Verify domain is owned in registrar
      const registryOwner = await zns.registry.connect(deployer).getDomainOwner(domainHash);
      expect(registryOwner).to.equal(deployer.address);

      // Verify same amount is staked
      const stakedAfterReclaim = await zns.treasury.stakedForDomain(domainHash);
      expect(staked).to.equal(stakedAfterReclaim);
    });

    it("Can revoke and unstake after reclaiming", async () => {

      // Verify Balance
      const balance = await zns.zeroToken.balanceOf(user.address);
      expect(balance).to.eq(priceConfigDefault.maxPrice);

      // Register Top level
      const topLevelTx = await defaultRegistration(deployer, zns, defaultDomain);
      const domainHash = await getDomainHashFromEvent(topLevelTx);
      const tokenId = await getTokenIdFromEvent(topLevelTx);

      // Validated staked values
      const {
        expectedPrice: expectedStaked,
      } = await getPriceObject(defaultDomain, zns.priceOracle);
      const staked = await zns.treasury.stakedForDomain(domainHash);
      expect(staked).to.eq(expectedStaked);

      // Transfer the domain token
      await zns.domainToken.connect(deployer).transferFrom(deployer.address, user.address, tokenId);

      // Reclaim the Domain
      await zns.registrar.connect(user).reclaimDomain(domainHash);

      // Revoke the Domain
      await zns.registrar.connect(user).revokeDomain(domainHash);

      // Validated funds are unstaked
      const finalstaked = await zns.treasury.stakedForDomain(domainHash);
      expect(finalstaked).to.equal(ethers.BigNumber.from("0"));

      // Verify final balances
      const computedFinalBalance = balance.add(staked);
      const finalBalance = await zns.zeroToken.balanceOf(user.address);
      expect(computedFinalBalance).to.equal(finalBalance);
    });
  });

  describe("Revoking Domains", () => {
    it("Revokes a Top level Domain - Happy Path", async () => {
    // Register Top level
      const topLevelTx = await defaultRegistration(user, zns, defaultDomain);
      const parentDomainHash = await getDomainHashFromEvent(topLevelTx);
      const tokenId = await getTokenIdFromEvent(topLevelTx);

      // Revoke the domain and then verify
      await zns.registrar.connect(user).revokeDomain(parentDomainHash);

      // Verify token has been burned
      const ownerOfTx = zns.domainToken.connect(user).ownerOf(tokenId);
      await expect(ownerOfTx).to.be.revertedWith(
        INVALID_TOKENID_ERC_ERR
      );

      // Verify Domain Record Deleted
      const exists = await zns.registry.exists(parentDomainHash);
      expect(exists).to.be.false;
    });

    it("Cannot revoke a domain that doesnt exist", async () => {
    // Register Top level
      const fakeHash = "0xd34cfa279afd55afc6aa9c00aa5d01df60179840a93d10eed730058b8dd4146c";
      const exists = await zns.registry.exists(fakeHash);
      expect(exists).to.be.false;

      // Verify transaction is reverted
      const tx = zns.registrar.connect(user).revokeDomain(fakeHash);
      await expect(tx).to.be.revertedWith(NOT_NAME_OWNER_RAR_ERR);
    });

    it("Revoking domain unstakes", async () => {
    // Verify Balance
      const balance = await zns.zeroToken.balanceOf(user.address);
      expect(balance).to.eq(priceConfigDefault.maxPrice);

      // Register Top level
      const tx = await defaultRegistration(user, zns, defaultDomain);
      const domainHash = await getDomainHashFromEvent(tx);

      // Validated staked values
      const {
        expectedPrice: expectedStaked,
        fee: expectedStakeFee,
      } = await getPriceObject(defaultDomain, zns.priceOracle);
      const staked = await zns.treasury.stakedForDomain(domainHash);
      expect(staked).to.eq(expectedStaked);

      // Get balance after staking
      const balanceAfterStaking = await zns.zeroToken.balanceOf(user.address);

      // Revoke the domain
      await zns.registrar.connect(user).revokeDomain(domainHash);

      // Validated funds are unstaked
      const finalstaked = await zns.treasury.stakedForDomain(domainHash);
      expect(finalstaked).to.equal(ethers.BigNumber.from("0"));

      // Verify final balances
      const computedBalanceAfterStaking = balanceAfterStaking.add(staked);
      const balanceMinusFee = balance.sub(expectedStakeFee);
      expect(computedBalanceAfterStaking).to.equal(balanceMinusFee);
      const finalBalance = await zns.zeroToken.balanceOf(user.address);
      expect(computedBalanceAfterStaking).to.equal(finalBalance);
    });

    it("Cannot revoke if Name is owned by another user", async () => {
    // Register Top level
      const topLevelTx = await defaultRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHashFromEvent(topLevelTx);
      const owner = await zns.registry.connect(user).getDomainOwner(parentDomainHash);
      expect(owner).to.not.equal(user.address);

      // Try to revoke domain
      const tx = zns.registrar.connect(user).revokeDomain(parentDomainHash);
      await expect(tx).to.be.revertedWith(NOT_NAME_OWNER_RAR_ERR);
    });

    it("No one can revoke if Token and Name have different owners", async () => {
      // Register Top level
      const topLevelTx = await defaultRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHashFromEvent(topLevelTx);
      const owner = await zns.registry.connect(user).getDomainOwner(parentDomainHash);
      expect(owner).to.not.equal(user.address);

      const tokenId = BigNumber.from(parentDomainHash);

      await zns.domainToken.transferFrom(deployer.address, user.address, tokenId);

      // Try to revoke domain as a new owner of the token
      const tx = zns.registrar.connect(user).revokeDomain(parentDomainHash);
      await expect(tx).to.be.revertedWith(NOT_NAME_OWNER_RAR_ERR);

      const tx2 = zns.registrar.connect(deployer).revokeDomain(parentDomainHash);
      await expect(tx2).to.be.revertedWith(NOT_TOKEN_OWNER_RAR_ERR);
    });

    it("After domain has been revoked, an old operator can NOT access Registry", async () => {
      // Register Top level
      const tx = await defaultRegistration(user, zns, defaultDomain);
      const domainHash = await getDomainHashFromEvent(tx);

      // assign an operator
      await zns.registry.connect(user).setOwnerOperator(operator.address, true);

      // Revoke the domain
      await zns.registrar.connect(user).revokeDomain(domainHash);

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
        const currentAC = await zns.registrar.getAccessController();
        const tx = await zns.registrar.connect(deployer).setAccessController(randomUser.address);
        const newAC = await zns.registrar.getAccessController();

        await expect(tx).to.emit(zns.registrar, "AccessControllerSet").withArgs(randomUser.address);

        expect(newAC).to.equal(randomUser.address);
        expect(currentAC).to.not.equal(newAC);
      });

      it("Should revert if not called by ADMIN", async () => {
        const tx = zns.registrar.connect(user).setAccessController(randomUser.address);
        await expect(tx).to.be.revertedWith(
          getAccessRevertMsg(user.address, ADMIN_ROLE)
        );
      });

      it("Should revert if new AccessController is address zero", async () => {
        const tx = zns.registrar.connect(deployer).setAccessController(ethers.constants.AddressZero);
        await expect(tx).to.be.revertedWith("AC: _accessController is 0x0 address");
      });
    });

    describe("#setZnsRegistry", () => {
      it("Should set ZNSRegistry and fire RegistrySet event", async () => {
        const currentRegistry = await zns.registrar.registry();
        const tx = await zns.registrar.connect(deployer).setRegistry(randomUser.address);
        const newRegistry = await zns.registrar.registry();

        await expect(tx).to.emit(zns.registrar, "RegistrySet").withArgs(randomUser.address);

        expect(newRegistry).to.equal(randomUser.address);
        expect(currentRegistry).to.not.equal(newRegistry);
      });

      it("Should revert if not called by ADMIN", async () => {
        const tx = zns.registrar.connect(user).setRegistry(randomUser.address);
        await expect(tx).to.be.revertedWith(
          getAccessRevertMsg(user.address, ADMIN_ROLE)
        );
      });

      it("Should revert if ZNSRegistry is address zero", async () => {
        const tx = zns.registrar.connect(deployer).setRegistry(ethers.constants.AddressZero);
        await expect(tx).to.be.revertedWith("ZNSEthRegistrar: registry_ is 0x0 address");
      });
    });

    describe("#setTreasury", () => {
      it("Should set Treasury and fire TreasurySet event", async () => {
        const currentTreasury = await zns.registrar.treasury();
        const tx = await zns.registrar.connect(deployer).setTreasury(randomUser.address);
        const newTreasury = await zns.registrar.treasury();

        await expect(tx).to.emit(zns.registrar, "TreasurySet").withArgs(randomUser.address);

        expect(newTreasury).to.equal(randomUser.address);
        expect(currentTreasury).to.not.equal(newTreasury);
      });

      it("Should revert if not called by ADMIN", async () => {
        const tx = zns.registrar.connect(user).setTreasury(randomUser.address);
        await expect(tx).to.be.revertedWith(
          getAccessRevertMsg(user.address, ADMIN_ROLE)
        );
      });

      it("Should revert if Treasury is address zero", async () => {
        const tx = zns.registrar.connect(deployer).setTreasury(ethers.constants.AddressZero);
        await expect(tx).to.be.revertedWith("ZNSEthRegistrar: treasury_ is 0x0 address");
      });
    });

    describe("#setDomainToken", () => {
      it("Should set DomainToken and fire DomainTokenSet event", async () => {
        const currentToken = await zns.registrar.domainToken();
        const tx = await zns.registrar.connect(deployer).setDomainToken(randomUser.address);
        const newToken = await zns.registrar.domainToken();

        await expect(tx).to.emit(zns.registrar, "DomainTokenSet").withArgs(randomUser.address);

        expect(newToken).to.equal(randomUser.address);
        expect(currentToken).to.not.equal(newToken);
      });

      it("Should revert if not called by ADMIN", async () => {
        const tx = zns.registrar.connect(user).setDomainToken(randomUser.address);
        await expect(tx).to.be.revertedWith(
          getAccessRevertMsg(user.address, ADMIN_ROLE)
        );
      });

      it("Should revert if DomainToken is address zero", async () => {
        const tx = zns.registrar.connect(deployer).setDomainToken(ethers.constants.AddressZero);
        await expect(tx).to.be.revertedWith("ZNSEthRegistrar: domainToken_ is 0x0 address");
      });
    });

    describe("#setAddressResolver", () => {
      it("Should set AddressResolver and fire AddressResolverSet event", async () => {
        const currentResolver = await zns.registrar.addressResolver();
        const tx = await zns.registrar.connect(deployer).setAddressResolver(randomUser.address);
        const newResolver = await zns.registrar.addressResolver();

        await expect(tx).to.emit(zns.registrar, "AddressResolverSet").withArgs(randomUser.address);

        expect(newResolver).to.equal(randomUser.address);
        expect(currentResolver).to.not.equal(newResolver);
      });

      it("Should revert if not called by ADMIN", async () => {
        const tx = zns.registrar.connect(user).setAddressResolver(randomUser.address);
        await expect(tx).to.be.revertedWith(
          getAccessRevertMsg(user.address, ADMIN_ROLE)
        );
      });

      it("Should revert if AddressResolver is address zero", async () => {
        const tx = zns.registrar.connect(deployer).setAddressResolver(ethers.constants.AddressZero);
        await expect(tx).to.be.revertedWith("ZNSEthRegistrar: addressResolver_ is 0x0 address");
      });
    });
  });

  describe("UUPS", () => {
    it("Allows an authorized user to upgrade the contract", async () => {
      // Confirm deployer has the correct role first
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const registrarFactory = new ZNSEthRegistrar__factory(deployer);
      const registrar = await registrarFactory.deploy();
      await registrar.deployed();

      const upgradeTx = zns.registrar.connect(deployer).upgradeTo(registrar.address);
      await expect(upgradeTx).to.not.be.reverted;
    });

    it("Fails to upgrade when an unauthorized users calls", async () => {
      const registrarFactory = new ZNSEthRegistrar__factory(deployer);
      const registrar = await registrarFactory.deploy();
      await registrar.deployed();

      const tx = zns.registrar.connect(randomUser).upgradeTo(registrar.address);

      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(randomUser.address, GOVERNOR_ROLE)
      );
    });

    it("Verifies that variable values are not changed in the upgrade process", async () => {
      // Confirm deployer has the correct role first
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const registrarFactory = new ZNSEthRegistrarUpgradeMock__factory(deployer);
      const registrar = await registrarFactory.deploy();
      await registrar.deployed();

      const domainName = "world";
      const domainHash = hashDomainName(domainName);

      await zns.zeroToken.connect(randomUser).approve(zns.treasury.address, ethers.constants.MaxUint256);
      await zns.zeroToken.mint(randomUser.address, ethers.utils.parseEther("1500"));

      await zns.registrar.connect(randomUser).registerDomain(domainName, randomUser.address);

      await zns.registrar.setAddressResolver(randomUser.address);

      const contractCalls = [
        zns.registrar.getAccessController(),
        zns.registrar.registry(),
        zns.registrar.treasury(),
        zns.registrar.domainToken(),
        zns.registrar.addressResolver(),
        zns.registry.exists(domainHash),
        zns.treasury.stakedForDomain(domainHash),
        zns.domainToken.name(),
        zns.domainToken.symbol(),
        zns.priceOracle.getPrice(domainName),
      ];

      await validateUpgrade(deployer, zns.registrar, registrar, registrarFactory, contractCalls);
    });
  });
});
