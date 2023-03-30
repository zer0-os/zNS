import * as hre from "hardhat";
import {
  ZNSDomainToken,
  ZNSDomainToken__factory,
} from "../typechain";
import {expect} from "chai";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "ethers";

describe("ZNSDomainToken:", () => {
  const TokenName = "ZNSDomainToken";
  const TokenSymbol = "ZDT";

  let deployer: SignerWithAddress;
  let caller: SignerWithAddress;
  let domainToken: ZNSDomainToken;

  beforeEach(async () => {
    [deployer, caller] = await hre.ethers.getSigners();
    const domainTokenFactory = new ZNSDomainToken__factory(
      deployer
    );

    domainToken = await domainTokenFactory.deploy();
  });

  describe("External functions", () => {
    it("Registers a token", async () => {
      const tokenId = ethers.BigNumber.from("1");
      const tx = await domainToken
        .connect(deployer)
        .register(caller.address, tokenId);
      const receipt = await tx.wait(0);

      //Verify Transfer event is emitted
      expect(receipt.events?.[0].event).to.eq("Transfer");
      expect(receipt.events?.[0].args?.tokenId).to.eq(
        tokenId
      );
      expect(receipt.events?.[0].args?.to).to.eq(
        caller.address
      );

      //Verify caller owns tokenId
      expect(await domainToken.ownerOf(tokenId)).to.equal(
        caller.address
      );
    });

    it("Revokes a token", async () => {
      const tokenId = ethers.BigNumber.from("1");
      //Mint domain
      await domainToken
        .connect(deployer)
        .register(caller.address, tokenId);
      //Verify caller owns tokenId
      expect(await domainToken.ownerOf(tokenId)).to.equal(
        caller.address
      );

      //Revoke domain
      const tx = await domainToken
        .connect(caller)
        .revoke(tokenId);
      const receipt = await tx.wait(0);

      //Verify Transfer event is emitted
      expect(receipt.events?.[0].event).to.eq("Transfer");
      expect(receipt.events?.[0].args?.tokenId).to.eq(
        tokenId
      );
      expect(receipt.events?.[0].args?.to).to.eq(
        ethers.constants.AddressZero
      );

      //Verify token has been burned
      expect(
        domainToken.ownerOf(tokenId)
      ).to.be.revertedWith("ERC721: invalid token ID");
    });
  });

  describe("Require Statement Validation", () => {
    it("Only owner can revoke a token", async () => {
      const tokenId = ethers.BigNumber.from("1");
      //Mint domain
      await domainToken
        .connect(deployer)
        .register(caller.address, tokenId);

      //Verify caller owns tokenId
      expect(await domainToken.ownerOf(tokenId)).to.equal(
        caller.address
      );

      //Revoke domain
      const tx = domainToken
        .connect(deployer)
        .revoke(tokenId);
      await expect(tx).to.be.revertedWith(
        "ZNSDomainToken: Owner of sender does not match Owner of token"
      );

      //Verify token has not been burned
      expect(await domainToken.ownerOf(tokenId)).to.equal(
        caller.address
      );
    });
  });

  describe("Contract Configuration", () => {
    it("Verify token name", async () => {
      let name = await domainToken.name();
      expect(name).to.equal(TokenName);
    });

    it("Verify token symbol", async () => {
      let symbol = await domainToken.symbol();
      expect(symbol).to.equal(TokenSymbol);
    });
  });
});
