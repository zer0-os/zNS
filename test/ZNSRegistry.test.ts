import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSAccessController, ZNSRegistry } from "../typechain";
import { deployRegistry } from "./helpers/deployZNS";
import { ethers } from "ethers";
import { hashDomainLabel, hashDomainName } from "./helpers/hashing";
import {
  ADMIN_ROLE,
  deployAccessController,
  getAccessRevertMsg, INITIALIZED_ERR,
  REGISTRAR_ROLE,
} from "./helpers";
import {
  ONLY_NAME_OWNER_REG_ERR,
  NOT_AUTHORIZED_REG_ERR,
  ONLY_OWNER_REGISTRAR_REG_ERR,
  OWNER_NOT_ZERO_REG_ERR,
} from "./helpers/errors";

// eslint-disable-next-line @typescript-eslint/no-var-requires
require("@nomicfoundation/hardhat-chai-matchers");


describe("ZNSRegistry Tests", () => {
  let deployer : SignerWithAddress;
  let operator : SignerWithAddress;
  let randomUser : SignerWithAddress;

  // An address will be all that's needed to test the Registry
  let mockResolver : SignerWithAddress;
  let mockRegistrar : SignerWithAddress;

  let registry : ZNSRegistry;
  let accessController : ZNSAccessController;
  let wilderDomainHash : string;

  beforeEach(async () => {
    [deployer, operator, randomUser, mockResolver, mockRegistrar] = await hre.ethers.getSigners();

    accessController = await deployAccessController({
      deployer,
      governorAddresses: [deployer.address],
      adminAddresses: [deployer.address],
    });
    await accessController.connect(deployer).grantRole(REGISTRAR_ROLE, mockRegistrar.address);

    registry = await deployRegistry(deployer, accessController.address);

    wilderDomainHash = hashDomainName("wilder");

    await registry.connect(mockRegistrar).createDomainRecord(
      wilderDomainHash,
      deployer.address,
      mockResolver.address
    );
  });

  it("Cannot be initialized twice", async () => {
    await expect(
      registry.initialize(
        accessController.address
      )
    ).to.be.revertedWith(
      INITIALIZED_ERR
    );
  });

  it("Should set access controller correctly with ADMIN_ROLE", async () => {
    const currentAC = await registry.getAccessController();

    await registry.connect(deployer).setAccessController(randomUser.address);
    const newAC = await registry.getAccessController();

    expect(currentAC).to.not.equal(newAC);
    expect(newAC).to.equal(randomUser.address);
  });

  it("Should revert when setting access controller without ADMIN_ROLE", async () => {
    await expect(
      registry.connect(randomUser).setAccessController(deployer.address)
    ).to.be.revertedWith(
      getAccessRevertMsg(randomUser.address, ADMIN_ROLE)
    );
  });

  describe("Operator functionality", () => {
    it("Returns false when an operator is not allowed by an owner", async () => {
      await registry.connect(deployer).setOwnerOperator(operator.address, false);

      const allowed = await registry.isOwnerOrOperator(
        wilderDomainHash,
        operator.address
      );
      expect(allowed).to.be.false;
    });

    it("Returns true when an operator is allowed by an owner", async () => {
      await registry.connect(deployer).setOwnerOperator(operator.address, true);

      const allowed = await registry.isOwnerOrOperator(
        wilderDomainHash,
        operator.address
      );
      expect(allowed).to.be.true;
    });

    it("Returns false when an owner has not specified any operators", async () => {
      const allowed = await registry.isOwnerOrOperator(wilderDomainHash, operator.address);

      expect(allowed).to.be.false;
    });

    it("Permits an allowed operator to update a domain resolver", async () => {
      await registry.connect(deployer).setOwnerOperator(operator.address, true);

      const tx = registry
        .connect(operator)
        .updateDomainResolver(wilderDomainHash, operator.address);
      await expect(tx).to.not.be.reverted;
    });

    it("Does not permit an allowed operator to update a domain owner", async () => {
      await registry.connect(deployer).setOwnerOperator(operator.address, true);

      const tx = registry
        .connect(operator)
        .updateDomainOwner(wilderDomainHash, operator.address);
      await expect(tx).to.be.revertedWith(ONLY_OWNER_REGISTRAR_REG_ERR);
    });

    it("Does not permit an allowed operator to update a domain record", async () => {
      await registry.connect(deployer).setOwnerOperator(operator.address, true);

      const tx = registry
        .connect(operator)
        .updateDomainRecord(wilderDomainHash, operator.address, operator.address);
      await expect(tx).to.be.revertedWith(ONLY_NAME_OWNER_REG_ERR);
    });

    it("Does not permit a disallowed operator to update a domain record", async () => {
      await registry.connect(deployer).setOwnerOperator(operator.address, false);

      const tx = registry.connect(operator).updateDomainResolver(wilderDomainHash, operator.address);
      await expect(tx).to.be.revertedWith(NOT_AUTHORIZED_REG_ERR);
    });

    it("Does not permit an operator that's never been allowed to modify a record", async () => {
      const tx = registry.connect(operator).updateDomainResolver(wilderDomainHash, operator.address);
      await expect(tx).to.be.revertedWith(NOT_AUTHORIZED_REG_ERR);
    });
  });

  describe("Domain records", async () => {
    it("Verifies existence of a domain correctly", async () => {
      const exists = await registry.connect(randomUser).exists(wilderDomainHash);
      expect(exists).to.be.true;

      const nonExistentDomainHash = hashDomainName("wild");

      const notExists = await registry.connect(randomUser).exists(nonExistentDomainHash);
      expect(notExists).to.be.false;
    });

    it("Gets a domain record", async () => {
      // Domain exists
      const wilderRecord = await registry.getDomainRecord(wilderDomainHash);
      expect(wilderRecord.owner).to.eq(deployer.address);

      // Domain does not exist
      const domainHash = hashDomainLabel("random-record");
      const record = await registry.getDomainRecord(domainHash);
      expect(record.owner).to.eq(ethers.constants.AddressZero);
    });

    it("Gets a domain owner", async () => {
      // The domain exists
      const existOwner = await registry.getDomainOwner(wilderDomainHash);
      expect(existOwner).to.eq(deployer.address);

      // The domain does not exist
      const domainHash = hashDomainLabel("random-record");
      const notExistOwner = await registry.getDomainOwner(domainHash);
      expect(notExistOwner).to.eq(ethers.constants.AddressZero);
    });

    it("Gets a domain resolver", async () => {
      // The domain exists
      const existResolver = await registry.getDomainResolver(wilderDomainHash);
      expect(existResolver).to.eq(mockResolver.address);

      // The domain does not exist
      const domainHash = hashDomainLabel("random-record");
      const notExistResolver = await registry.getDomainResolver(domainHash);
      expect(notExistResolver).to.eq(ethers.constants.AddressZero);
    });

    it("Creates a new domain record successfully", async () => {
      const domainHash = hashDomainLabel("world");

      await registry.connect(mockRegistrar).createDomainRecord(
        domainHash,
        deployer.address,
        mockResolver.address
      );
    });

    it("Fails to create a new domain record if the caller does not have REGISTRAR_ROLE", async () => {
      const domainHash = hashDomainLabel("world");

      const tx = registry.connect(deployer).createDomainRecord(
        domainHash,
        deployer.address,
        mockResolver.address
      );

      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(deployer.address, REGISTRAR_ROLE)
      );
    });
  });

  describe("Setter functions for a domain's record, owner, or resolver", () => {
    it("Cannot update a domain record if the domain doesn't exist", async () => {
      const domainHash = hashDomainLabel("world");

      const tx = registry.updateDomainRecord(domainHash, deployer.address, mockResolver.address);

      // Because nobody owns a non-existing record, the error is caught by the `onlyOwnerOrOperator` first
      await expect(tx).to.be.revertedWith(ONLY_NAME_OWNER_REG_ERR);
    });

    it("Can update a domain record if the domain exists", async () => {
      const domainHash = hashDomainLabel("world");

      await registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, mockResolver.address);
      await registry.updateDomainRecord(domainHash, mockRegistrar.address, deployer.address);

      const record = await registry.getDomainRecord(domainHash);

      expect(record.owner).to.eq(mockRegistrar.address);
      expect(record.resolver).to.eq(deployer.address);
    });

    it("Cannot update a domain owner if the domain doesn't exist", async () => {
      const domainHash = hashDomainLabel("world");

      const tx = registry.updateDomainOwner(domainHash, deployer.address);

      // Because nobody owns a non-existing record, the error is caught by the `onlyOwnerOrOperator` first
      await expect(tx).to.be.revertedWith(
        ONLY_OWNER_REGISTRAR_REG_ERR
      );
    });

    it("Can update a domain owner if the domain exists", async () => {
      const domainHash = hashDomainLabel("world");

      await registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, mockResolver.address);
      await registry.updateDomainOwner(domainHash, mockRegistrar.address);

      const record = await registry.getDomainRecord(domainHash);

      expect(record.owner).to.eq(mockRegistrar.address);
    });

    it("Cannot update a domain resolver if the domain doesn't exist", async () => {
      const domainHash = hashDomainLabel("world");
      const tx = registry.updateDomainResolver(domainHash, mockResolver.address);

      // Because nobody owns a non-existing record, the error is caught by the `onlyOwnerOrOperator` first
      await expect(tx).to.be.revertedWith(NOT_AUTHORIZED_REG_ERR);
    });

    it("Can update a domain resolver if the domain exists", async () => {
      const domainHash = hashDomainLabel("world");

      await registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, mockResolver.address);
      await registry.updateDomainResolver(domainHash, deployer.address);

      const record = await registry.getDomainRecord(domainHash);

      expect(record.resolver).to.eq(deployer.address);
    });

    it("Cannot update a domain record if the owner is zero address", async () => {
      const domainHash = hashDomainLabel("world");

      await registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, mockResolver.address);
      const tx = registry.updateDomainRecord(domainHash, ethers.constants.AddressZero, mockResolver.address);

      await expect(tx).to.be.revertedWith(OWNER_NOT_ZERO_REG_ERR);
    });

    it("Can update a domain record if the resolver is zero address", async () => {
      const domainHash = hashDomainLabel("world");

      await registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, mockResolver.address);
      const tx = registry.updateDomainRecord(domainHash, mockResolver.address, ethers.constants.AddressZero);

      await expect(tx).to.be.fulfilled;
    });

    it("Cannot update a domain owner if owner is zero address", async () => {
      const tx = registry
        .connect(deployer)
        .updateDomainOwner(
          wilderDomainHash,
          ethers.constants.AddressZero
        );

      await expect(tx).to.be.revertedWith(OWNER_NOT_ZERO_REG_ERR);
    });

    it("Can update a domain resolver if resolver is zero address", async () => {
      await registry
        .connect(deployer)
        .updateDomainResolver(
          wilderDomainHash,
          ethers.constants.AddressZero
        );

      const zeroResolver = await registry.getDomainResolver(wilderDomainHash);

      expect(zeroResolver).to.be.eq(ethers.constants.AddressZero);
    });

    it("Fails to set a record when caller is not owner", async () => {
      const tx = registry
        .connect(operator)
        .updateDomainRecord(
          wilderDomainHash,
          operator.address,
          mockResolver.address
        );
      await expect(tx).to.be.revertedWith(ONLY_NAME_OWNER_REG_ERR);
    });

    it("Cannot set a domain's record if not an owner or operator", async () => {
      const domainHash = hashDomainLabel("world");

      await registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, mockResolver.address);
      const tx = registry.connect(randomUser).updateDomainRecord(domainHash, mockResolver.address, deployer.address);

      await expect(tx).to.be.revertedWith(ONLY_NAME_OWNER_REG_ERR);
    });

    it("Cannot set an domain's owner if not an owner or operator", async () => {
      const domainHash = hashDomainLabel("world");

      await registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, mockResolver.address);
      const tx = registry.connect(randomUser).updateDomainOwner(domainHash, mockResolver.address);

      await expect(tx).to.be.revertedWith(
        ONLY_OWNER_REGISTRAR_REG_ERR
      );
    });

    it("Cannot set a domain's resolver if not an owner or operator", async () => {
      const domainHash = hashDomainLabel("world");

      await registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, mockResolver.address);
      const tx = registry.connect(randomUser).updateDomainResolver(domainHash, deployer.address);

      await expect(tx).to.be.revertedWith(NOT_AUTHORIZED_REG_ERR);
    });

    it("Can delete record with REGISTRAR_ROLE", async () => {
      const domainHash = hashDomainLabel("world");

      await registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, mockResolver.address);
      await registry.connect(mockRegistrar).deleteRecord(domainHash);

      const record = await registry.getDomainRecord(domainHash);

      expect(record.owner).to.eq(ethers.constants.AddressZero);
    });

    it("Cannot delete record without REGISTRAR_ROLE", async () => {
      const domainHash = hashDomainLabel("world");

      await registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, mockResolver.address);
      const tx = registry.connect(randomUser).deleteRecord(domainHash);

      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(randomUser.address, REGISTRAR_ROLE)
      );
    });
  });

  describe("Event emitters", () => {
    it("Emits an event when an operator is set", async () => {
      // TODO currently no AC on this function, make sure it's added
      const tx = registry.connect(deployer).setOwnerOperator(randomUser.address, true);

      await expect(tx).to.emit(registry, "OperatorPermissionSet").withArgs(
        deployer.address,
        randomUser.address,
        true,
      );
    });

    it("Emits events when a new domain is created", async () => {
      const domainHash = hashDomainLabel("world");

      const tx = await registry
        .connect(mockRegistrar)
        .createDomainRecord(
          domainHash,
          deployer.address,
          mockResolver.address
        );
      const rec = await tx.wait(0);
      const [ ownerEvent, resolverEvent ] = rec.events ?? [];
      expect(ownerEvent.event).to.be.eq("DomainOwnerSet");
      expect(ownerEvent.args?.[0]).to.be.eq(domainHash);
      expect(ownerEvent.args?.[1]).to.be.eq(deployer.address);

      expect(resolverEvent.event).to.be.eq("DomainResolverSet");
      expect(resolverEvent.args?.[0]).to.be.eq(domainHash);
      expect(resolverEvent.args?.[1]).to.be.eq(mockResolver.address);
    });

    it("Emits an event when an existing domain is updated", async () => {
      const domainHash = hashDomainLabel("world");

      await registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, mockResolver.address);
      const tx = await registry
        .connect(deployer)
        .updateDomainRecord(
          domainHash,
          mockResolver.address,
          deployer.address
        );

      const rec = await tx.wait(0);
      const [ ownerEvent, resolverEvent ] = rec.events ?? [];
      expect(ownerEvent.event).to.be.eq("DomainOwnerSet");
      expect(ownerEvent.args?.[0]).to.be.eq(domainHash);
      expect(ownerEvent.args?.[1]).to.be.eq(mockResolver.address);

      expect(resolverEvent.event).to.be.eq("DomainResolverSet");
      expect(resolverEvent.args?.[0]).to.be.eq(domainHash);
      expect(resolverEvent.args?.[1]).to.be.eq(deployer.address);
    });

    it("Emits an event when a domain's owner is set", async () => {
      const domainHash = hashDomainLabel("world");

      await registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, mockResolver.address);
      const tx = registry.connect(deployer).updateDomainOwner(domainHash, mockResolver.address);

      await expect(tx).to.emit(registry, "DomainOwnerSet").withArgs(
        domainHash,
        mockResolver.address,
      );
    });

    it("Emits an event when a domain's resolver is set", async () => {
      const domainHash = hashDomainLabel("world");

      await registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, mockResolver.address);
      const tx = registry.connect(deployer).updateDomainResolver(domainHash, deployer.address);


      await expect(tx).to.emit(registry, "DomainResolverSet").withArgs(
        domainHash,
        deployer.address
      );
    });

    it("Emits an event when a domain record is deleted", async () => {
      const tx = registry.connect(mockRegistrar).deleteRecord(wilderDomainHash);

      await expect(tx).to.emit(registry, "DomainRecordDeleted").withArgs(wilderDomainHash);
    });
  });
});
