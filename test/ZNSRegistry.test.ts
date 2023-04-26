import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSRegistry } from "../typechain";
import { deployRegistry } from "./helpers/deployZNS";
import { ethers } from "ethers";
import { getDomainHash } from "./helpers";

require("@nomicfoundation/hardhat-chai-matchers");

/**
 * TODO should we disallow burning the root domain?
 * The process of burning would transfer ownership to the 0x0 address
 * Nobody would be able to successfully mint new subdomaisn in this scenario
 * In the case the `owner` we set in the initializer is an EOA, it's a
 * possibility the account is compromised
 */

describe("ZNSRegistry Tests", () => {
  let deployer : SignerWithAddress;
  let operator : SignerWithAddress;
  let randomUser : SignerWithAddress;

  // ZNSResolver has not been created, but an address will be equivalent for now
  let mockResolver : SignerWithAddress;
  let registry : ZNSRegistry;
  let rootDomainHash : string;
  let wilderSubdomainHash : string;

  const wilderLabel = ethers.utils.id("wilder");

  // Set owner of 0x0 domain in initalizer, will be used by every other subdomain
  // const rootDomainHash = ethers.constants.HashZero;
  // const wilderLabel = ethers.utils.id("wilder");

  // Wilder subdomain hash created in `setSubdomainRecord` call to `setSubdomainOwner`
  // TODO:  change all the calls for hashing in all the tests to use ENS `namehash` lib
  //        that checks and validates strings before hashing
  // const wilderSubdomainHash = ethers.utils.solidityKeccak256(["bytes32", "bytes32"], [rootDomainHash, wilderLabel]);

  beforeEach(async () => {
    [deployer, operator, randomUser, mockResolver] = await hre.ethers.getSigners();

    registry = await deployRegistry(deployer);

    rootDomainHash = await registry.ROOT_HASH();
    wilderSubdomainHash = ethers.utils.solidityKeccak256(["bytes32", "bytes32"], [rootDomainHash, wilderLabel]);

    // Create a first domain from the base domain
    await registry
      .connect(deployer)
      .setSubdomainRecord(
        rootDomainHash,
        wilderSubdomainHash,
        deployer.address,
        mockResolver.address
      );
  });

  // a valid operator can change the owner of a domain, is this wanted?
  describe("Operator functionality", () => {
    it("Returns false when an operator is not allowed by an owner", async () => {
      await registry.connect(deployer).setOwnerOperator(operator.address, false);

      const allowed = await registry.isAllowedOperator(
        deployer.address,
        operator.address
      );
      expect(allowed).to.be.false;
    });

    it("Returns true when an operator is allowed by an owner", async () => {
      await registry.connect(deployer).setOwnerOperator(operator.address, true);

      const allowed = await registry.isAllowedOperator(
        deployer.address,
        operator.address
      );
      expect(allowed).to.be.true;
    });

    it("Returns false when an owner has not specified any operators", async () => {
      const allowed = await registry.isAllowedOperator(deployer.address, operator.address);

      expect(allowed).to.be.false;
    });

    it("Permits an allowed operator to modify a domain record", async () => {
      await registry.connect(deployer).setOwnerOperator(operator.address, true);

      const tx = registry
        .connect(operator)
        .setDomainResolver(wilderSubdomainHash, operator.address);
      await expect(tx).to.not.be.reverted;
    });

    it("Does not permit a disallowed operator to modify a domain record", async () => {
      await registry.connect(deployer).setOwnerOperator(operator.address, false);

      const tx = registry.connect(operator).setDomainResolver(wilderSubdomainHash, operator.address);
      await expect(tx).to.be.revertedWith("ZNSRegistry: Not allowed");
    });

    it("Does not permit an operator that's never been allowed to modify a record", async () => {
      const tx = registry.connect(operator).setDomainResolver(wilderSubdomainHash, operator.address);
      await expect(tx).to.be.revertedWith("ZNSRegistry: Not allowed");
    });
  });

  describe("Domain records", async () => {
    it("Checks existence of a domain correctly", async () => {
      const exists = await registry.connect(randomUser).exists(wilderSubdomainHash);
      expect(exists).to.be.true;

      const nonExistentDomainHash = ethers.utils
        .solidityKeccak256(
          ["bytes32"],
          [ethers.utils.id("wild")]
        );
      const notExists = await registry.connect(randomUser).exists(nonExistentDomainHash);
      expect(notExists).to.be.false;
    });

    it("Gets a domain record", async () => {
      // Domain exists
      const rootRecord = await registry.getDomainRecord(rootDomainHash);
      expect(rootRecord.owner).to.eq(deployer.address);

      // Domain exists
      const wilderRecord = await registry.getDomainRecord(wilderSubdomainHash);
      expect(wilderRecord.owner).to.eq(deployer.address);

      // Domain does not exist
      const domainHash = ethers.utils.id("random-record");
      const record = await registry.getDomainRecord(domainHash);
      expect(record.owner).to.eq(ethers.constants.AddressZero);
    });

    it("Gets a domain owner", async () => {
      // The domain exists
      const existOwner = await registry.getDomainOwner(wilderSubdomainHash);
      expect(existOwner).to.eq(deployer.address);

      // The domain does not exist
      const domainHash = ethers.utils.id("random-record");
      const notExistOwner = await registry.getDomainOwner(domainHash);
      expect(notExistOwner).to.eq(ethers.constants.AddressZero);
    });

    it("Gets a domain resolver", async () => {
      // The domain exists
      const existResolver = await registry.getDomainResolver(wilderSubdomainHash);
      expect(existResolver).to.eq(mockResolver.address);

      // The domain does not exist
      const domainHash = ethers.utils.id("random-record");
      const notExistResolver = await registry.getDomainResolver(domainHash);
      expect(notExistResolver).to.eq(ethers.constants.AddressZero);
    });
  });

  describe("Setter functions for a domain's record, owner, or resolver", () => {
    it("Sets a subdomain record", async () => {
      // In order to set a subdomain, the caller must be the owner of the parent domain
      const domain = ethers.utils.id("zero");

      const tx = await registry
        .connect(deployer)
        .setSubdomainRecord(
          wilderSubdomainHash,
          domain,
          deployer.address,
          mockResolver.address
        );

      const domainHash = await getDomainHash(tx, "DomainOwnerSet");

      const zeroOwner = await registry.getDomainOwner(domainHash);
      expect(zeroOwner).to.eq(deployer.address);
    });

    it("Fails to set a subdomain record because caller is not the owner of the parent domain", async () => {
      const zeroLabel = ethers.utils.id("zero");

      const tx = registry
        .connect(operator)
        .setSubdomainRecord(
          wilderSubdomainHash,
          zeroLabel,
          deployer.address,
          mockResolver.address
        );
      await expect(tx).to.be.revertedWith("ZNSRegistry: Not allowed");
    });
  });
});
