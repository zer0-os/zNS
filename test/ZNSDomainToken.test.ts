import * as hre from "hardhat";
import {
  ZNSDomainToken,
} from "../typechain";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "ethers";
import { deployDomainToken } from "./helpers";


describe("ZNSDomainToken:", () => {
  const TokenName = "ZNSDomainToken";
  const TokenSymbol = "ZDT";

  let deployer : SignerWithAddress;
  let caller : SignerWithAddress;
  let domainToken : ZNSDomainToken;

  beforeEach(async () => {
    [deployer, caller] = await hre.ethers.getSigners();
    domainToken = await deployDomainToken(deployer);
  });

  describe("External functions", () => {
    it("Registers a token", async () => {
      const tokenId = ethers.BigNumber.from("1");
      const tx = domainToken
        .connect(deployer)
        .register(caller.address, tokenId);

      await expect(tx).to.emit(domainToken, "Transfer").withArgs(
        ethers.constants.AddressZero,
        caller.address,
        tokenId
      );
    });

    it("Revokes a token", async () => {
      const tokenId = ethers.BigNumber.from("1");
      // Mint domain
      await domainToken
        .connect(deployer)
        .register(caller.address, tokenId);
      // Verify caller owns tokenId
      expect(await domainToken.ownerOf(tokenId)).to.equal(
        caller.address
      );

      // Revoke domain
      const tx = domainToken.connect(deployer).revoke(tokenId);

      // Verify Transfer event is emitted
      await expect(tx).to.emit(domainToken, "Transfer").withArgs(
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
      await domainToken
        .connect(deployer)
        .register(caller.address, tokenId);

      // Verify caller owns tokenId
      expect(await domainToken.ownerOf(tokenId)).to.equal(
        caller.address
      );

      // Verify caller owns tokenId
      expect(await domainToken.ownerOf(tokenId)).to.equal(caller.address);

      // Revoke domain
      const tx = domainToken.connect(caller).revoke(tokenId);
      await expect(tx).to.be.revertedWith(
        "ZNSDomainToken: Not authorized"
      );

      // Verify token has not been burned
      expect(await domainToken.ownerOf(tokenId)).to.equal(caller.address);
    });
  });

  describe("Contract Configuration", () => {
    it("Verify token name", async () => {
      const name = await domainToken.name();
      expect(name).to.equal(TokenName);
    });

    it("Verify token symbol", async () => {
      const symbol = await domainToken.symbol();
      expect(symbol).to.equal(TokenSymbol);
    });
  });
});