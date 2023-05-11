import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployZNS } from "./helpers";
import { ZNSContracts } from "./helpers/types";
import * as ethers from "ethers";
import { defaultRootRegistration, defaultSubdomainRegistration } from "./helpers/registerDomain";
import { checkBalance } from "./helpers/balances";
import { priceConfigDefault } from "./helpers/constants";
import { getPrice, getPriceObject } from "./helpers/pricing";
import { getDomainHashFromEvent, getTokenIdFromEvent } from "./helpers/events";
import { BigNumber } from "ethers";

require("@nomicfoundation/hardhat-chai-matchers");

const { constants: { AddressZero } } = ethers;

describe("ZNSEthRegistrar", () => {
  let deployer : SignerWithAddress;
  let user : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let randomAcc : SignerWithAddress;

  let zns : ZNSContracts;
  let zeroVault : SignerWithAddress;
  let operator : SignerWithAddress;
  const defaultDomain = "wilder";
  const defaultSubdomain = "world";

  beforeEach(async () => {
    [deployer, zeroVault, user, operator, governor, admin, randomAcc] = await hre.ethers.getSigners();
    // zeroVault address is used to hold the fee charged to the user when registering
    zns = await deployZNS({
      deployer,
      governorAddresses: [deployer.address, governor.address],
      adminAddresses: [admin.address],
      priceConfig: priceConfigDefault,
      zeroVaultAddress: zeroVault.address,
    });

    // TODO AC: change this when access control implemented
    // Give the user permission on behalf of the parent domain owner
    await zns.registry.connect(deployer).setOwnerOperator(user.address, true);

    // TODO AC: change this when access control implemented
    // Give the registrar permission on behalf of the user
    await zns.registry.connect(user).setOwnerOperator(zns.registrar.address, true);

    // Give funds to user
    await zns.zeroToken.connect(user).approve(zns.treasury.address, ethers.constants.MaxUint256);
    await zns.zeroToken.transfer(user.address, ethers.utils.parseEther("15"));
  });

  it("Confirms a user has funds and allowance for the Registrar", async () => {
    const balance = await zns.zeroToken.balanceOf(user.address);
    expect(balance).to.eq(ethers.utils.parseEther("15"));

    const allowance = await zns.zeroToken.allowance(user.address, zns.treasury.address);
    expect(allowance).to.eq(ethers.constants.MaxUint256);
  });

  describe("Registers a top level domain", () => {
    it("Can NOT register a TLD with an empty name", async () => {
      const emptyName = "";

      await expect(
        defaultRootRegistration(deployer, zns, emptyName)
      ).to.be.revertedWith("ZNSEthRegistrar: Domain Name not provided");
    });

    it("Stakes the correct amount, takes the correct fee and sends fee to Zero Vault", async () => {
      const balanceBeforeUser = await zns.zeroToken.balanceOf(user.address);
      const balanceBeforeVault = await zns.zeroToken.balanceOf(zeroVault.address);

      // Deploy "wilder" with default configuration
      const tx = await defaultRootRegistration(user, zns, defaultDomain);
      const domainHash = await getDomainHashFromEvent(tx);
      const {
        totalPrice,
        expectedPrice,
        fee,
      } = await getPriceObject(defaultDomain, zns.priceOracle, true);

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
      const tx = await defaultRootRegistration(
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
      await zns.zeroToken.connect(user).transfer(zns.zeroToken.address, ethers.utils.parseEther("15"));

      const tx = defaultRootRegistration(user, zns, defaultDomain);
      await expect(tx).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    // TODO this needs to be checked also with ENS namehash lib
    //  to make sure that hashing process allows for these characters as well
    it("Allows unicode characters in domain names", async () => {
      const unicodeDomain = "œ柸þ€§ﾪ";

      const tx = await defaultRootRegistration(user, zns, unicodeDomain);

      const domainHash = await getDomainHashFromEvent(tx);
      expect(await zns.registry.exists(domainHash)).to.be.true;

      const expectedStaked = await getPrice(unicodeDomain, zns.priceOracle, true);
      const staked = await zns.treasury.stakedForDomain(domainHash);
      expect(expectedStaked).to.eq(staked);
    });

    it("Disallows creation of a duplicate domain", async () => {
      await defaultRootRegistration(user, zns, defaultDomain);
      const failTx = defaultRootRegistration(deployer, zns, defaultDomain);

      await expect(failTx).to.be.revertedWith("ZNSEthRegistrar: Domain already exists");
    });

    it("Fails when a resolver is given without an address to resolve to", async () => {
      const tx = zns.registrar.connect(user).registerRootDomain(
        defaultDomain,
        zns.addressResolver.address,
        ethers.constants.AddressZero
      );

      await expect(tx).to.be.revertedWith("ZNSEthRegistrar: No domain content provided");
    });

    it("Fails when a resolution address is given but not a resolver", async () => {
      const tx = zns.registrar.connect(user).registerRootDomain(
        defaultDomain,
        ethers.constants.AddressZero,
        zns.registrar.address // Content to resolve to
      );

      await expect(tx).to.be.revertedWith("ZNSEthRegistrar: Domain content provided without a valid resolver address");
    });

    it("Successfully registers a domain without a resolver or resolver content", async () => {
      const tx = zns.registrar.connect(user).registerRootDomain(
        defaultDomain,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      );

      await expect(tx).to.not.be.reverted;
    });

    it("Records the correct domain hash", async () => {
      const tx = await defaultRootRegistration(deployer, zns, defaultDomain);

      const domainHash = await getDomainHashFromEvent(tx);

      const exists = await zns.registry.exists(domainHash);
      expect(exists).to.be.true;
    });

    it("Creates and finds the correct tokenId", async () => {
      const tx = await defaultRootRegistration(deployer, zns, defaultDomain);

      const tokenId = await getTokenIdFromEvent(tx);
      const owner = await zns.domainToken.ownerOf(tokenId);
      expect(owner).to.eq(deployer.address);
    });

    it("Resolves the correct address from the domain", async () => {
      const tx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const domainHash = await getDomainHashFromEvent(tx);

      const resolvedAddress = await zns.addressResolver.getAddress(domainHash);
      expect(resolvedAddress).to.eq(zns.registrar.address);
    });
  });

  // TODO: add tests for approval process when subdomains are added back
  describe("Registers a subdomain", () => {
    it("Can NOT register a subdomain with an empty name", async () => {
      const emptyName = "";

      const parentTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHashFromEvent(parentTx);

      await expect(
        defaultSubdomainRegistration(user, zns, parentDomainHash, emptyName)
      ).to.be.revertedWith("ZNSEthRegistrar: No subdomain name");
    });

    it("Sets the correct data in Registry", async () => {
      const parentReceipt = await defaultRootRegistration(
        deployer,
        zns,
        defaultDomain
      );
      const parentDomainHash = await getDomainHashFromEvent(parentReceipt);
      const subReceipt = await defaultSubdomainRegistration(
        user,
        zns,
        parentDomainHash,
        defaultSubdomain
      );

      const subdomainHash = await getDomainHashFromEvent(subReceipt);

      const {
        owner: ownerFromReg,
        resolver: resolverFromReg,
      } = await zns.registry.getDomainRecord(subdomainHash);

      expect(ownerFromReg).to.eq(user.address);
      expect(resolverFromReg).to.eq(zns.addressResolver.address);
    });

    it("Staked the correct amount and takes the correct fee", async () => {
      const parentTx = await defaultRootRegistration(deployer, zns, defaultDomain);

      const parentDomainHash = await getDomainHashFromEvent(parentTx);

      const balanceBefore = await zns.zeroToken.balanceOf(user.address);
      const tx = await defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);
      const subdomainHash = await getDomainHashFromEvent(tx);

      const {
        totalPrice,
        expectedPrice,
      } = await getPriceObject(defaultSubdomain, zns.priceOracle, false);

      await checkBalance({
        token: zns.zeroToken,
        balanceBefore,
        userAddress: user.address,
        target: totalPrice,
      });

      const staked = await zns.treasury.stakedForDomain(subdomainHash);
      expect(staked).to.eq(expectedPrice);
    });

    it("Fails when the user does not have enough funds", async () => {
      const parentTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHashFromEvent(parentTx);

      await zns.zeroToken.connect(user).transfer(zns.zeroToken.address, ethers.utils.parseEther("15"));

      const tx = defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);
      await expect(tx).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Allows unicode characters in domain names", async () => {
      const parentTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHashFromEvent(parentTx);

      const unicodeDomain = "œ柸þ€§ﾪ";

      const tx = await defaultSubdomainRegistration(user, zns, parentDomainHash, unicodeDomain);

      const domainHash = await getDomainHashFromEvent(tx);
      expect(await zns.registry.exists(domainHash)).to.be.true;

      const expectedStaked = await getPrice(unicodeDomain, zns.priceOracle, false);
      const staked = await zns.treasury.stakedForDomain(domainHash);
      expect(expectedStaked).to.eq(staked);
    });

    it("Disallows creation of a duplicate domain", async () => {
      const parentTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHashFromEvent(parentTx);

      await defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);
      const failTx = defaultSubdomainRegistration(deployer, zns, parentDomainHash, defaultSubdomain);

      await expect(failTx).to.be.revertedWith("ZNSEthRegistrar: Domain already exists");
    });

    // TODO call as mock registrar
    it("Fails when a resolver is given without an address to resolve to", async () => {
      const parentTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHashFromEvent(parentTx);

      const tx = zns.registrar.connect(user).registerSubdomain(
        parentDomainHash,
        defaultDomain,
        user.address,
        zns.addressResolver.address,
        ethers.constants.AddressZero
      );

      await expect(tx).to.be.revertedWith("ZNSEthRegistrar: No domain content provided");
    });

    // TODO verify costs using a struct or not in price oracle
    // it("Calls on behalf of a user as a registrar")
    // it("fails if not approved subdomain creator")
    // it("immediately revokes subdomain approval after tx")

    it("Fails when a resolution address is given but not a resolver", async () => {
      const tx = zns.registrar.connect(user).registerRootDomain(
        defaultDomain,
        ethers.constants.AddressZero,
        zns.registrar.address // Content to resolve to
      );

      await expect(tx).to.be.revertedWith("ZNSEthRegistrar: Domain content provided without a valid resolver address");
    });

    it("Successfully registers a domain without a resolver or resolver content", async () => {
      // TODO: fix or move this test. it's under a subdomain describe
      const tx = zns.registrar.connect(user).registerRootDomain(
        defaultSubdomain,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      );

      await expect(tx).to.not.be.reverted;
    });

    it("Records the correct subdomain hash", async () => {
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHashFromEvent(topLevelTx);

      const tx = await defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);

      const domainHash = await getDomainHashFromEvent(tx);

      const exists = await zns.registry.exists(domainHash);
      expect(exists).to.be.true;
    });

    it("Creates and finds the correct tokenId", async () => {
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHashFromEvent(topLevelTx);

      const tx = await defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);

      const tokenId = await getTokenIdFromEvent(tx);
      const owner = await zns.domainToken.ownerOf(tokenId);
      expect(owner).to.eq(user.address);
    });

    it("Resolves the correct address from the domain", async () => {
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHashFromEvent(topLevelTx);

      const tx = await defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);

      const domainHash = await getDomainHashFromEvent(tx);

      const resolvedAddress = await zns.addressResolver.getAddress(domainHash);
      expect(resolvedAddress).to.eq(zns.registrar.address);
    });

    it("User registers subdomain with the parent owner approval and fires SubdomainApprovalSet", async () => {
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHashFromEvent(topLevelTx);

      const childName = "childer";
      // TODO: this needs to be fixed! we need a way to check contracts
      //  and hashes along with the namehash library, but the ":" char in
      //  0:// is illegal for the library. Find a solution and test properly!
      // const childHash = hashDomainName(`${ZERO_ROOT}${defaultDomain}.${childName}`);

      const approveTx = await zns.registrar.setSubdomainApproval(parentDomainHash, user.address, true);
      const approveReceipt = await approveTx.wait(0);
      const eventObj = approveReceipt.events?.[0];
      expect(eventObj?.event).to.eq("SubdomainApprovalSet");
      expect(eventObj?.args?.parentHash).to.eq(parentDomainHash);
      expect(eventObj?.args?.user).to.eq(user.address);
      expect(eventObj?.args?.status).to.be.true;

      const isApproved = await zns.registrar.subdomainApprovals(parentDomainHash, user.address);
      expect(isApproved).to.be.true;

      const tx = await zns.registrar.registerSubdomain(
        parentDomainHash,
        childName,
        user.address,
        AddressZero,
        AddressZero
      );
      const receipt = await tx.wait(0);
      const childHash = await getDomainHashFromEvent(receipt);

      const exists = await zns.registry.exists(childHash);
      const ownerFromRegistry = await zns.registry.getDomainOwner(childHash);

      expect(exists).to.be.true;
      expect(ownerFromRegistry).to.be.eq(user.address);
    });
  });

  describe("Reclaiming Domains", () => {
    it("Can reclaim name/stake if Token is owned", async () => {
      // Register Top level
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
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
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
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
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const domainHash = await getDomainHashFromEvent(topLevelTx);
      // Reclaim the Domain
      const tx = zns.registrar.connect(user).reclaimDomain(domainHash);

      // Verify Domain is not reclaimed
      await expect(tx).to.be.revertedWith("ZNSEthRegistrar: Not the owner of the Token");

      // Verify domain is not owned in registrar
      const registryOwner = await zns.registry.connect(user).getDomainOwner(domainHash);
      expect(registryOwner).to.equal(deployer.address);
    });

    it("Cannot reclaim if domain does not exist", async () => {
      const domainHash = "0xd34cfa279afd55afc6aa9c00aa5d01df60179840a93d10eed730058b8dd4146c";
      // Reclaim the Domain
      const tx = zns.registrar.connect(user).reclaimDomain(domainHash);

      // Verify Domain is not reclaimed
      await expect(tx).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("Domain Token can be reclaimed, transferred, and then reclaimed again", async () => {
      // Register Top level
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
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
      expect(balance).to.eq(ethers.utils.parseEther("15"));

      // Register Top level
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const domainHash = await getDomainHashFromEvent(topLevelTx);
      const tokenId = await getTokenIdFromEvent(topLevelTx);

      // Validated staked values
      const {
        expectedPrice: expectedStaked,
      } = await getPriceObject(defaultDomain, zns.priceOracle, true);
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
      const topLevelTx = await defaultRootRegistration(user, zns, defaultDomain);
      const parentDomainHash = await getDomainHashFromEvent(topLevelTx);
      const tokenId = await getTokenIdFromEvent(topLevelTx);

      // Revoke the domain and then verify
      await zns.registrar.connect(user).revokeDomain(parentDomainHash);

      // Verify token has been burned
      const ownerOfTx = zns.domainToken.connect(user).ownerOf(tokenId);
      await expect(ownerOfTx).to.be.revertedWith(
        "ERC721: invalid token ID"
      );

      // Verify Domain Record Deleted
      const exists = await zns.registry.exists(parentDomainHash);
      expect(exists).to.be.false;
    });

    it("Revokes a SubDomain - Happy Path", async () => {
      // Register Top level
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHashFromEvent(topLevelTx);

      // Register Subdomain
      const tx = await defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);
      const subDomainHash = await getDomainHashFromEvent(tx);
      const tokenId = await getTokenIdFromEvent(tx);

      // Revoke the domain and then verify
      await zns.registrar.connect(user).revokeDomain(subDomainHash);

      // Verify token has been burned
      const ownerOfTx = zns.domainToken.connect(user).ownerOf(tokenId);
      await expect(ownerOfTx).to.be.revertedWith(
        "ERC721: invalid token ID"
      );

      // Verify Domain Record Deleted
      const exists = await zns.registry.exists(subDomainHash);
      expect(exists).to.be.false;
    });

    it("Cannot revoke a domain that doesnt exist", async () => {
    // Register Top level
      const fakeHash = "0xd34cfa279afd55afc6aa9c00aa5d01df60179840a93d10eed730058b8dd4146c";
      const exists = await zns.registry.exists(fakeHash);
      expect(exists).to.be.false;

      // Verify transaction is reverted
      const tx = zns.registrar.connect(user).revokeDomain(fakeHash);
      await expect(tx).to.be.revertedWith("ZNSEthRegistrar: Not the Owner of the Name");
    });

    it("Revoking domain unstakes", async () => {
    // Verify Balance
      const balance = await zns.zeroToken.balanceOf(user.address);
      expect(balance).to.eq(ethers.utils.parseEther("15"));

      // Register Top level
      const tx = await defaultRootRegistration(user, zns, defaultDomain);
      const domainHash = await getDomainHashFromEvent(tx);

      // Validated staked values
      const {
        expectedPrice: expectedStaked,
        fee: expectedStakeFee,
      } = await getPriceObject(defaultDomain, zns.priceOracle, true);
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
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHashFromEvent(topLevelTx);
      const owner = await zns.registry.connect(user).getDomainOwner(parentDomainHash);
      expect(owner).to.not.equal(user.address);

      // Try to revoke domain
      const tx = zns.registrar.connect(user).revokeDomain(parentDomainHash);
      await expect(tx).to.be.revertedWith("ZNSEthRegistrar: Not the Owner of the Name");
    });

    it("No one can revoke if Token and Name have different owners", async () => {
      // Register Top level
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHashFromEvent(topLevelTx);
      const owner = await zns.registry.connect(user).getDomainOwner(parentDomainHash);
      expect(owner).to.not.equal(user.address);

      const tokenId = BigNumber.from(parentDomainHash);

      await zns.domainToken.transferFrom(deployer.address, user.address, tokenId);

      // Try to revoke domain as a new owner of the token
      const tx = zns.registrar.connect(user).revokeDomain(parentDomainHash);
      await expect(tx).to.be.revertedWith("ZNSEthRegistrar: Not the Owner of the Name");

      const tx2 = zns.registrar.connect(deployer).revokeDomain(parentDomainHash);
      await expect(tx2).to.be.revertedWith("ZNSEthRegistrar: Not the owner of the Token");
    });

    it("After domain has been revoked, an old operator can NOT access Registry", async () => {
      // Register Top level
      const tx = await defaultRootRegistration(user, zns, defaultDomain);
      const domainHash = await getDomainHashFromEvent(tx);

      // assign an operator
      await zns.registry.connect(user).setOwnerOperator(operator.address, true);

      // Revoke the domain
      await zns.registrar.connect(user).revokeDomain(domainHash);

      // check operator access to the revoked domain
      const rootHash = zns.registry.ROOT_HASH();
      const tx2 = zns.registry
        .connect(operator)
        .setSubdomainOwner(
          rootHash,
          domainHash,
          operator.address
        );
      await expect(tx2).to.be.revertedWith("ZNSRegistry: Not Authorized");

      const tx3 = zns.registry
        .connect(operator)
        .setSubdomainRecord(
          rootHash,
          domainHash,
          user.address,
          operator.address
        );
      await expect(tx3).to.be.revertedWith("ZNSRegistry: Not Authorized");

      const tx4 = zns.registry
        .connect(operator)
        .setDomainResolver(
          domainHash,
          zeroVault.address
        );
      await expect(tx4).to.be.revertedWith("ZNSRegistry: Not Authorized");
    });
  });

  describe("State Setters", () => {
    it("#setAccessController", async () => {
      const currentAC = await zns.registrar.getAccessController();
      const tx = await zns.registrar.connect(deployer).setAccessController(randomAcc.address);
      const newAC = await zns.registrar.getAccessController();

      await expect(tx).to.emit(zns.registrar, "AccessControllerSet").withArgs(randomAcc.address);

      expect(newAC).to.equal(randomAcc.address);
      expect(currentAC).to.not.equal(newAC);
    });

    it("#setZnsRegistry", async () => {
      const currentRegistry = await zns.registrar.znsRegistry();
      const tx = await zns.registrar.connect(deployer).setZnsRegistry(randomAcc.address);
      const newRegistry = await zns.registrar.znsRegistry();

      await expect(tx).to.emit(zns.registrar, "ZnsRegistrySet").withArgs(randomAcc.address);

      expect(newRegistry).to.equal(randomAcc.address);
      expect(currentRegistry).to.not.equal(newRegistry);
    });

    it("#setZnsTreasury", async () => {
      const currentTreasury = await zns.registrar.znsTreasury();
      const tx = await zns.registrar.connect(deployer).setZnsTreasury(randomAcc.address);
      const newTreasury = await zns.registrar.znsTreasury();

      await expect(tx).to.emit(zns.registrar, "ZnsTreasurySet").withArgs(randomAcc.address);

      expect(newTreasury).to.equal(randomAcc.address);
      expect(currentTreasury).to.not.equal(newTreasury);
    });

    it("#setZnsDomainToken", async () => {
      const currentToken = await zns.registrar.znsDomainToken();
      const tx = await zns.registrar.connect(deployer).setZnsDomainToken(randomAcc.address);
      const newToken = await zns.registrar.znsDomainToken();

      await expect(tx).to.emit(zns.registrar, "ZnsDomainTokenSet").withArgs(randomAcc.address);

      expect(newToken).to.equal(randomAcc.address);
      expect(currentToken).to.not.equal(newToken);
    });

    it("#setZnsAddressResolver", async () => {
      const currentResolver = await zns.registrar.znsAddressResolver();
      const tx = await zns.registrar.connect(deployer).setZnsAddressResolver(randomAcc.address);
      const newResolver = await zns.registrar.znsAddressResolver();

      await expect(tx).to.emit(zns.registrar, "ZnsAddressResolverSet").withArgs(randomAcc.address);

      expect(newResolver).to.equal(randomAcc.address);
      expect(currentResolver).to.not.equal(newResolver);
    });
  });
});

// TODO AC: Add tests for:
// 1. Domains can not be revoked from the buyers when transferring token
// 2. Ability to set accessController on all contracts!
