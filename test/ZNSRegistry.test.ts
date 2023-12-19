import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { deployZNS } from "./helpers/deploy/deploy-zns";
import { hashDomainLabel, hashSubdomainName } from "./helpers/hashing";
import { IZNSContracts, DeployZNSParams } from "./helpers/types";
import { ZNSRegistry, ZNSRegistry__factory, ZNSRegistryUpgradeMock__factory } from "../typechain";
import { ethers } from "ethers";
import {
  ADMIN_ROLE,
  GOVERNOR_ROLE,
  REGISTRAR_ROLE,
  INITIALIZED_ERR,
  getAccessRevertMsg,
  validateUpgrade,
  NOT_AUTHORIZED_REG_ERR,
  DEFAULT_RESOLVER_TYPE,
} from "./helpers";
import {
  ONLY_NAME_OWNER_REG_ERR,
  ONLY_OWNER_REGISTRAR_REG_ERR,
  OWNER_NOT_ZERO_REG_ERR,
} from "./helpers/errors";
import { getProxyImplAddress } from "./helpers/utils";

// eslint-disable-next-line @typescript-eslint/no-var-requires
require("@nomicfoundation/hardhat-chai-matchers");


describe("ZNSRegistry", () => {
  let deployer : SignerWithAddress;
  let operator : SignerWithAddress;
  let randomUser : SignerWithAddress;

  // An address will be all that's needed to test the Registry
  let mockResolver : SignerWithAddress;
  let mockRegistrar : SignerWithAddress;

  let zns : IZNSContracts;
  let wilderDomainHash : string;

  beforeEach(async () => {
    [deployer, operator, randomUser, mockResolver, mockRegistrar] = await hre.ethers.getSigners();

    const params : DeployZNSParams = {
      deployer,
      governorAddresses: [deployer.address],
      adminAddresses: [deployer.address],
    };

    zns = await deployZNS(params);

    wilderDomainHash = hashSubdomainName("wilder");

    await zns.accessController.connect(deployer).grantRole(REGISTRAR_ROLE, mockRegistrar.address);

    await zns.registry.connect(deployer).addResolverType(DEFAULT_RESOLVER_TYPE, mockResolver.address);

    await zns.registry.connect(mockRegistrar).createDomainRecord(
      wilderDomainHash,
      deployer.address,
      DEFAULT_RESOLVER_TYPE
    );
  });

  it("Cannot be initialized twice", async () => {
    await expect(
      zns.registry.initialize(
        await zns.accessController.getAddress()
      )
    ).to.be.revertedWith(
      INITIALIZED_ERR
    );
  });

  it("Should NOT let initialize the implementation contract", async () => {
    const factory = new ZNSRegistry__factory(deployer);
    const impl = await getProxyImplAddress(await zns.registry.getAddress());
    const implContract = factory.attach(impl) as ZNSRegistry;

    await expect(
      implContract.initialize(
        deployer.address,
      )
    ).to.be.revertedWith(INITIALIZED_ERR);
  });

  // eslint-disable-next-line max-len
  it("Should initialize correctly with deployer owning the 0x0 hash domain and should allow to change the ownership later", async () => {
    // get the data of the 0x0 hash domain
    const {
      owner,
      resolver,
    } = await zns.registry.getDomainRecord(ethers.ZeroHash);

    // check that the owner is the deployer
    expect(owner).to.eq(deployer.address);
    expect(resolver).to.eq(ethers.ZeroAddress);

    // change the owner as deployer
    await zns.registry.connect(deployer).updateDomainOwner(
      ethers.ZeroHash,
      randomUser.address
    );

    // validate
    const newOwner = await zns.registry.getDomainOwner(ethers.ZeroHash);
    expect(newOwner).to.eq(randomUser.address);
  });

  it("Should set access controller correctly with ADMIN_ROLE", async () => {
    const currentAC = await zns.registry.getAccessController();

    await zns.registry.connect(deployer).setAccessController(randomUser.address);
    const newAC = await zns.registry.getAccessController();

    expect(currentAC).to.not.equal(newAC);
    expect(newAC).to.equal(randomUser.address);
  });

  it("Should revert when setting access controller without ADMIN_ROLE", async () => {
    await expect(
      zns.registry.connect(randomUser).setAccessController(deployer.address)
    ).to.be.revertedWith(
      getAccessRevertMsg(randomUser.address, ADMIN_ROLE)
    );
  });

  describe("Audit fix with approved address resolvers", () => {
    it("Adds `address` resolver type and creates a record", async () => {

      const domainHash = hashDomainLabel("world");

      await zns.registry.connect(mockRegistrar).createDomainRecord(
        domainHash,
        deployer.address,
        DEFAULT_RESOLVER_TYPE
      );

      const record = await zns.registry.getDomainRecord(domainHash);

      expect(record.resolver).to.eq(mockResolver.address);
    });

    it("Gets the resolver we currently have assigned to a certain type", async () => {
      const resolver = await zns.registry.getResolverType(DEFAULT_RESOLVER_TYPE);

      expect(resolver).to.eq(mockResolver.address);
    });

    it("Returns zero for a resolver type that doesn't exist", async () => {
      const resolver = await zns.registry.getResolverType("random-type");

      expect(resolver).to.eq(ethers.ZeroAddress);
    });

    it("Adds a new resolver type", async () => {
      const resolverType = "test-resolver";
      await zns.registry.connect(deployer).addResolverType(resolverType, randomUser.address);

      const domainHash = hashDomainLabel("world");

      await zns.registry.connect(mockRegistrar).createDomainRecord(
        domainHash,
        deployer.address,
        resolverType
      );

      const record = await zns.registry.getDomainRecord(domainHash);
      expect(record.resolver).to.eq(randomUser.address);
    });

    it("Deletes a resolver type", async () => {
      const resolverType = "test-resolver";
      await zns.registry.connect(deployer).addResolverType(resolverType, randomUser.address);

      // Read the resolver type
      let resolver = await zns.registry.getResolverType(resolverType);
      expect(resolver).to.eq(randomUser.address);

      // Delete it
      await zns.registry.connect(deployer).deleteResolverType(resolverType);

      resolver = await zns.registry.getResolverType(resolverType);
      expect(resolver).to.eq(hre.ethers.ZeroAddress);
    });
  });

  describe("Operator functionality", () => {
    it("Returns false when an operator is not allowed by an owner", async () => {
      await zns.registry.connect(deployer).setOwnersOperator(operator.address, false);

      const allowed = await zns.registry.isOwnerOrOperator(
        wilderDomainHash,
        operator.address
      );
      expect(allowed).to.be.false;
    });

    it("Returns true when an operator is allowed by an owner", async () => {
      await zns.registry.connect(deployer).setOwnersOperator(operator.address, true);

      const allowed = await zns.registry.isOwnerOrOperator(
        wilderDomainHash,
        operator.address
      );
      expect(allowed).to.be.true;
    });

    it("Returns false when an owner has not specified any operators", async () => {
      const allowed = await zns.registry.isOwnerOrOperator(wilderDomainHash, operator.address);

      expect(allowed).to.be.false;
    });

    it("Permits an allowed operator to update a domain record", async () => {
      await zns.registry.connect(deployer).setOwnersOperator(operator.address, true);

      const testType = "test-resolver";
      await zns.registry.connect(deployer).addResolverType(testType, randomUser.address);

      const tx = zns.registry
        .connect(operator)
        .updateDomainResolver(wilderDomainHash, testType);

      await expect(tx).to.emit(zns.registry, "DomainResolverSet").withArgs(
        wilderDomainHash,
        randomUser.address
      );
    });

    it("Does not permit a disallowed operator to update a domain record", async () => {
      await zns.registry.connect(deployer).setOwnersOperator(operator.address, false);

      const tx = zns.registry.connect(operator).updateDomainResolver(wilderDomainHash, operator.address);
      await expect(tx).to.be.revertedWith("ZNSRegistry: Not authorized");
    });

    it("Does not permit an operator that's never been allowed to modify a record", async () => {
      const tx = zns.registry.connect(operator).updateDomainResolver(wilderDomainHash, operator.address);
      await expect(tx).to.be.revertedWith("ZNSRegistry: Not authorized");
    });

    it("#isOperatorFor() should return true for an operator", async () => {
      await zns.registry.connect(deployer).setOwnersOperator(operator.address, true);

      const isOperator = await zns.registry.isOperatorFor(
        operator.address,
        deployer.address,
      );
      expect(isOperator).to.be.true;
    });
  });

  describe("Domain records", async () => {
    it("Verifies existence of a domain correctly", async () => {
      const exists = await zns.registry.connect(randomUser).exists(wilderDomainHash);
      expect(exists).to.be.true;

      const nonExistentDomainHash = hashSubdomainName("wild");

      const notExists = await zns.registry.connect(randomUser).exists(nonExistentDomainHash);
      expect(notExists).to.be.false;
    });

    it("Gets a domain record", async () => {
      // Domain exists
      const wilderRecord = await zns.registry.getDomainRecord(wilderDomainHash);
      expect(wilderRecord.owner).to.eq(deployer.address);

      // Domain does not exist
      const domainHash = hashDomainLabel("random-record");
      const record = await zns.registry.getDomainRecord(domainHash);
      expect(record.owner).to.eq(ethers.ZeroAddress);
    });

    it("Gets a domain owner", async () => {
      // The domain exists
      const existOwner = await zns.registry.getDomainOwner(wilderDomainHash);
      expect(existOwner).to.eq(deployer.address);

      // The domain does not exist
      const domainHash = hashDomainLabel("random-record");
      const notExistOwner = await zns.registry.getDomainOwner(domainHash);
      expect(notExistOwner).to.eq(ethers.ZeroAddress);
    });

    it("Gets a domain resolver", async () => {
      // The domain exists
      const existResolver = await zns.registry.getDomainResolver(wilderDomainHash);
      expect(existResolver).to.eq(mockResolver.address);

      // The domain does not exist
      const domainHash = hashDomainLabel("random-record");
      const notExistResolver = await zns.registry.getDomainResolver(domainHash);
      expect(notExistResolver).to.eq(ethers.ZeroAddress);
    });

    it("Creates a new domain record successfully", async () => {
      const domainHash = hashDomainLabel("world");

      await zns.registry.connect(mockRegistrar).createDomainRecord(
        domainHash,
        deployer.address,
        DEFAULT_RESOLVER_TYPE
      );
    });

    it("Fails to create a new domain record if the caller does not have REGISTRAR_ROLE", async () => {
      const domainHash = hashDomainLabel("world");

      const tx = zns.registry.connect(deployer).createDomainRecord(
        domainHash,
        deployer.address,
        DEFAULT_RESOLVER_TYPE
      );

      await expect(tx).to.be.revertedWith(
        `AccessControl: account ${deployer.address.toLowerCase()} is missing role ${REGISTRAR_ROLE}`
      );
    });
  });

  describe("Setter functions for a domain's record, owner, or resolver", () => {
    it("Cannot update a domain record if the domain doesn't exist", async () => {
      const domainHash = hashDomainLabel("world");

      const tx = zns.registry.updateDomainRecord(domainHash, deployer.address, mockResolver.address);

      // Because nobody owns a non-existing record, the error is caught by the `onlyOwnerOrOperator` first
      await expect(tx).to.be.revertedWith(ONLY_NAME_OWNER_REG_ERR);
    });

    it("Can update a domain record if the domain exists", async () => {
      const domainHash = hashDomainLabel("world");

      const testType = "test-resolver";
      await zns.registry.connect(deployer).addResolverType(testType, randomUser.address);

      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, DEFAULT_RESOLVER_TYPE);
      await zns.registry.updateDomainRecord(domainHash, mockRegistrar.address, testType);

      const record = await zns.registry.getDomainRecord(domainHash);

      expect(record.owner).to.eq(mockRegistrar.address);
      expect(record.resolver).to.eq(randomUser.address);
    });

    it("Cannot update a domain owner if the domain doesn't exist", async () => {
      const domainHash = hashDomainLabel("world");

      const tx = zns.registry.updateDomainOwner(domainHash, deployer.address);

      // Because nobody owns a non-existing record, the error is caught by the `onlyOwnerOrOperator` first
      await expect(tx).to.be.revertedWith(ONLY_OWNER_REGISTRAR_REG_ERR);
    });

    it("Can update a domain owner if the domain exists", async () => {
      const domainHash = hashDomainLabel("world");

      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, DEFAULT_RESOLVER_TYPE);
      await zns.registry.updateDomainOwner(domainHash, mockRegistrar.address);

      const record = await zns.registry.getDomainRecord(domainHash);

      expect(record.owner).to.eq(mockRegistrar.address);
    });

    it("Cannot update a domain resolver if the domain doesn't exist", async () => {
      const domainHash = hashDomainLabel("world");
      const tx = zns.registry.updateDomainResolver(domainHash, mockResolver.address);

      // Because nobody owns a non-existing record, the error is caught by the `onlyOwnerOrOperator` first
      await expect(tx).to.be.revertedWith(NOT_AUTHORIZED_REG_ERR);
    });

    it("Can update a domain resolver if the domain exists", async () => {
      const domainHash = hashDomainLabel("world");

      const testType = "test-resolver";
      await zns.registry.connect(deployer).addResolverType(testType, randomUser.address);

      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, DEFAULT_RESOLVER_TYPE);
      await zns.registry.updateDomainResolver(domainHash, testType);

      const record = await zns.registry.getDomainRecord(domainHash);

      expect(record.resolver).to.eq(randomUser.address);
    });

    it("Cannot update a domain record if the owner is zero address", async () => {
      const domainHash = hashDomainLabel("world");

      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, DEFAULT_RESOLVER_TYPE);
      const tx = zns.registry.updateDomainRecord(domainHash, ethers.ZeroAddress, mockResolver.address);

      await expect(tx).to.be.revertedWith(OWNER_NOT_ZERO_REG_ERR);
    });

    it("Can update a domain record if the resolver is zero address", async () => {
      const domainHash = hashDomainLabel("world");

      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, DEFAULT_RESOLVER_TYPE);
      const tx = zns.registry.updateDomainRecord(domainHash, mockResolver.address, ethers.ZeroAddress);

      await expect(tx).to.be.fulfilled;
    });

    it("cannot update a domain owner if owner is zero address", async () => {
      const tx = zns.registry
        .connect(deployer)
        .updateDomainOwner(
          wilderDomainHash,
          ethers.ZeroAddress
        );

      await expect(tx).to.be.revertedWith(OWNER_NOT_ZERO_REG_ERR);
    });

    it("Can update a domain resolver if resolver is zero address", async () => {
      await zns.registry
        .connect(deployer)
        .updateDomainResolver(
          wilderDomainHash,
          ethers.ZeroAddress
        );

      const zeroResolver = await zns.registry.getDomainResolver(wilderDomainHash);

      expect(zeroResolver).to.be.eq(ethers.ZeroAddress);
    });

    it("Fails to update a record when caller is not owner or operator", async () => {
      const tx = zns.registry
        .connect(operator)
        .updateDomainRecord(
          wilderDomainHash,
          operator.address,
          mockResolver.address
        );
      await expect(tx).to.be.revertedWith(ONLY_NAME_OWNER_REG_ERR);
    });

    it("cannot update a domain's record if not an owner or operator", async () => {
      const domainHash = hashDomainLabel("world");

      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, DEFAULT_RESOLVER_TYPE);
      const tx = zns.registry.connect(randomUser).updateDomainRecord(
        domainHash,
        mockResolver.address,
        deployer.address
      );

      await expect(tx).to.be.revertedWith(ONLY_NAME_OWNER_REG_ERR);
    });

    it("cannot update an domain's owner if not an owner or operator", async () => {
      const domainHash = hashDomainLabel("world");

      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, DEFAULT_RESOLVER_TYPE);
      const tx = zns.registry.connect(randomUser).updateDomainOwner(domainHash, mockResolver.address);

      await expect(tx).to.be.revertedWith(
        ONLY_OWNER_REGISTRAR_REG_ERR
      );
    });

    it("cannot update a domain's resolver if not an owner or operator", async () => {
      const domainHash = hashDomainLabel("world");

      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, DEFAULT_RESOLVER_TYPE);
      const tx = zns.registry.connect(randomUser).updateDomainResolver(domainHash, deployer.address);

      await expect(tx).to.be.revertedWith(NOT_AUTHORIZED_REG_ERR);
    });

    it("Can delete record with REGISTRAR_ROLE", async () => {
      const domainHash = hashDomainLabel("world");

      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, DEFAULT_RESOLVER_TYPE);
      await zns.registry.connect(mockRegistrar).deleteRecord(domainHash);

      const record = await zns.registry.getDomainRecord(domainHash);

      expect(record.owner).to.eq(ethers.ZeroAddress);
    });

    it("Cannot delete record without REGISTRAR_ROLE", async () => {
      const domainHash = hashDomainLabel("world");

      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, DEFAULT_RESOLVER_TYPE);
      const tx = zns.registry.connect(randomUser).deleteRecord(domainHash);

      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(randomUser.address, REGISTRAR_ROLE)
      );
    });
  });

  describe("Event emitters", () => {
    it("Emits an event when an operator is set", async () => {
      const tx = zns.registry.connect(deployer).setOwnersOperator(randomUser.address, true);

      await expect(tx).to.emit(zns.registry, "OperatorPermissionSet").withArgs(
        deployer.address,
        randomUser.address,
        true,
      );
    });

    it("Emits events when a new domain is created", async () => {
      const domainHash = hashDomainLabel("world");

      await zns.registry.getResolverType(DEFAULT_RESOLVER_TYPE);

      const tx = zns.registry
        .connect(mockRegistrar)
        .createDomainRecord(
          domainHash,
          deployer.address,
          DEFAULT_RESOLVER_TYPE
        );

      await expect(tx).to.emit(zns.registry, "DomainOwnerSet").withArgs(domainHash, deployer.address)
        .emit(zns.registry, "DomainResolverSet").withArgs(domainHash, mockResolver.address);
    });

    it("Emits an event when an existing domain is updated", async () => {
      const domainHash = hashDomainLabel("world");

      await zns.registry.connect(mockRegistrar).createDomainRecord(
        domainHash,
        deployer.address,
        DEFAULT_RESOLVER_TYPE
      );

      const tx = zns.registry.connect(deployer).updateDomainRecord(
        domainHash,
        mockResolver.address,
        DEFAULT_RESOLVER_TYPE
      );

      await expect(tx).to.emit(zns.registry, "DomainOwnerSet").withArgs(
        domainHash,
        mockResolver.address,
      ).to.emit(zns.registry, "DomainResolverSet").withArgs(
        domainHash,
        mockResolver.address,
      );
    });

    it("Emits an event when a domain's owner is updated", async () => {
      const domainHash = hashDomainLabel("world");

      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, DEFAULT_RESOLVER_TYPE);
      const tx = zns.registry.connect(deployer).updateDomainOwner(domainHash, mockResolver.address);

      await expect(tx).to.emit(zns.registry, "DomainOwnerSet").withArgs(
        domainHash,
        mockResolver.address,
      );
    });

    it("Emits an event when a domain's resolver is updated", async () => {
      const domainHash = hashDomainLabel("world");

      const testType = "test-resolver";
      await zns.registry.connect(deployer).addResolverType(testType, randomUser.address);

      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, DEFAULT_RESOLVER_TYPE);
      const tx = zns.registry.connect(deployer).updateDomainResolver(domainHash, testType);

      await expect(tx).to.emit(zns.registry, "DomainResolverSet").withArgs(
        domainHash,
        randomUser.address
      );
    });

    it("Emits an event when a domain record is deleted", async () => {
      const tx = zns.registry.connect(mockRegistrar).deleteRecord(wilderDomainHash);

      await expect(tx).to.emit(zns.registry, "DomainRecordDeleted").withArgs(wilderDomainHash);
    });
  });

  describe("UUPS", () => {
    it("Allows an authorized user to upgrade successfully", async () => {
      // Confirm the deployer is a governor
      expect(
        await zns.accessController.hasRole(GOVERNOR_ROLE, deployer.address)
      ).to.be.true;

      const registryFactory = new ZNSRegistryUpgradeMock__factory(deployer);
      const registry = await registryFactory.deploy();
      await registry.waitForDeployment();

      // To control the signer we call manually here instead of through hardhat
      const upgradeTx = zns.registry.connect(deployer).upgradeTo(await registry.getAddress());
      await expect(upgradeTx).to.be.not.be.reverted;
    });

    it("Fails when an unauthorized account tries to call to upgrade", async () => {
      const registryFactory = new ZNSRegistryUpgradeMock__factory(deployer);
      const registry = await registryFactory.deploy();
      await registry.waitForDeployment();

      // To control the signer we call manually here instead of through hardhat
      const upgradeTx = zns.registry.connect(randomUser).upgradeTo(await registry.getAddress());
      await expect(upgradeTx).to.be.revertedWith(getAccessRevertMsg(randomUser.address, GOVERNOR_ROLE));
    });

    it("Verifies that variable values are not changed in the upgrade process", async () => {
      const registryFactory = new ZNSRegistryUpgradeMock__factory(deployer);
      const registry = await registryFactory.deploy();
      await registry.waitForDeployment();

      const domainHash = hashSubdomainName("world");

      // Add an operator
      await zns.registry.connect(deployer).setOwnersOperator(operator.address, true);

      // Create a domain record
      await zns.registry.connect(mockRegistrar).createDomainRecord(
        domainHash,
        deployer.address,
        DEFAULT_RESOLVER_TYPE
      );

      const contractCalls = [
        zns.registry.isOwnerOrOperator(domainHash, deployer.address),
        zns.registry.isOwnerOrOperator(domainHash, operator.address),
        zns.registry.exists(domainHash),
        zns.registry.getAccessController(),
      ];

      // Performs an upgrade and verifies values of existing and new variables
      await validateUpgrade(deployer, zns.registry, registry, registryFactory, contractCalls);
    });
  });
});
