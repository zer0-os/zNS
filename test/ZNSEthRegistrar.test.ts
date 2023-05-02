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

  // TODO reg: delete this
  // Uncomment if needed
  // it("Confirms deployment", async () => {
  // console.log(`Registrar: ${zns.registrar.address}`);
  // console.log(`Registry: ${zns.registry.address}`);
  // console.log(`PriceOracle: ${zns.priceOracle.address}`);
  // console.log(`AddressResolver: ${zns.addressResolver.address}`);
  // console.log(`DomainToken: ${zns.domainToken.address}`);
  // console.log(`Treasury: ${zns.treasury.address}`);
  // console.log(`zeroToken: ${zns.zeroToken.address}`);
  // });

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
    // let parentDomainHash: string;

    // TODO reg: do we need this?
    // beforeEach(async () => {
    //   const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain)
    //   parentDomainHash = await getDomainHash(topLevelTx);
    // });

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
});
