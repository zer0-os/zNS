import * as hre from "hardhat";
import {
  ZNSDomainToken__factory,
} from "../typechain";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "ethers";
import { GOVERNOR_ROLE, REGISTRAR_ROLE, deployZNS } from "./helpers";
import { DeployZNSParams, ZNSContracts } from "./helpers/types";


describe("ZNSDomainToken:", () => {
  const TokenName = "ZNSDomainToken";
  const TokenSymbol = "ZDT";

  let deployer : SignerWithAddress;
  let caller : SignerWithAddress;
  let mockRegistrar : SignerWithAddress;
  let mockAccessController : SignerWithAddress;

  let zns : ZNSContracts;
  let deployParams : DeployZNSParams;

  beforeEach(async () => {
    [deployer, caller, mockRegistrar, mockAccessController] = await hre.ethers.getSigners();
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

  describe("External functions", () => {
    it("Registers a token", async () => {
      const tokenId = ethers.BigNumber.from("1");
      const tx = zns.domainToken
        .connect(mockRegistrar)
        .register(caller.address, tokenId);

      await expect(tx).to.emit(zns.domainToken, "Transfer").withArgs(
        ethers.constants.AddressZero,
        caller.address,
        tokenId
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
    });
  });

  describe("Require Statement Validation", () => {
    it("Only the registrar can call to register a token", async () => {
      const tokenId = ethers.BigNumber.from("1");
      const registerTx = zns.domainToken
        .connect(caller)
        .register(caller.address, tokenId);

      await expect(registerTx).to.be.revertedWith(
        `AccessControl: account ${caller.address.toLowerCase()} is missing role ${REGISTRAR_ROLE}`
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
        `AccessControl: account ${caller.address.toLowerCase()} is missing role ${REGISTRAR_ROLE}`
      );

      // Verify token has not been burned
      expect(await zns.domainToken.ownerOf(tokenId)).to.equal(caller.address);
    });
  });

  describe("Contract Configuration", () => {
    it("Verify token name", async () => {
      const name = await zns.domainToken.name();
      expect(name).to.equal(TokenName);
    });

    it("Verify token symbol", async () => {
      const symbol = await zns.domainToken.symbol();
      expect(symbol).to.equal(TokenSymbol);
    });
  });
  describe("AccessController", () =>{
    it("Allows setting of a new access controller if the caller is a governor", async () => {
      const accessControllerBefore = await zns.domainToken.getAccessController();

      const tx = zns.domainToken.connect(deployer).setAccessController(mockAccessController.address);

      await expect(tx).to.not.be.reverted;

      const accessControllerAfter = await zns.domainToken.getAccessController();
      expect(accessControllerBefore).to.not.eq(accessControllerAfter);
    });

    it("Fails when the caller is not a governor", async () => {
      const tx = zns.domainToken.connect(caller).setAccessController(mockAccessController.address);
      await expect(tx).to.be.revertedWith(
        `AccessControl: account ${caller.address.toLowerCase()} is missing role ${GOVERNOR_ROLE}`
      );
    });
  });
  describe("UUPS", () => {
    it("Verifies an authorized user can upgrade the contract", async () => {
      // UUPS specifies that a call to upgrade must be made through an address that is upgradecall
      // So use a deployed proxy contract
      const factory = new ZNSDomainToken__factory(deployer);

      // DomainToken to upgrade to
      const newDomainToken = await factory.deploy();
      await newDomainToken.deployed();

      const preUpgradeVars = [
        zns.domainToken.name(),
        zns.domainToken.symbol(),
      ];

      const [nameBefore, symbolBefore] = await Promise.all(preUpgradeVars);

      // Confirm the deployer is a governor, as set in `deployZNS` helper
      await expect(zns.accessController.checkRole(GOVERNOR_ROLE, deployer.address)).to.not.be.reverted;

      const upgradeTx = zns.domainToken.connect(deployer).upgradeTo(newDomainToken.address);

      await expect(upgradeTx).to.not.be.reverted;

      const postUpgradeVars = [
        zns.domainToken.name(),
        zns.domainToken.symbol(),
      ];

      const [nameAfter, symbolAfter] = await Promise.all(postUpgradeVars);

      expect(nameBefore).to.eq(nameAfter);
      expect(symbolBefore).to.eq(symbolAfter);

    });

    it("Fails to upgrade if the caller is not authorized", async () => {
      // UUPS specifies that a call to upgrade must be made through an address that is upgradecall
      // So use a deployed proxy contract
      const factory = new ZNSDomainToken__factory(deployer);

      // DomainToken to upgrade to
      const newDomainToken = await factory.deploy();
      await newDomainToken.deployed();

      // Confirm the deployer is a governor, as set in `deployZNS` helper
      await expect(zns.accessController.checkRole(GOVERNOR_ROLE, caller.address)).to.be.revertedWith(
        `AccessControl: account ${caller.address.toLowerCase()} is missing role ${GOVERNOR_ROLE}`
      );

      const upgradeTx = zns.domainToken.connect(caller).upgradeTo(newDomainToken.address);

      await expect(upgradeTx).to.be.revertedWith(
        `AccessControl: account ${caller.address.toLowerCase()} is missing role ${GOVERNOR_ROLE}`
      );
    });
  });
});