import * as hre from "hardhat";
import {
  ZNSDomainTokenUpgradeMock__factory,
  ZNSDomainToken__factory,
} from "../typechain";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "ethers";
import {
  ADMIN_ROLE,
  REGISTRAR_ROLE,
  GOVERNOR_ROLE,
  getAccessRevertMsg,
  INVALID_TOKENID_ERC_ERR,
  deployZNS,
  validateUpgrade,
  ZNS_DOMAIN_TOKEN_NAME,
  ZNS_DOMAIN_TOKEN_SYMBOL, domainTokenName, INITIALIZED_ERR,
} from "./helpers";
import { DeployZNSParams, ZNSContracts } from "./helpers/types";


describe("ZNSDomainToken:", () => {
  let deployer : SignerWithAddress;
  let caller : SignerWithAddress;
  let mockRegistrar : SignerWithAddress;

  let zns : ZNSContracts;
  let deployParams : DeployZNSParams;

  beforeEach(async () => {
    [deployer, caller, mockRegistrar] = await hre.ethers.getSigners();
    deployParams = {
      deployer,
      governorAddresses: [deployer.address],
      adminAddresses: [deployer.address],
    };
    zns = await deployZNS(
      deployParams
    );

    await zns.accessController.connect(deployer).grantRole(REGISTRAR_ROLE, mockRegistrar.address);
  });

  it("should initialize correctly", async () => {
    expect(await zns.domainToken.getAccessController()).to.equal(zns.accessController.address);
    expect(await zns.domainToken.name()).to.equal(ZNS_DOMAIN_TOKEN_NAME);
    expect(await zns.domainToken.symbol()).to.equal(ZNS_DOMAIN_TOKEN_SYMBOL);
  });

  it("should NOT initialize twice", async () => {
    await expect(zns.domainToken.initialize(
      deployer.address,
      ZNS_DOMAIN_TOKEN_NAME,
      ZNS_DOMAIN_TOKEN_SYMBOL
    )).to.be.revertedWith(INITIALIZED_ERR);
  });

  describe("External functions", () => {
    it("Should register (mint) the token if caller has REGISTRAR_ROLE", async () => {
      const tokenId = ethers.BigNumber.from("1");
      const tx = zns.domainToken
        .connect(mockRegistrar)
        .register(caller.address, tokenId);

      await expect(tx).to.emit(zns.domainToken, "Transfer").withArgs(
        ethers.constants.AddressZero,
        caller.address,
        tokenId
      );

      // Verify caller owns tokenId
      expect(await zns.domainToken.ownerOf(tokenId)).to.equal(caller.address);
    });

    it("Should revert when registering (minting) if caller does not have REGISTRAR_ROLE", async () => {
      const tokenId = ethers.BigNumber.from("1");
      await expect(
        zns.domainToken
          .connect(caller)
          .register(caller.address, tokenId)
      ).to.be.revertedWith(
        getAccessRevertMsg(caller.address, REGISTRAR_ROLE)
      );
    });

    it("Revokes a token", async () => {
      // Mint domain
      const tokenId = ethers.BigNumber.from("1");
      await zns.domainToken
        .connect(mockRegistrar)
        .register(caller.address, tokenId);
      // Verify caller owns tokenId
      expect(await zns.domainToken.ownerOf(tokenId)).to.equal(
        caller.address
      );

      // Revoke domain
      const tx = zns.domainToken.connect(mockRegistrar).revoke(tokenId);

      // Verify Transfer event is emitted
      await expect(tx).to.emit(zns.domainToken, "Transfer").withArgs(
        caller.address,
        ethers.constants.AddressZero,
        tokenId
      );

      // Verify token has been burned
      await expect(zns.domainToken.ownerOf(tokenId)).to.be.revertedWith(INVALID_TOKENID_ERC_ERR);
    });
  });

  describe("Require Statement Validation", () => {
    it("Only the registrar can call to register a token", async () => {
      const tokenId = ethers.BigNumber.from("1");
      const registerTx = zns.domainToken
        .connect(caller)
        .register(caller.address, tokenId);

      await expect(registerTx).to.be.revertedWith(
        getAccessRevertMsg(caller.address, REGISTRAR_ROLE)
      );
    });

    it("Only authorized can revoke a token", async () => {
      const tokenId = ethers.BigNumber.from("1");
      // Mint domain
      await zns.domainToken
        .connect(mockRegistrar)
        .register(caller.address, tokenId);
      // Verify caller owns tokenId
      expect(await zns.domainToken.ownerOf(tokenId)).to.equal(
        caller.address
      );

      // Verify caller owns tokenId
      expect(await zns.domainToken.ownerOf(tokenId)).to.equal(caller.address);

      // Revoke domain
      const tx = zns.domainToken.connect(caller).revoke(tokenId);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(caller.address, REGISTRAR_ROLE)
      );

      // Verify token has not been burned
      expect(await zns.domainToken.ownerOf(tokenId)).to.equal(caller.address);
    });

    it("Should set access controller if caller has ADMIN_ROLE", async () => {
      await zns.domainToken.connect(deployer).setAccessController(caller.address);
      expect(await zns.domainToken.getAccessController()).to.equal(caller.address);
    });

    it("Should revert when setting access controller if caller does not have ADMIN_ROLE", async () => {
      await expect(
        zns.domainToken.connect(caller).setAccessController(caller.address)
      ).to.be.revertedWith(
        getAccessRevertMsg(caller.address, ADMIN_ROLE)
      );
    });
  });

  describe("Contract Configuration", () => {
    it("Verify token name", async () => {
      const name = await zns.domainToken.name();
      expect(name).to.equal(ZNS_DOMAIN_TOKEN_NAME);
    });

    it("Verify token symbol", async () => {
      const symbol = await zns.domainToken.symbol();
      expect(symbol).to.equal(ZNS_DOMAIN_TOKEN_SYMBOL);
    });
  });

  describe("UUPS", () => {
    it("Allows an authorized user to upgrade the contract", async () => {
      // DomainToken to upgrade to
      const factory = new ZNSDomainToken__factory(deployer);
      const newDomainToken = await factory.deploy();
      await newDomainToken.deployed();

      // Confirm the deployer is a governor
      expect(
        await zns.accessController.hasRole(GOVERNOR_ROLE, deployer.address)
      ).to.be.true;

      const upgradeTx = zns.domainToken.connect(deployer).upgradeTo(newDomainToken.address);

      await expect(upgradeTx).to.not.be.reverted;
    });

    it("Verifies that variable values are not changed in the upgrade process", async () => {
      // DomainToken to upgrade to
      const factory = new ZNSDomainTokenUpgradeMock__factory(deployer);
      const newDomainToken = await factory.deploy();
      await newDomainToken.deployed();

      // Call to register a token
      const tokenId = ethers.BigNumber.from("1");
      await zns.domainToken.connect(mockRegistrar).register(deployer.address, tokenId);
      await zns.domainToken.connect(deployer).approve(caller.address, tokenId);

      const contractCalls = [
        zns.domainToken.name(),
        zns.domainToken.symbol(),
        zns.domainToken.ownerOf(tokenId),
        zns.domainToken.balanceOf(deployer.address),
        zns.domainToken.getApproved(tokenId),
      ];

      await validateUpgrade(deployer, zns.domainToken, newDomainToken, factory, contractCalls);
    });

    it("Fails to upgrade if the caller is not authorized", async () => {
      // UUPS specifies that a call to upgrade must be made through an address that is upgradecall
      // So use a deployed proxy contract
      const factory = new ZNSDomainTokenUpgradeMock__factory(deployer);

      // DomainToken to upgrade to
      const newDomainToken = await factory.deploy();
      await newDomainToken.deployed();

      // Confirm the caller is not a governor
      await expect(zns.accessController.checkGovernor(caller.address)).to.be.revertedWith(
        getAccessRevertMsg(caller.address, GOVERNOR_ROLE)
      );

      const upgradeTx = zns.domainToken.connect(caller).upgradeTo(newDomainToken.address);

      await expect(upgradeTx).to.be.revertedWith(
        getAccessRevertMsg(caller.address, GOVERNOR_ROLE)
      );
    });
  });
});