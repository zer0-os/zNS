import * as hre from "hardhat";
import {
  ZNSDomainToken, ZNSDomainToken__factory,
} from "../typechain";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "ethers";
import { GOVERNOR_ROLE, deployZNS } from "./helpers";
import { DeployZNSParams, ZNSContracts } from "./helpers/types";


describe("ZNSDomainToken:", () => {
  const TokenName = "ZNSDomainToken";
  const TokenSymbol = "ZDT";

  let deployer : SignerWithAddress;
  let caller : SignerWithAddress;

  let zns : ZNSContracts;
  let deployParams : DeployZNSParams;

  beforeEach(async () => {
    [deployer, caller] = await hre.ethers.getSigners();
    deployParams = {
      deployer,
      governorAddresses: [deployer.address],
      adminAddresses: [deployer.address],
    };
    zns = await deployZNS(
      deployParams
    );
  });

  describe("External functions", () => {
    it("Registers a token", async () => {
      const tokenId = ethers.BigNumber.from("1");
      const tx = zns.domainToken
        .connect(deployer)
        .register(caller.address, tokenId);

      await expect(tx).to.emit(zns.domainToken, "Transfer").withArgs(
        ethers.constants.AddressZero,
        caller.address,
        tokenId
      );
    });

    it("Revokes a token", async () => {
      const tokenId = ethers.BigNumber.from("1");
      // Mint domain
      await zns.domainToken
        .connect(deployer)
        .register(caller.address, tokenId);
      // Verify caller owns tokenId
      expect(await zns.domainToken.ownerOf(tokenId)).to.equal(
        caller.address
      );

      // Revoke domain
      const tx = zns.domainToken.connect(deployer).revoke(tokenId);

      // Verify Transfer event is emitted
      await expect(tx).to.emit(zns.domainToken, "Transfer").withArgs(
        caller.address,
        ethers.constants.AddressZero,
        tokenId
      );
    });
  });

  describe("Require Statement Validation", () => {
    it("Only authorized can revoke a token", async () => {
      const tokenId = ethers.BigNumber.from("1");
      // Mint domain
      await zns.domainToken
        .connect(deployer)
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
        "ZNSDomainToken: Not authorized"
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
  describe("UUPS", () => {
    it("Verifies an authorized user can upgrade the contract", async () => {
      // UUPS specifies that a call to upgrade must be made through an address that is upgradecall
      // So use a deployed proxy contract
      const factory = new ZNSDomainToken__factory(deployer);

      // DomainToken to upgrade to
      const newDomainToken = await factory.deploy();
      await newDomainToken.deployed();

      // Confirm the deployer is a governor, as set in `deployZNS` helper
      await expect(zns.accessController.checkRole(GOVERNOR_ROLE, deployer.address)).to.not.be.reverted;

      // TODO access control on _authorizedUpgrade function in contract
      // const tx = await zns.domainToken.connect(deployer).upgradeTo(newDomainToken.address);
      // await expect(tx).to.be.revertedWith("???");
    });

    it("Fails to upgrade if the caller is not authorized", async () => {
      const factory = new ZNSDomainToken__factory(deployer);
      const proxyDomainToken = await hre.upgrades.deployProxy(factory, [
        "Zero Name Service",
        "ZNS",
      ]);

      await proxyDomainToken.deployed();

      // PriceOracle to upgrade to
      const newDomainToken = await factory.deploy();
      await newDomainToken.deployed();

      await newDomainToken.initialize(
        "Zero Name Service",
        "ZNS",
      );

      // Confirm the account is not a governor
      await expect(zns.accessController.checkRole(GOVERNOR_ROLE, caller.address)).to.be.reverted;

      const tx = proxyDomainToken.connect(caller).upgradeTo(newDomainToken.address);

      await expect(tx).to.be.revertedWith(
        `AccessControl: account ${caller.address.toLowerCase()} is missing role ${GOVERNOR_ROLE}`
      );
    });
  });
});