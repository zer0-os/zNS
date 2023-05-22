import * as hre from "hardhat";
import {
  ZNSAccessController,
  ZNSDomainToken,
} from "../typechain";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "ethers";
import { ADMIN_ROLE, deployAccessController, deployDomainToken, getAccessRevertMsg, REGISTRAR_ROLE } from "./helpers";


describe("ZNSDomainToken:", () => {
  const TokenName = "ZNSDomainToken";
  const TokenSymbol = "ZDT";

  let deployer : SignerWithAddress;
  let accessController : ZNSAccessController;
  let caller : SignerWithAddress;
  let domainToken : ZNSDomainToken;

  beforeEach(async () => {
    [deployer, caller] = await hre.ethers.getSigners();

    accessController = await deployAccessController({
      deployer,
      governorAddresses: [deployer.address],
      adminAddresses: [deployer.address],
    });

    domainToken = await deployDomainToken(deployer, accessController.address);
    await accessController.connect(deployer).grantRole(REGISTRAR_ROLE, deployer.address);
  });

  describe("External functions", () => {
    it("Should register (mint) the token if caller has REGISTRAR_ROLE", async () => {
      const tokenId = ethers.BigNumber.from("1");
      const tx = await domainToken
        .connect(deployer)
        .register(caller.address, tokenId);
      const receipt = await tx.wait(0);

      // Verify Transfer event is emitted
      expect(receipt.events?.[0].event).to.eq("Transfer");
      expect(receipt.events?.[0].args?.tokenId).to.eq(
        tokenId
      );
      expect(receipt.events?.[0].args?.to).to.eq(
        caller.address
      );

      // Verify caller owns tokenId
      expect(await domainToken.ownerOf(tokenId)).to.equal(caller.address);
    });

    it("Should revert when registering (minting) if caller does not have REGISTRAR_ROLE", async () => {
      const tokenId = ethers.BigNumber.from("1");
      await expect(
        domainToken
          .connect(caller)
          .register(caller.address, tokenId)
      ).to.be.revertedWith(
        getAccessRevertMsg(caller.address, REGISTRAR_ROLE)
      );
    });

    it("Should revoke (burn) the token if caller has REGISTRAR_ROLE", async () => {
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
      const tx = await domainToken.connect(deployer).revoke(tokenId);
      const receipt = await tx.wait(0);

      // Verify Transfer event is emitted
      expect(receipt.events?.[0].event).to.eq("Transfer");
      expect(receipt.events?.[0].args?.tokenId).to.eq(
        tokenId
      );
      expect(receipt.events?.[0].args?.to).to.eq(
        ethers.constants.AddressZero
      );

      // Verify token has been burned
      await expect(
        domainToken.ownerOf(tokenId)
      ).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("Should revert when revoking (burning) if caller does not have REGISTRAR_ROLE", async () => {
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
      const tx = domainToken.connect(caller).revoke(tokenId);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(caller.address, REGISTRAR_ROLE)
      );

      // Verify token has not been burned
      expect(await domainToken.ownerOf(tokenId)).to.equal(caller.address);
    });
  });

  it("Should set access controller if caller has ADMIN_ROLE", async () => {
    await domainToken.connect(deployer).setAccessController(caller.address);
    expect(await domainToken.getAccessController()).to.equal(caller.address);
  });

  it("Should revert when setting access controller if caller does not have ADMIN_ROLE", async () => {
    await expect(
      domainToken.connect(caller).setAccessController(caller.address)
    ).to.be.revertedWith(
      getAccessRevertMsg(caller.address, ADMIN_ROLE)
    );
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