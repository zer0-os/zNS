import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployZNS, getDomainHash, getPrice, getPriceObject, getTokenId } from "./helpers";
import { ZNSContracts } from "./helpers/types";
import * as ethers from "ethers";
import { defaultRootRegistration, defaultSubdomainRegistration } from "./helpers/registerDomain";
import { checkBalance } from "./helpers/balances";
import { priceConfigDefault } from "./helpers/constants";

require("@nomicfoundation/hardhat-chai-matchers");


// TODO reg: test revocation process
describe("ZNSEthRegistrar", () => {
  let deployer : SignerWithAddress;
  let user : SignerWithAddress;

  let zns : ZNSContracts;
  let zeroVault : SignerWithAddress;
  const defaultDomain = "wilder";
  const defaultSubdomain = "world";

  beforeEach(async () => {
    [deployer, zeroVault, user] = await hre.ethers.getSigners();
    // Burn address is used to hold the fee charged to the user when registering
    zns = await deployZNS(deployer, priceConfigDefault, zeroVault.address);

    // TODO reg: is this the correct way of doing this?
    // Give the user permission on behalf of the parent domain owner
    await zns.registry.connect(deployer).setOwnerOperator(user.address, true);

    // TODO reg: is this the correct way of doing this? doesn't seem like it.
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
      ).to.be.revertedWith("ZNSEthRegistrar: No domain name");
    });

    it("Stakes the correct amount, takes the correct fee and sends fee to Zero Vault", async () => {
      const balanceBeforeUser = await zns.zeroToken.balanceOf(user.address);
      const balanceBeforeVault = await zns.zeroToken.balanceOf(zeroVault.address);

      // Deploy "wilder" with default configuration
      const tx = await defaultRootRegistration(user, zns, defaultDomain);
      const domainHash = await getDomainHash(tx);
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
      const domainHash = await getDomainHash(tx);

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

      const domainHash = await getDomainHash(tx);
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

      const domainHash = await getDomainHash(tx);

      const exists = await zns.registry.exists(domainHash);
      expect(exists).to.be.true;
    });

    it("Creates and finds the correct tokenId", async () => {
      const tx = await defaultRootRegistration(deployer, zns, defaultDomain);

      const tokenId = await getTokenId(tx);
      const owner = await zns.domainToken.ownerOf(tokenId);
      expect(owner).to.eq(deployer.address);
    });

    it("Resolves the correct address from the domain", async () => {
      const tx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const domainHash = await getDomainHash(tx);

      const resolvedAddress = await zns.addressResolver.getAddress(domainHash);
      expect(resolvedAddress).to.eq(zns.registrar.address);
    });
  });

  // TODO reg: add tests for approval process
  describe("Registers a subdomain", () => {
    it("Can NOT register a subdomain with an empty name", async () => {
      const emptyName = "";

      const parentTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHash(parentTx);

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
      const parentDomainHash = await getDomainHash(parentReceipt);
      const subReceipt = await defaultSubdomainRegistration(
        user,
        zns,
        parentDomainHash,
        defaultSubdomain
      );

      const subdomainHash = await getDomainHash(subReceipt);

      const {
        owner: ownerFromReg,
        resolver: resolverFromReg,
      } = await zns.registry.getDomainRecord(subdomainHash);

      expect(ownerFromReg).to.eq(user.address);
      expect(resolverFromReg).to.eq(zns.addressResolver.address);
    });

    it("Staked the correct amount and takes the correct fee", async () => {
      const parentTx = await defaultRootRegistration(deployer, zns, defaultDomain);

      const parentDomainHash = await getDomainHash(parentTx);

      const balanceBefore = await zns.zeroToken.balanceOf(user.address);
      const tx = await defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);
      const subdomainHash = await getDomainHash(tx);

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
      const parentDomainHash = await getDomainHash(parentTx);

      await zns.zeroToken.connect(user).transfer(zns.zeroToken.address, ethers.utils.parseEther("15"));

      const tx = defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);
      await expect(tx).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Allows unicode characters in domain names", async () => {
      const parentTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHash(parentTx);

      const unicodeDomain = "œ柸þ€§ﾪ";

      const tx = await defaultSubdomainRegistration(user, zns, parentDomainHash, unicodeDomain);

      const domainHash = await getDomainHash(tx);
      expect(await zns.registry.exists(domainHash)).to.be.true;

      const expectedStaked = await getPrice(unicodeDomain, zns.priceOracle, false);
      const staked = await zns.treasury.stakedForDomain(domainHash);
      expect(expectedStaked).to.eq(staked);
    });

    it("Disallows creation of a duplicate domain", async () => {
      const parentTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHash(parentTx);

      await defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);
      const failTx = defaultSubdomainRegistration(deployer, zns, parentDomainHash, defaultSubdomain);

      await expect(failTx).to.be.revertedWith("ZNSEthRegistrar: Domain already exists");
    });

    // TODO call as mock registrar
    it("Fails when a resolver is given without an address to resolve to", async () => {
      const parentTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHash(parentTx);

      const tx = zns.registrar.connect(user).registerSubdomain(
        parentDomainHash,
        defaultDomain,
        user.address,
        zns.addressResolver.address,
        ethers.constants.AddressZero
      );

      await expect(tx).to.be.revertedWith("ZNSEthRegistrar: No domain content provided");
    });

    // verify costs using a struct or not in price oracle
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
      const tx = zns.registrar.connect(user).registerRootDomain(
        defaultSubdomain,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      );

      await expect(tx).to.not.be.reverted;
    });

    it("Records the correct subdomain hash", async () => {
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHash(topLevelTx);

      const tx = await defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);

      const domainHash = await getDomainHash(tx);

      const exists = await zns.registry.exists(domainHash);
      expect(exists).to.be.true;
    });

    it("Creates and finds the correct tokenId", async () => {
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHash(topLevelTx);

      const tx = await defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);

      const tokenId = await getTokenId(tx);
      const owner = await zns.domainToken.ownerOf(tokenId);
      expect(owner).to.eq(user.address);
    });

    it("Resolves the correct address from the domain", async () => {
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHash(topLevelTx);

      const tx = await defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);

      const domainHash = await getDomainHash(tx);

      const resolvedAddress = await zns.addressResolver.getAddress(domainHash);
      expect(resolvedAddress).to.eq(zns.registrar.address);
    });
  });

  describe("Reclaiming Domains", () => {
    it("Can reclaim name/stake if Token is owned", async () => {
      // Register Top level
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const domainHash = await getDomainHash(topLevelTx);
      const tokenId = await getTokenId(topLevelTx);
      const staked = await zns.treasury.stakedForDomain(domainHash);

      // Transfer the domain token
      await zns.domainToken.connect(deployer).transferFrom(deployer.address, user.address, tokenId);

      // Reclaim the Domain
      await zns.registrar.connect(user).reclaimDomain(domainHash);
      // Verify domain token is still owned
      const owner  = await zns.domainToken.connect(user).ownerOf(tokenId);
      expect(owner).to.equal(user.address);

      // Verify domain is owned in registrar
      const registryOwner = await zns.registry.connect(user).getDomainOwner(domainHash);
      expect(registryOwner).to.equal(user.address);

      // Verify same amount is staked
      const stakedAfterReclaim = await zns.treasury.stakedForDomain(domainHash);
      expect(staked).to.equal(stakedAfterReclaim);

      // Verify address of owner in addressResolver
      const addressResolverAddress = await zns.addressResolver.getAddress(domainHash);
      expect(addressResolverAddress).to.equal(user.address);
    });

    it("Reclaiming domain token emits DomainReclaimed event", async () => {
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const domainHash = await getDomainHash(topLevelTx);
      const tokenId = await getTokenId(topLevelTx);

      // Transfer the domain token
      await zns.domainToken.connect(deployer).transferFrom(deployer.address, user.address, tokenId);
      // Reclaim the Domain
      const tx = await zns.registrar.connect(user).reclaimDomain(domainHash);
      const receipt = await tx.wait(0);

      // Verify Transfer event is emitted
      expect(receipt.events?.[2].event).to.eq("DomainReclaimed");
      expect(receipt.events?.[2].args?.domainHash).to.eq(
        domainHash
      );
      expect(receipt.events?.[2].args?.registrant).to.eq(
        user.address
      );
    });

    it("Cannot reclaim name/stake if token is not owned", async () => {
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const domainHash = await getDomainHash(topLevelTx);
      // Reclaim the Domain
      const tx = zns.registrar.connect(user).reclaimDomain(domainHash);

      // Verify Domain is not reclaimed
      await expect(tx).to.be.revertedWith("ZNSEthRegistrar: Not owner of domain");

      // Verify domain is not owned in registrar
      const registryOwner = await zns.registry.connect(user).getDomainOwner(domainHash);
      expect(registryOwner).to.equal(deployer.address);
    });

    it("Cannot reclaim if domain does not exist", async () => {
      const domainHash = "0xd34cfa279afd55afc6aa9c00aa5d01df60179840a93d10eed730058b8dd4146c";
      // Reclaim the Domain
      const tx = zns.registrar.connect(user).reclaimDomain(domainHash);

      // Verify Domain is not reclaimed
      await expect(tx).to.be.revertedWith("ZNSEthRegistrar: Domain does not exist");
    });

    it("Domain Token can be reclaimed, transferred, and then reclaimed again", async () => {
      // Register Top level
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const domainHash = await getDomainHash(topLevelTx);
      const tokenId = await getTokenId(topLevelTx);
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

      // Verify address of owner in addressResolver
      const addressResolverAddress = await zns.addressResolver.getAddress(domainHash);
      expect(addressResolverAddress).to.equal(deployer.address);
    });

    it("Cannot reclaim if name/stake is already owned by caller", async () => {
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const domainHash = await getDomainHash(topLevelTx);
      // Reclaim the Domain
      const tx = zns.registrar.connect(deployer).reclaimDomain(domainHash);

      // Verify Domain is not reclaimed
      await expect(tx).to.be.revertedWith("ZNSEthRegistrar: Caller already owner of domain registry");

      // Verify domain is not owned in registrar
      const registryOwner = await zns.registry.connect(user).getDomainOwner(domainHash);
      expect(registryOwner).to.equal(deployer.address);
    });
  });

  describe("Revoking Domains", () => {
    it ("Revokes a Top level Domain - Happy Path", async () => {
    // Register Top level
      const topLevelTx = await defaultRootRegistration(user, zns, defaultDomain);
      const parentDomainHash = await getDomainHash(topLevelTx);
      const tokenId = await getTokenId(topLevelTx);

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

    it ("Revokes a SubDomain - Happy Path", async () => {
    // Register Top level
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHash(topLevelTx);

      // Register Subdomain
      const tx = await defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);
      const subDomainHash = await getDomainHash(tx);
      const tokenId = await getTokenId(tx);

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

    it ("Cannot revoke a domain that doesnt exist", async () => {
    // Register Top level
      const fakeHash = "0xd34cfa279afd55afc6aa9c00aa5d01df60179840a93d10eed730058b8dd4146c";
      const exists = await zns.registry.exists(fakeHash);
      expect(exists).to.be.false;

      // Verify transaction is reverted
      const tx = zns.registrar.connect(user).revokeDomain(fakeHash);
      await expect(tx).to.be.revertedWith("ZNSEthRegistrar: Not Owner");
    });

    it ("Revoked domain unstakes", async () => {
    // Verify Balance
      const balance = await zns.zeroToken.balanceOf(user.address);
      expect(balance).to.eq(ethers.utils.parseEther("15"));

      // Register Top level
      const tx = await defaultRootRegistration(user, zns, defaultDomain);
      const domainHash = await getDomainHash(tx);

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

    it ("Cannot revoke a domain owned by another user", async () => {
    // Register Top level
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHash(topLevelTx);
      const owner = await zns.registry.connect(user).getDomainOwner(parentDomainHash);
      expect(owner).to.not.equal(user.address);

      // Try to revoke domain
      const tx = zns.registrar.connect(user).revokeDomain(parentDomainHash);
      await expect(tx).to.be.revertedWith("ZNSEthRegistrar: Not Owner");
    });
  });
});