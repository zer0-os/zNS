import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ZNSSubdomainToken } from "../typechain";

describe("SubdomainToken", () => {
  let subdomainToken : ZNSSubdomainToken;
  let owner : SignerWithAddress;
  let admin : SignerWithAddress;
  let user : SignerWithAddress;
  let receiver : SignerWithAddress;

  const tokenURI = "https://example.com/token/1";
  const tokenIdA = 1;

  beforeEach(async () => {
    [owner, admin, user, receiver] = await ethers.getSigners();

    // Deploy the SubdomainToken contract
    const SubdomainTokenFactory = await ethers.getContractFactory("ZNSSubdomainToken");
    subdomainToken = await SubdomainTokenFactory.deploy(
      "SubdomainToken",
      "SDT",
      "1.0",
      owner.address,
      admin.address
    ) as ZNSSubdomainToken;
    await subdomainToken.waitForDeployment();
  });

  describe("#register", () => {
    it("should register a new token and set its URI", async () => {
      await subdomainToken.connect(admin).register(
        user.address,
        tokenIdA,
        tokenURI
      );

      const ownerOfToken = await subdomainToken.ownerOf(tokenIdA);
      expect(ownerOfToken).to.equal(user.address);

      const uri = await subdomainToken.tokenURI(tokenIdA);
      expect(uri).to.equal(tokenURI);

      const totalSupply = await subdomainToken.totalSupply();
      expect(totalSupply).to.equal(1);
    });

    it("should revert when trying to register a token with an existing tokenId", async () => {
      await subdomainToken.connect(admin).register(
        user.address,
        tokenIdA,
        tokenURI
      );

      const totalSupplyBefore = await subdomainToken.totalSupply();
      await expect(
        subdomainToken.connect(admin).register(
          user.address,
          tokenIdA,
          tokenURI
        )
      ).to.be.revertedWithCustomError(
        subdomainToken,
        "ERC721InvalidSender"
      );

      const totalSupplyAfter = await subdomainToken.totalSupply();

      expect(totalSupplyAfter).to.equal(totalSupplyBefore);
    });

    // TODO: remove skip when AccessControl is implemented
    it.skip("should revert when a non-admin tries to register a token", async () => {
      await expect(
        subdomainToken.connect(user).register(
          user.address,
          tokenIdA,
          tokenURI
        )
      ).to.be.revertedWith("AccessControl: account is missing role");
    });
  });

  describe("#revoke", () => {
    it("#revoke should revoke a token and decrease total supply", async () => {
      await subdomainToken.connect(admin).register(
        user.address,
        tokenIdA,
        tokenURI
      );

      await subdomainToken.connect(admin).revoke(tokenIdA);

      const totalSupply = await subdomainToken.totalSupply();
      expect(totalSupply).to.equal(0);

      await expect(
        subdomainToken.ownerOf(tokenIdA)
      ).to.be.revertedWithCustomError(
        subdomainToken,
        "ERC721NonexistentToken"
      );
    });

    it("should revert when trying to revoke a non-existent token", async () => {
      const tokenIdB = 999; // Non-existent token ID

      await expect(
        subdomainToken.connect(admin).revoke(tokenIdB)
      ).to.be.revertedWithCustomError(
        subdomainToken,
        "ERC721NonexistentToken"
      );
    });

    // TODO: remove skip when AccessControl is implemented
    it.skip("should revert when a non-admin tries to revoke a token", async () => {
      await subdomainToken.connect(admin).register(
        user.address,
        tokenIdA,
        tokenURI
      );

      await expect(
        subdomainToken.connect(user).revoke(tokenIdA)
      ).to.be.revertedWith("AccessControl: account is missing role");
    });
  });

  describe("#setTokenURI", () => {
    it("#setTokenURI should set a new token URI", async () => {
      const newTokenURI = "https://example.com/token/updated";

      await subdomainToken.connect(admin).register(
        user.address,
        tokenIdA,
        tokenURI
      );
      await subdomainToken.connect(admin).setTokenURI(tokenIdA, newTokenURI);

      const uri = await subdomainToken.tokenURI(tokenIdA);
      expect(uri).to.equal(newTokenURI);
    });

    it("should revert when trying to set a token URI for a non-existent token", async () => {
      const newTokenURI = "https://example.com/token/updated";
      const tokenIdB = 7777; // Non-existent token ID

      await expect(
        subdomainToken.connect(admin).setTokenURI(tokenIdB, newTokenURI)
      ).to.be.revertedWithCustomError(
        subdomainToken,
        "ERC721NonexistentToken"
      );
    });

    // TODO: remove skip when AccessControl is implemented
    it.skip("should revert when a non-admin tries to set a token URI", async () => {
      const tokenId = 1;
      const newTokenURI = "https://example.com/token/updated";

      await subdomainToken.connect(admin).register(
        user.address,
        tokenId,
        "https://example.com/token/1"
      );

      await expect(
        subdomainToken.connect(user).setTokenURI(tokenId, newTokenURI)
      ).to.be.revertedWith("AccessControl: account is missing role");
    });
  });

  describe("#transferFrom", () => {
    it("#transferFrom should transfer a token to another address", async () => {
      await subdomainToken.connect(admin).register(
        user.address,
        tokenIdA,
        tokenURI
      );

      await subdomainToken.connect(user).transferFrom(
        user.address,
        receiver.address,
        tokenIdA
      );

      const ownerOfToken = await subdomainToken.ownerOf(tokenIdA);
      expect(ownerOfToken).to.equal(receiver.address);
    });

    it("should revert when trying to transfer a non-existent token", async () => {
      await expect(
        subdomainToken.connect(user).transferFrom(
          user.address,
          receiver.address,
          tokenIdA
        )
      ).to.be.revertedWithCustomError(
        subdomainToken,
        "ERC721NonexistentToken"
      );
    });

    it("should revert when a non-owner tries to transfer a token", async () => {
      await subdomainToken.connect(admin).register(
        user.address,
        tokenIdA,
        tokenURI
      );

      await expect(
        subdomainToken.connect(receiver).transferFrom(
          user.address,
          receiver.address,
          tokenIdA
        )
      ).to.be.reverted;
    });
  });

  describe("#setDefaultRoyalty", () => {
    it("#setDefaultRoyalty should set default royalty", async () => {
      const royaltyFraction = 500; // 5%

      await subdomainToken.connect(admin).setDefaultRoyalty(receiver.address, royaltyFraction);

      const [
        royaltyReceiver,
        royaltyAmount,
      ] = await subdomainToken.royaltyInfo(1, 10000);

      expect(royaltyReceiver).to.equal(receiver.address);
      expect(royaltyAmount).to.equal(500);
    });

    it("should revert when trying to set default royalty with invalid parameters", async () => {
      const invalidReceiver = ethers.ZeroAddress;
      const royaltyFraction = 500;

      await expect(
        subdomainToken.connect(admin).setDefaultRoyalty(invalidReceiver, royaltyFraction)
      ).to.be.revertedWithCustomError(
        subdomainToken,
        "ERC2981InvalidDefaultRoyaltyReceiver"
      );
    });

    // TODO: remove skip when AccessControl is implemented
    it.skip("should revert when a non-admin tries to set default royalty", async () => {
      const royaltyFraction = 500;

      await expect(
        subdomainToken.connect(user).setDefaultRoyalty(receiver.address, royaltyFraction)
      ).to.be.revertedWith("AccessControl: account is missing role");
    });
  });

  describe("#setTokenRoyalty", () => {
    it("#setTokenRoyalty should set royalty for a specific token", async () => {
      const royaltyFraction = 300; // 3%

      await subdomainToken.connect(admin).register(
        user.address,
        tokenIdA,
        tokenURI
      );
      await subdomainToken.connect(admin).setTokenRoyalty(tokenIdA, receiver.address, royaltyFraction);

      const [royaltyReceiver, royaltyAmount] = await subdomainToken.royaltyInfo(tokenIdA, 10000);
      expect(royaltyReceiver).to.equal(receiver.address);
      expect(royaltyAmount).to.equal(300);
    });

    it("should revert when trying to set token royalty for a non-existent token", async () => {
      const tokenIdB = 10000; // Non-existent token ID
      const royaltyFraction = 300;

      await expect(
        subdomainToken.connect(admin).setTokenRoyalty(tokenIdB, receiver.address, royaltyFraction)
      ).to.be.revertedWith("ERC721NonexistentToken");
    });

    // TODO: remove skip when AccessControl is implemented
    it.skip("should revert when a non-admin tries to set token royalty", async () => {
      const royaltyFraction = 300;

      await subdomainToken.connect(admin).register(
        user.address,
        tokenIdA,
        "https://example.com/token/1"
      );

      await expect(
        subdomainToken.connect(user).setTokenRoyalty(tokenIdA, receiver.address, royaltyFraction)
      ).to.be.revertedWith("AccessControl: account is missing role");
    });
  });

  describe("#setRegistry", () => {
    it("#setRegistry should be able to set a new registry address twice", async () => {
      const newRegistry = receiver.address;
      await subdomainToken.connect(admin).setRegistry(newRegistry);
      const registry = await subdomainToken.registry();
      expect(registry).to.equal(newRegistry);

      await subdomainToken.connect(admin).setRegistry(user.address);
      const newRegistry2 = await subdomainToken.registry();
      expect(newRegistry2).to.equal(user.address);
    });

    // TODO: remove skip when AccessControl is implemented
    it.skip("should revert when a non-admin tries to set the registry address", async () => {
      const newRegistry = receiver.address;

      await expect(
        subdomainToken.connect(user).setRegistry(newRegistry)
      ).to.be.revertedWith("AccessControl: account is missing role");
    });
  });

  describe("#supportsInterface", () => {
    it("#supportsInterface should support all connected interfaces", async () => {
      expect(await subdomainToken.supportsInterface("0x80ac58cd")).to.be.true; // ERC721
      expect(await subdomainToken.supportsInterface("0x780e9d63")).to.be.true; // ERC721Enumerable
      expect(await subdomainToken.supportsInterface("0x5b5e139f")).to.be.true; // ERC721Metadata (via ERC721URIStorage)
      expect(await subdomainToken.supportsInterface("0x2a55205a")).to.be.true; // ERC2981
    });
  });
});