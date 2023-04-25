import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployZNS, getDomainHash, getEvent, getPrice, getTokenId } from "./helpers";
import { ZNSContracts } from "./helpers/types";
import * as ethers from "ethers";
import { defaultRootRegistration, defaultSubdomainRegistration } from "./helpers/registerDomain";

require("@nomicfoundation/hardhat-chai-matchers");

describe("ZNSEthRegistrar", () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;

  let zns: ZNSContracts;
  let burn: SignerWithAddress;
  const defaultDomain = "wilder";
  const defaultSubdomain = "world";

  beforeEach(async () => {
    [deployer, burn, user] = await hre.ethers.getSigners();
    // Burn address is used to hold the fee charged to the user when registering
    zns = await deployZNS(deployer, burn.address);

    // Give the user permission on behalf of the parent domain owner
    await zns.registry.connect(deployer).setOwnerOperator(user.address, true);

    // Give the registrar permission on behalf of the user
    await zns.registry.connect(user).setOwnerOperator(zns.registrar.address, true);

    // Give funds to user
    await zns.zeroToken.connect(user).approve(zns.treasury.address, ethers.constants.MaxUint256);
    await zns.zeroToken.transfer(user.address, ethers.utils.parseEther("15"));
  });

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
    it("Staked the correct amount", async () => {
      // Deploy "wilder" with default configuration
      const tx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const domainHash = await getDomainHash(tx);

      const expectedStaked = await getPrice(defaultDomain, zns.priceOracle, true);
      const staked = await zns.treasury.stakedForDomain(domainHash);

      expect(staked).to.eq(expectedStaked);
    });

    it("Fails when the user does not have enough funds", async () => {
      await zns.zeroToken.connect(user).transfer(zns.zeroToken.address, ethers.utils.parseEther("15"));

      const tx = defaultRootRegistration(user, zns, defaultDomain);
      await expect(tx).to.be.revertedWith("ZNSTreasury: Not enough funds");
    });

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

  describe("Registers a subdomain", () => {
    // let parentDomainHash: string;

    // beforeEach(async () => {
    //   const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain)
    //   parentDomainHash = await getDomainHash(topLevelTx);
    // });

    it("Staked the correct amount", async () => {
      const parentTx = await defaultRootRegistration(deployer, zns, defaultDomain);

      const parentDomainHash = await getDomainHash(parentTx);

      const tx = await defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);

      const subdomainHash = await getDomainHash(tx);

      const expectedStaked = await getPrice(defaultSubdomain, zns.priceOracle, false);
      const staked = await zns.treasury.stakedForDomain(subdomainHash);
      expect(staked).to.eq(expectedStaked);
    });

    it("Fails when the user does not have enough funds", async () => {
      const parentTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHash(parentTx);

      await zns.zeroToken.connect(user).transfer(zns.zeroToken.address, ethers.utils.parseEther("15"));

      const tx = defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);
      await expect(tx).to.be.revertedWith("ZNSTreasury: Not enough funds");
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
