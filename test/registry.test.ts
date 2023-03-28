import * as hre from "hardhat";
// import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSRegistry, ZNSRegistry__factory } from "../typechain";

require("@nomicfoundation/hardhat-chai-matchers");

describe("ZNSRegistry Tests", () => {
  let deployer: SignerWithAddress;
  let operator: SignerWithAddress;

  // ZNSResolver has not been created, but an address will be equivalent for now
  let mockResolver: SignerWithAddress;
  let registry: ZNSRegistry;

  beforeEach(async () => {
    [deployer, operator, mockResolver] = await hre.ethers.getSigners();

    const registryFactory = new ZNSRegistry__factory(deployer);
    registry = await registryFactory.deploy();
  })
  // tests to verify that ownership of a domain allows modifying it
  // test to verify that being listed as an operator allows domain modifications propery
  // and vice versa

  //  a valid operator can change the owner of a domain, is this wanted?
  describe("Operator functionality", () => {
    it("Returns false when an operator is not allowed by an owner", async () => {
      await registry.connect(deployer).setOwnerOperator(operator.address, false);

      const allowed = await registry.isAllowedOperator(deployer.address, operator.address);
      expect(allowed).to.be.false;
    });
    it("Returns true when an operator is allowed by an owner", async () => {
      await registry.connect(deployer).setOwnerOperator(operator.address, true);

      const allowed = await registry.isAllowedOperator(deployer.address, operator.address);
      expect(allowed).to.be.true;
    });
    it("Returns false when an owner has not specified any operators", async () => {
      const allowed = await registry.isAllowedOperator(deployer.address, operator.address);

      expect(allowed).to.be.false;
    });
    it("Permits an allowed operator to modify a domain record", async () => {
      await registry.connect(deployer).setOwnerOperator(operator.address, true);

      const wilderDomainHash = hre.ethers.utils.id("wilder");
      await registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);

      await registry.connect(operator).setDomainResolver(wilderDomainHash, operator.address);

      const resolver = await registry.getDomainResolver(wilderDomainHash);
      expect(resolver).to.eq(operator.address);
    });
    it("Does not permit a disallowed operator to modify a domain record", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      await registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);

      const tx = registry.connect(operator).setDomainResolver(wilderDomainHash, operator.address);
      await expect(tx).to.be.revertedWith("ZNS: Not allowed");
    });
    // cannot modify a domain if not an allowed operator
    // an operator can modify ownership and thus remove themselves as an operator

  });
  describe("Create domain records", () => {
    it("Successfully creates a domain record", async () => {
      // the `utils.id` function returns the keccak256 hash of the given string
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      await registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);

      // Successfully gets a domain record
      const record = await registry.getDomainRecord(wilderDomainHash);
      expect(record.owner).to.eq(deployer.address);
      expect(record.resolver).to.eq(mockResolver.address);
    });
    it("Fails to create a record if no domain is given", async () => {
      const tx = registry.connect(deployer).createDomainRecord(hre.ethers.constants.HashZero, mockResolver.address);
      await expect(tx).to.be.revertedWith("ZNS: No domain given");
    });
    it("Fails to create a record if the domain already exists", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      await registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);

      const tx = registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);
      await expect(tx).to.be.revertedWith("ZNS: Domain exists");
    });
    it("Fails to create a domain if the resolver is the 0 address", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");

      const tx = registry.connect(deployer).createDomainRecord(wilderDomainHash, hre.ethers.constants.AddressZero);
      await expect(tx).to.be.revertedWith("ZNS: Zero address");
    });
    it("Returns 0 when getting a domain record that doesn't exist", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");

      const record = await registry.getDomainRecord(wilderDomainHash);
      expect(record.owner).to.eq(hre.ethers.constants.AddressZero);
      expect(record.resolver).to.eq(hre.ethers.constants.AddressZero);
    });
  });
  describe("Updating domain records", () => {
    it("Successfully sets new data on an existing domain record", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      await registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);

      // Updating the record to modify both the `owner` and `resolver`
      await registry.connect(deployer).setDomainRecord(wilderDomainHash, operator.address, operator.address);

      const record = await registry.getDomainRecord(wilderDomainHash);
      expect(record.owner).to.eq(operator.address);
      expect(record.resolver).to.eq(operator.address);
    });
    it("Fails to set a record if all values to be set are the same as the current values", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      await registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);

      const tx = registry.connect(deployer).setDomainRecord(wilderDomainHash, deployer.address, mockResolver.address);
      await expect(tx).to.be.revertedWith("ZNS: No record change");
    })
    it("Fails to set an existing domain record if no domain is given", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      await registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);

      const tx = registry.connect(deployer).setDomainRecord(hre.ethers.constants.HashZero, operator.address, operator.address);
      await expect(tx).to.be.revertedWith("ZNS: No domain given");
    });
    it("Fails to set an existing domain record if a domain is given that doesn't exist", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      const tx = registry.connect(deployer).setDomainRecord(wilderDomainHash, operator.address, operator.address);
      await expect(tx).to.be.revertedWith("ZNS: No domain found");
    });
    it("Fails to set a domain record for an unowned domain", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      await registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);

      const tx = registry.connect(operator).setDomainRecord(wilderDomainHash, operator.address, operator.address);
      await expect(tx).to.be.revertedWith("ZNS: Not allowed");
    });
    it("Allows setting domain record owner as the 0 address", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      await registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);

      await registry.connect(deployer).setDomainRecord(wilderDomainHash, hre.ethers.constants.AddressZero, operator.address);

      const owner = await registry.getDomainOwner(wilderDomainHash);
      expect(owner).to.eq(hre.ethers.constants.AddressZero);
    });
    it("Fails to set domain record if the resolver is the 0 address", async () => {
      // should set to a default register? or just fail?
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      await registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);

      const tx = registry.connect(deployer).setDomainRecord(wilderDomainHash, operator.address, hre.ethers.constants.AddressZero);
      await expect(tx).to.be.revertedWith("ZNS: Zero address");
    });
    it("Fails to set the domain owner to the current owner", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      await registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);

      const tx = registry.connect(deployer).setDomainOwner(wilderDomainHash, deployer.address);
      await expect(tx).to.be.revertedWith("ZNS: Same owner");
    });
    it("Fails to set the domain resolver to the current resolver", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      await registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);

      const tx = registry.connect(deployer).setDomainResolver(wilderDomainHash, mockResolver.address);
      await expect(tx).to.be.revertedWith("ZNS: Same resolver");
    });
  });
  describe("Get functions", () => {
    it("Successfully gets the domain owner", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      await registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);

      const owner = await registry.getDomainOwner(wilderDomainHash);
      expect(owner).to.eq(deployer.address);
    });
    it("Returns a domain owner of 0 if that domain doesn't exist", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");

      // We have not called to create the domain record, so it won't exist
      const owner = await registry.getDomainOwner(wilderDomainHash);
      expect(owner).to.eq(hre.ethers.constants.AddressZero);
    });
    it("Successfully gets the domain resolver", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      await registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);

      const resolver = await registry.getDomainResolver(wilderDomainHash);
      expect(resolver).to.eq(mockResolver.address);
    });
  });
  describe("Specific setters for domain owner and resolver", () => {
    it("Successfully sets the domain owner", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      await registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);

      const owner = await registry.getDomainOwner(wilderDomainHash);
      expect(owner).to.eq(deployer.address);

      await registry.connect(deployer).setDomainOwner(wilderDomainHash, operator.address);

      const newOwner = await registry.getDomainOwner(wilderDomainHash);
      expect(newOwner).to.eq(operator.address);
    });
    it("Successfully sets the domain resolver", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      await registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);

      const resolver = await registry.getDomainResolver(wilderDomainHash);
      expect(resolver).to.eq(mockResolver.address);

      await registry.connect(deployer).setDomainResolver(wilderDomainHash, operator.address);

      const newResolver = await registry.getDomainResolver(wilderDomainHash);
      expect(newResolver).to.eq(operator.address);
    });
  });
  describe("Event emitters", async () => {
    it("OperatorPermissionSet", async () => {
      const tx = registry.connect(deployer).setOwnerOperator(operator.address, true);
      await expect(tx).to.emit(registry, "OperatorPermissionSet").withArgs(deployer.address, operator.address, true);
    });
    it("DomainRecordCreated", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      const tx = registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);
      await expect(tx).to.emit(registry, "DomainRecordCreated").withArgs(deployer.address, mockResolver.address, wilderDomainHash);
    });
    it("DomainRecordSet", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      await registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);

      const tx = registry.connect(deployer).setDomainRecord(wilderDomainHash, operator.address, mockResolver.address);
      await expect(tx).to.emit(registry, "DomainRecordSet").withArgs(operator.address, mockResolver.address, wilderDomainHash);
    });
    it("DomainOwnerSet", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      await registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);

      const tx = registry.connect(deployer).setDomainOwner(wilderDomainHash, operator.address);
      await expect(tx).to.emit(registry, "DomainOwnerSet").withArgs(operator.address, wilderDomainHash);
    });
    it("DomainResolverSet", async () => {
      const wilderDomainHash = hre.ethers.utils.id("wilder");
      await registry.connect(deployer).createDomainRecord(wilderDomainHash, mockResolver.address);

      const tx = registry.connect(deployer).setDomainResolver(wilderDomainHash, operator.address);
      await expect(tx).to.emit(registry, "DomainResolverSet").withArgs(operator.address, wilderDomainHash);
    });
  })
})