import * as hre from "hardhat";
import {
  ZNSDomainTokenUpgradeMock__factory,
  ZNSDomainToken__factory, ERC165__factory,
} from "../typechain";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
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
  ZNS_DOMAIN_TOKEN_SYMBOL,
  INITIALIZED_ERR,
  DEFAULT_PERCENTAGE_BASIS, DEFAULT_ROYALTY_FRACTION,
} from "./helpers";
import { DeployZNSParams, IZNSContracts } from "./helpers/types";
import { getProxyImplAddress } from "./helpers/utils";


describe("ZNSDomainToken", () => {
  let deployer : SignerWithAddress;
  let caller : SignerWithAddress;
  let mockRegistrar : SignerWithAddress;
  let beneficiary : SignerWithAddress;

  let zns : IZNSContracts;
  let deployParams : DeployZNSParams;

  const randomTokenURI = "https://www.zNS.domains/1a3c2f5";

  beforeEach(async () => {
    [deployer, caller, mockRegistrar, beneficiary] = await hre.ethers.getSigners();
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
    expect(await zns.domainToken.getAccessController()).to.equal(await zns.accessController.getAddress());
    expect(await zns.domainToken.name()).to.equal(ZNS_DOMAIN_TOKEN_NAME);
    expect(await zns.domainToken.symbol()).to.equal(ZNS_DOMAIN_TOKEN_SYMBOL);
    const royaltyInfo = await zns.domainToken.royaltyInfo("0", parseEther("100"));
    expect(royaltyInfo[0]).to.equal(zns.zeroVaultAddress);
    expect(royaltyInfo[1]).to.equal(parseEther("2"));
  });

  it("should NOT initialize twice", async () => {
    await expect(zns.domainToken.initialize(
      deployer.address,
      ZNS_DOMAIN_TOKEN_NAME,
      ZNS_DOMAIN_TOKEN_SYMBOL,
      zns.zeroVaultAddress,
      DEFAULT_ROYALTY_FRACTION
    )).to.be.revertedWith(INITIALIZED_ERR);
  });

  it("Should NOT let initialize the implementation contract", async () => {
    const factory = new ZNSDomainToken__factory(deployer);
    const impl = await getProxyImplAddress(await zns.domainToken.getAddress());
    const implContract = factory.attach(impl);

    await expect(
      implContract.initialize(
        deployer.address,
        ZNS_DOMAIN_TOKEN_NAME,
        ZNS_DOMAIN_TOKEN_SYMBOL,
        zns.zeroVaultAddress,
        DEFAULT_ROYALTY_FRACTION
      )
    ).to.be.revertedWith(INITIALIZED_ERR);
  });

  describe("External functions", () => {
    it("Should register (mint) the token if caller has REGISTRAR_ROLE", async () => {
      const tokenId = BigInt("1");
      const tx = zns.domainToken
        .connect(mockRegistrar)
        .register(caller.address, tokenId, randomTokenURI);

      await expect(tx).to.emit(zns.domainToken, "Transfer").withArgs(
        ethers.ZeroAddress,
        caller.address,
        tokenId
      );

      // Verify caller owns tokenId
      expect(await zns.domainToken.ownerOf(tokenId)).to.equal(caller.address);
    });

    it("Should revert when registering (minting) if caller does not have REGISTRAR_ROLE", async () => {
      const tokenId = BigInt("1");
      await expect(
        zns.domainToken
          .connect(caller)
          .register(caller.address, tokenId, randomTokenURI)
      ).to.be.revertedWith(
        getAccessRevertMsg(caller.address, REGISTRAR_ROLE)
      );
    });

    it("Revokes a token", async () => {
      // Mint domain
      const tokenId = BigInt("1");
      await zns.domainToken
        .connect(mockRegistrar)
        .register(caller.address, tokenId, randomTokenURI);
      // Verify caller owns tokenId
      expect(await zns.domainToken.ownerOf(tokenId)).to.equal(
        caller.address
      );

      // Revoke domain
      const tx = zns.domainToken.connect(mockRegistrar).revoke(tokenId);

      // Verify Transfer event is emitted
      await expect(tx).to.emit(zns.domainToken, "Transfer").withArgs(
        caller.address,
        ethers.ZeroAddress,
        tokenId
      );

      // Verify token has been burned
      await expect(zns.domainToken.ownerOf(tokenId)).to.be.revertedWith(INVALID_TOKENID_ERC_ERR);
    });
  });

  describe("Require Statement Validation", () => {
    it("Only the registrar can call to register a token", async () => {
      const tokenId = BigInt("1");
      const registerTx = zns.domainToken
        .connect(caller)
        .register(caller.address, tokenId, randomTokenURI);

      await expect(registerTx).to.be.revertedWith(
        getAccessRevertMsg(caller.address, REGISTRAR_ROLE)
      );
    });

    it("Only authorized can revoke a token", async () => {
      const tokenId = BigInt("1");
      // Mint domain
      await zns.domainToken
        .connect(mockRegistrar)
        .register(caller.address, tokenId, randomTokenURI);
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

    it("Verify accessController", async () => {
      expect(
        await zns.domainToken.getAccessController()
      ).to.equal(
        await zns.accessController.getAddress()
      );
    });
  });

  describe("Royalties", () => {
    it("should set and correctly retrieve default royalty", async () => {
      const assetPrice = ethers.parseEther("164");

      const initialRoyaltyInfo = await zns.domainToken.royaltyInfo("0", assetPrice);

      // mint token
      const tokenId = BigInt("1326548");
      await zns.domainToken.connect(mockRegistrar).register(deployer.address, tokenId, randomTokenURI);

      const royaltyPerc = BigInt("237"); // 2.37%

      await zns.domainToken.connect(deployer).setDefaultRoyalty(beneficiary.address, royaltyPerc);

      const royaltyAmountExp = assetPrice * royaltyPerc / DEFAULT_PERCENTAGE_BASIS;

      // try pulling with incorrect tokenID - should still return the correct amount
      const royaltyInfoNoID = await zns.domainToken.royaltyInfo("0", assetPrice);

      // make sure the new value is set
      expect(royaltyInfoNoID[0]).to.not.equal(initialRoyaltyInfo[0]);
      expect(royaltyInfoNoID[1]).to.not.equal(initialRoyaltyInfo[1]);

      // make sure the new value is correct
      expect(royaltyInfoNoID[0]).to.equal(beneficiary.address);
      expect(royaltyInfoNoID[1]).to.equal(royaltyAmountExp);

      // try pulling with correct tokenID - should still be the same
      const royaltyInfo = await zns.domainToken.royaltyInfo(tokenId, assetPrice);
      expect(royaltyInfo[0]).to.equal(beneficiary.address);
      expect(royaltyInfo[1]).to.equal(royaltyAmountExp);
    });

    it("should set and correctly retrieve royalty for a specific token", async () => {
      // mint token
      const tokenId = BigInt("777356");
      await zns.domainToken.connect(mockRegistrar).register(deployer.address, tokenId, randomTokenURI);

      const assetPrice = parseEther("19");
      const royaltyPerc = BigInt("1013"); // 2.37%

      await zns.domainToken.connect(deployer).setTokenRoyalty(tokenId, beneficiary.address, royaltyPerc);

      const royaltyAmountExp = assetPrice * royaltyPerc / DEFAULT_PERCENTAGE_BASIS;

      // try pulling with incorrect tokenID - should return default values from initizlize()
      const royaltyInfoNoID = await zns.domainToken.royaltyInfo("0", assetPrice);

      expect(royaltyInfoNoID[0]).to.equal(zns.zeroVaultAddress);
      expect(royaltyInfoNoID[1]).to.equal(assetPrice * DEFAULT_ROYALTY_FRACTION / DEFAULT_PERCENTAGE_BASIS);

      // try pulling with correct tokenID - should return correct amount
      const royaltyInfo = await zns.domainToken.royaltyInfo(tokenId, assetPrice);
      expect(royaltyInfo[0]).to.equal(beneficiary.address);
      expect(royaltyInfo[1]).to.equal(royaltyAmountExp);
    });

    it("#setDefaultRoyalty() should revert if called by anyone other than ADMIN_ROLE", async () => {
      await expect(
        zns.domainToken.connect(caller).setDefaultRoyalty(beneficiary.address, 100)
      ).to.be.revertedWith(
        getAccessRevertMsg(caller.address, ADMIN_ROLE)
      );
    });

    it("#setTokenRoyalty() should revert if called by anyone other than ADMIN_ROLE", async () => {
      // mint token
      const tokenId = BigInt("777356");
      await zns.domainToken.connect(mockRegistrar).register(deployer.address, tokenId, randomTokenURI);

      await expect(
        zns.domainToken.connect(caller).setTokenRoyalty(tokenId, beneficiary.address, 100)
      ).to.be.revertedWith(
        getAccessRevertMsg(caller.address, ADMIN_ROLE)
      );
    });
  });

  describe("Token URIs", () => {
    it("should support individual tokenURIs", async () => {
      // mint a token
      const tokenId = BigInt("13354684");
      const tokenURI = "https://www.zNS.domains/1a3c2f5";

      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, tokenURI);

      const uriFromSC = await zns.domainToken.tokenURI(tokenId);

      // verify the tokenURI is correct
      expect(uriFromSC).to.equal(tokenURI);
    });

    it("should support baseURI method with tokenURI as 0", async () => {
      // mint a token
      const tokenId = BigInt("13354684");
      const baseURI = "https://www.zNS.domains/";
      const emptyTokenURI = "";

      await zns.domainToken.connect(deployer).setBaseURI(baseURI);

      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, emptyTokenURI);

      const uriFromSC = await zns.domainToken.tokenURI(tokenId);

      // verify the tokenURI is correct
      expect(uriFromSC).to.equal(baseURI + tokenId.toString());
    });

    it("should support baseURI + tokenURI concatenation if both are set correctly", async () => {
      // mint a token
      const tokenId = BigInt("35226748");
      const baseURI = "https://www.zNS.domains/";
      const tokenURI = "1a3c2f5";

      await zns.domainToken.connect(deployer).setBaseURI(baseURI);

      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, tokenURI);

      const fullURIExp = baseURI + tokenURI;
      expect(fullURIExp).to.equal("https://www.zNS.domains/1a3c2f5");

      const uriFromSC = await zns.domainToken.tokenURI(tokenId);

      // verify the tokenURI is correct
      expect(uriFromSC).to.equal(fullURIExp);
    });

    // ! proper checks should be added to the app to not let this happen !
    it("should return WRONG URI if both baseURI and tokenURI are set as separate links", async () => {
      // mint a token
      const tokenId = BigInt("777777");
      const baseURI = "https://www.zNS.domains/";
      const tokenURI = "https://www.wilderworld.io/1a3c2f5";

      await zns.domainToken.connect(deployer).setBaseURI(baseURI);

      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, tokenURI);

      const wrongURIExp = baseURI + tokenURI;
      expect(wrongURIExp).to.equal("https://www.zNS.domains/https://www.wilderworld.io/1a3c2f5");

      const uriFromSC = await zns.domainToken.tokenURI(tokenId);

      // verify the tokenURI is correct
      expect(uriFromSC).to.equal(wrongURIExp);
    });

    it("should be able to switch from tokenURI to baseURI if tokenURI is deleted", async () => {
      // mint a token
      const tokenId = BigInt("333355");
      const baseURI = "https://www.zNS.domains/";
      const tokenURI = "https://www.wilderworld.io/1a3c2f5";

      await zns.domainToken.connect(deployer).setBaseURI(baseURI);

      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, tokenURI);

      const wrongURIExp = baseURI + tokenURI;
      expect(wrongURIExp).to.equal("https://www.zNS.domains/https://www.wilderworld.io/1a3c2f5");

      let uriFromSC = await zns.domainToken.tokenURI(tokenId);
      // verify the tokenURI is correct
      expect(uriFromSC).to.equal(wrongURIExp);

      // now delete the tokenURI
      await zns.domainToken.connect(deployer).setTokenURI(tokenId, "");

      uriFromSC = await zns.domainToken.tokenURI(tokenId);

      // verify the tokenURI is correct
      expect(uriFromSC).to.equal(baseURI + tokenId.toString());
    });

    it("#setTokenURI() should set tokenURI correctly", async () => {
      // mint a token
      const tokenId = BigInt("333355");
      const tokenURI = "https://www.wilderworld.io/1a3c2f5";
      const newTokenURI = "https://www.zNS.domains/33fa57cd8";

      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, tokenURI);

      const uriFromSC = await zns.domainToken.tokenURI(tokenId);

      expect(uriFromSC).to.equal(tokenURI);

      await zns.domainToken.connect(deployer).setTokenURI(tokenId, newTokenURI);

      const uriFromSC2 = await zns.domainToken.tokenURI(tokenId);

      expect(uriFromSC2).to.equal(newTokenURI);

      // set to empty string
      await zns.domainToken.connect(deployer).setTokenURI(tokenId, "");

      const uriFromSC3 = await zns.domainToken.tokenURI(tokenId);
      expect(uriFromSC3).to.equal("");
    });

    it("#setTokenURI() should revert if called by anyone other than ADMIN_ROLE", async () => {
      // mint a token
      const tokenId = BigInt("333355");
      const tokenURI = "https://www.wilderworld.io/1a3c2f5";
      const newTokenURI = "https://www.zNS.domains/33fa57cd8";

      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, tokenURI);

      await expect(
        zns.domainToken.connect(caller).setTokenURI(tokenId, newTokenURI)
      ).to.be.revertedWith(
        getAccessRevertMsg(caller.address, ADMIN_ROLE)
      );
    });

    it("#setBaseURI() should revert when called by anyone other than ADMIN_ROLE", async () => {
      const baseURI = "https://www.zNS.domains/";

      await expect(
        zns.domainToken.connect(caller).setBaseURI(baseURI)
      ).to.be.revertedWith(
        getAccessRevertMsg(caller.address, ADMIN_ROLE)
      );
    });
  });

  describe("ERC-165", () => {
    it("should support IERC721", async () => {
      expect(await zns.domainToken.supportsInterface("0x80ac58cd")).to.be.true;
    });

    it("should support IERC2981", async () => {
      expect(await zns.domainToken.supportsInterface("0x2a55205a")).to.be.true;
    });

    it("should support IERC165", async () => {
      const erc165Interface = ERC165__factory.createInterface();
      const interfaceId = erc165Interface.getSighash(erc165Interface.functions["supportsInterface(bytes4)"]);

      expect(await zns.domainToken.supportsInterface(interfaceId)).to.be.true;
    });

    it("should not support random interface", async () => {
      expect(await zns.domainToken.supportsInterface("0x12345678")).to.be.false;
    });
  });

  describe("UUPS", () => {
    it("Allows an authorized user to upgrade the contract", async () => {
      // DomainToken to upgrade to
      const factory = new ZNSDomainToken__factory(deployer);
      const newDomainToken = await factory.deploy();
      await newDomainToken.waitForDeployment();

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
      await newDomainToken.waitForDeployment();

      // Call to register a token
      const tokenId = BigInt("1");
      await zns.domainToken.connect(mockRegistrar).register(deployer.address, tokenId, randomTokenURI);
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
      await newDomainToken.waitForDeployment();

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