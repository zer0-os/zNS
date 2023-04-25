import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployRegistrar, deployZNS, getDomainHash, getEvent, getPrice, getTokenId } from "./helpers";
import { ZNSContracts } from "./helpers/types";
import * as ethers from "ethers";
import { defaultRootRegistration, defaultSubdomainRegistration } from "./helpers/registerDomain";

require("@nomicfoundation/hardhat-chai-matchers");

describe("ZNSEthRegistrar", () => {
  let deployer : SignerWithAddress;
  let user : SignerWithAddress;

  let zns : ZNSContracts;
  let burn : SignerWithAddress;
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

      const domainHash = await getDomainHash(tx, "RootDomainRegistered");

      const expectedStaked = await getPrice(defaultDomain, zns.priceOracle, true);
      const staked = await zns.treasury.getStakedAmountForDomain(domainHash);
      expect(staked).to.eq(expectedStaked);
    });

    it("Records the correct domain hash", async () => {
      const tx = await defaultRootRegistration(deployer, zns, defaultDomain);

      const domainHash = await getDomainHash(tx, "RootDomainRegistered");

      const exists = await zns.registry.exists(domainHash);
      expect(exists).to.be.true;
    });

    it("Creates and finds the correct tokenId", async () => {
      const tx = await defaultRootRegistration(deployer, zns, defaultDomain);

      const tokenId = await getTokenId(tx, "RootDomainRegistered");
      const owner = await zns.domainToken.ownerOf(tokenId);
      expect(owner).to.eq(deployer.address);
    });

    it("Resolves the correct address from the domain", async () => {
      const tx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const domainHash = await getDomainHash(tx, "RootDomainRegistered");

      const resolvedAddress = await zns.addressResolver.getAddress(domainHash);
      expect(resolvedAddress).to.eq(zns.registrar.address);
    });
  });
  describe("Registers a subdomain", () => {
    it("Staked the correct amount", async () => {
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHash(topLevelTx, "RootDomainRegistered");

      const tx = await defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);

      const domainHash = await getDomainHash(tx, "SubdomainRegistered");

      const expectedStaked = await getPrice(defaultSubdomain, zns.priceOracle, false);
      const staked = await zns.treasury.getStakedAmountForDomain(domainHash);
      expect(staked).to.eq(expectedStaked);
    });

    it("Records the correct subdomain hash", async () => {
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHash(topLevelTx, "RootDomainRegistered");

      const tx = await defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);

      const domainHash = await getDomainHash(tx, "SubdomainRegistered");

      const exists = await zns.registry.exists(domainHash);
      expect(exists).to.be.true;
    });

    it("Creates and finds the correct tokenId", async () => {
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHash(topLevelTx, "RootDomainRegistered");

      const tx = await defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);

      const tokenId = await getTokenId(tx, "SubdomainRegistered");
      const owner = await zns.domainToken.ownerOf(tokenId);
      expect(owner).to.eq(user.address);
    });

    it("Resolves the correct address from the domain", async () => {
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
      const parentDomainHash = await getDomainHash(topLevelTx, "RootDomainRegistered");

      const tx = await defaultSubdomainRegistration(user, zns, parentDomainHash, defaultSubdomain);

      const domainHash = await getDomainHash(tx, "SubdomainRegistered");

      const resolvedAddress = await zns.addressResolver.getAddress(domainHash);
      expect(resolvedAddress).to.eq(zns.registrar.address);
    });
  });
  describe("Revokes a Domain", () => {
    it ("Revokes a Top level Domain - Happy Path", async () => {
      // Register Top level
      const topLevelTx = await defaultRootRegistration(user, zns, defaultDomain);
      const parentDomainHash = await getDomainHash(topLevelTx, "RootDomainRegistered");
      const tokenId = await getTokenId(topLevelTx, "RootDomainRegistered");

      // Revoke the domain and then verify
      await zns.registrar.connect(user).revokeDomain(parentDomainHash);

      // Verify token has been burned
      const ownerOfTx = zns.domainToken.connect(user).ownerOf(tokenId);
      await expect(ownerOfTx).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      // Verify funds have been unstaked
      // Verify Domain Record Deleted
      // No records
    });
    it ("Revokes a SubDomain - Happy Path", async () => {
      // Register Top level
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
    });

    it ("Cannot revoke a domain that doesnt exist", async () => {
      // Register Top level
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
    });

    it ("Revoked domain unstakes", async () => {
      // Register Top level
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
    });

    it ("Revoked domain unstakes without any funds", async () => {
      // Register Top level
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
    });

    it ("Cannot revoke a domain owned by another user", async () => {
      // Register Top level
      const topLevelTx = await defaultRootRegistration(deployer, zns, defaultDomain);
    });
  });
});
