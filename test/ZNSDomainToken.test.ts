import * as hre from "hardhat";
import {
  ZNSDomainTokenUpgradeMock__factory,
  ZNSDomainToken__factory, ERC165__factory, ZNSDomainToken,
} from "../typechain";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import {
  ADMIN_ROLE,
  REGISTRAR_ROLE,
  GOVERNOR_ROLE,
  NONEXISTENT_TOKEN_ERC_ERR,
  deployZNS,
  validateUpgrade,
  ZNS_DOMAIN_TOKEN_NAME,
  ZNS_DOMAIN_TOKEN_SYMBOL,
  INITIALIZED_ERR,
  DEFAULT_PERCENTAGE_BASIS,
  DEFAULT_ROYALTY_FRACTION,
  AC_UNAUTHORIZED_ERR,
  ERC721_NOT_APPROVED_ERR,
  ZERO_ADDRESS_ERR,
  DeployZNSParams,
  getProxyImplAddress,
  ALREADY_FULL_OWNER_ERR,
  NOT_FULL_OWNER_ERR,
  CANNOT_BURN_TOKEN_ERR,
  ERC721_INVALID_RECEIVER_ERR,
  hashDomainLabel,
  AC_WRONGADDRESS_ERR,
} from "./helpers";
import { DOMAIN_TOKEN_ROLE } from "../src/deploy/constants";
import { IZNSContracts } from "../src/deploy/campaign/types";


describe("ZNSDomainToken", () => {
  let deployer : SignerWithAddress;
  let caller : SignerWithAddress;
  let mockRegistrar : SignerWithAddress;
  let mockRegistry : SignerWithAddress;
  let beneficiary : SignerWithAddress;
  let zeroVault : SignerWithAddress;

  let zns : IZNSContracts;
  let deployParams : DeployZNSParams;

  const randomTokenURI = "https://www.zNS.domains/1a3c2f5";

  beforeEach(async () => {
    [deployer, caller, mockRegistrar, mockRegistry, beneficiary, zeroVault] = await hre.ethers.getSigners();
    deployParams = {
      zeroVaultAddress: zeroVault.address,
      deployer,
      governorAddresses: [deployer.address],
      adminAddresses: [deployer.address],
    };

    zns = await deployZNS(
      deployParams
    );

    await zns.accessController.connect(deployer).grantRole(DOMAIN_TOKEN_ROLE, await zns.domainToken.getAddress());
    await zns.accessController.connect(deployer).grantRole(REGISTRAR_ROLE, mockRegistrar.address);
  });

  it("should initialize correctly", async () => {
    expect(await zns.domainToken.getAccessController()).to.equal(await zns.accessController.getAddress());
    expect(await zns.domainToken.name()).to.equal(ZNS_DOMAIN_TOKEN_NAME);
    expect(await zns.domainToken.symbol()).to.equal(ZNS_DOMAIN_TOKEN_SYMBOL);
    expect(await zns.domainToken.registry()).to.equal(await zns.registry.getAddress());
    const royaltyInfo = await zns.domainToken.royaltyInfo("0", ethers.parseEther("100"));
    expect(royaltyInfo[0]).to.equal(zeroVault.address);
    expect(royaltyInfo[1]).to.equal(ethers.parseEther("2"));
  });

  it("should NOT initialize twice", async () => {
    await expect(zns.domainToken.initialize(
      deployer.address,
      ZNS_DOMAIN_TOKEN_NAME,
      ZNS_DOMAIN_TOKEN_SYMBOL,
      zeroVault,
      DEFAULT_ROYALTY_FRACTION,
      await zns.registry.getAddress()
    )).to.be.revertedWithCustomError(zns.domainToken, INITIALIZED_ERR);
  });

  it("Should NOT let initialize the implementation contract", async () => {
    const factory = new ZNSDomainToken__factory(deployer);
    const impl = await getProxyImplAddress(await zns.domainToken.getAddress());
    const implContract = factory.attach(impl) as ZNSDomainToken;

    await expect(
      implContract.initialize(
        deployer.address,
        ZNS_DOMAIN_TOKEN_NAME,
        ZNS_DOMAIN_TOKEN_SYMBOL,
        zeroVault,
        DEFAULT_ROYALTY_FRACTION,
        await zns.registry.getAddress()
      )
    ).to.be.revertedWithCustomError(implContract, INITIALIZED_ERR);
  });

  describe("#setRegistry", () => {
    it("Should set ZNSRegistry and fire RegistrySet event", async () => {
      const currentRegistry = await zns.domainToken.registry();
      const tx = await zns.domainToken.connect(deployer).setRegistry(mockRegistry.address);
      const newRegistry = await zns.domainToken.registry();

      await expect(tx).to.emit(zns.domainToken, "RegistrySet").withArgs(mockRegistry.address);

      expect(newRegistry).to.equal(mockRegistry .address);
      expect(currentRegistry).to.not.equal(newRegistry);
    });

    it("Should revert if not called by ADMIN", async () => {
      const tx = zns.domainToken.connect(caller).setRegistry(mockRegistry.address);
      await expect(tx).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(caller.address, ADMIN_ROLE);
    });

    it("Should revert if ZNSRegistry is address zero", async () => {
      const tx = zns.rootRegistrar.connect(deployer).setRegistry(ethers.ZeroAddress);
      await expect(tx).to.be.revertedWithCustomError(
        zns.rootRegistrar,
        ZERO_ADDRESS_ERR
      );
    });
  });

  describe("#setAccessController", () => {
    it("should allow ADMIN to set a valid AccessController", async () => {
      await zns.domainToken.connect(deployer).setAccessController(zns.accessController.target);

      const currentAccessController = await zns.domainToken.getAccessController();

      expect(currentAccessController).to.equal(zns.accessController.target);
    });

    it("should allow re-setting the AccessController to another valid contract", async () => {
      expect(
        await zns.domainToken.getAccessController()
      ).to.equal(
        zns.accessController.target
      );

      const ZNSAccessControllerFactory = await ethers.getContractFactory("ZNSAccessController", deployer);
      const newAccessController = await ZNSAccessControllerFactory.deploy(
        [deployer.address],
        [deployer.address]
      );

      // then change the AccessController
      await zns.domainToken.connect(deployer).setAccessController(newAccessController.target);

      expect(
        await zns.domainToken.getAccessController()
      ).to.equal(
        newAccessController.target
      );
    });

    it("should emit AccessControllerSet event when setting a valid AccessController", async () => {
      await expect(
        zns.domainToken.connect(deployer).setAccessController(zns.accessController.target)
      ).to.emit(
        zns.domainToken,
        "AccessControllerSet"
      ).withArgs(zns.accessController.target);
    });

    it("should revert when a non-ADMIN tries to set AccessController", async () => {
      await expect(
        zns.domainToken.connect(caller).setAccessController(zns.accessController.target)
      ).to.be.revertedWithCustomError(
        zns.domainToken,
        AC_UNAUTHORIZED_ERR
      ).withArgs(caller.address, GOVERNOR_ROLE);
    });

    it("should revert when setting an AccessController as EOA address", async () => {
      await expect(
        zns.domainToken.connect(deployer).setAccessController(caller.address)
      ).to.be.revertedWithCustomError(
        zns.domainToken,
        AC_WRONGADDRESS_ERR
      ).withArgs(caller.address);
    });

    it("should revert when setting an AccessController as another non-AC contract address", async () => {
      await expect(
        zns.domainToken.connect(deployer).setAccessController(zns.domainToken.target)
      ).to.be.revertedWithCustomError(
        zns.domainToken,
        AC_WRONGADDRESS_ERR
      ).withArgs(zns.domainToken.target);
    });

    it("should revert when setting a zero address as AccessController", async () => {
      await expect(
        zns.domainToken.connect(deployer).setAccessController(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(
        zns.domainToken,
        AC_WRONGADDRESS_ERR
      ).withArgs(ethers.ZeroAddress);
    });
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

    it("Should increment the totalSupply when a domain is registered", async () => {
      const tokenId = BigInt("1");

      const supplyBefore = await zns.domainToken.totalSupply();

      await zns.domainToken
        .connect(mockRegistrar)
        .register(caller.address, tokenId, randomTokenURI);

      const supplyAfter = await zns.domainToken.totalSupply();
      expect(supplyAfter).to.equal(supplyBefore + BigInt(1));
    });

    it("Should decrement the totalSupply when a domain is revoked", async () => {
      const tokenId = BigInt("1");

      const supplyBefore = await zns.domainToken.totalSupply();

      await zns.domainToken
        .connect(mockRegistrar)
        .register(caller.address, tokenId, randomTokenURI);

      await zns.domainToken.connect(mockRegistrar).revoke(tokenId);

      const supplyAfter = await zns.domainToken.totalSupply();
      expect(supplyAfter).to.equal(supplyBefore);
    });

    it("Should revert when registering (minting) if caller does not have REGISTRAR_ROLE", async () => {
      const tokenId = BigInt("1");
      await expect(zns.domainToken
        .connect(caller)
        .register(caller.address, tokenId, randomTokenURI))
        .to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(caller.address,REGISTRAR_ROLE);
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
      await expect(zns.domainToken.ownerOf(tokenId)).to.be.revertedWithCustomError(
        zns.domainToken,
        NONEXISTENT_TOKEN_ERC_ERR
      );
    });

    // eslint-disable-next-line max-len
    it("#isControlled() should return the correct boolean based on the domain-token ownership config", async () => {
      const domainHash = hashDomainLabel("tesst");

      // same owner for both
      await zns.domainToken.connect(mockRegistrar).register(caller.address, BigInt(domainHash), "");
      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, caller.address, "0x0");

      expect(await zns.domainToken.isControlled(domainHash)).to.be.false;

      // split owners
      await zns.domainToken.connect(mockRegistrar).transferOverride(deployer.address, domainHash);

      expect(await zns.domainToken.isControlled(domainHash)).to.be.true;
    });
  });

  describe("Transfers",  () => {
    const tokenId = 1;
    const domainHash = ethers.solidityPacked(["uint256"], [tokenId]);

    it("Should update owner for DomainToken and in Registry when transferred normally", async () => {
      // Setup for caller as owner of both
      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, "");
      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, caller.address, "0x0");

      expect(await zns.domainToken.ownerOf(tokenId)).to.equal(caller.address);
      expect(await zns.registry.getDomainOwner(domainHash)).to.equal(caller.address);

      // Call to standard transfer function modifies both
      await zns.domainToken.connect(caller).transferFrom(caller.address, deployer.address, tokenId);

      expect(await zns.domainToken.ownerOf(tokenId)).to.equal(deployer.address);
      expect(await zns.registry.getDomainOwner(domainHash)).to.equal(deployer.address);
    });

    it("Allows the owner of the domain record in the registry to update the owner", async () => {
      // Setup for caller as owner of both
      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, "");
      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, caller.address, "0x0");

      expect(await zns.domainToken.ownerOf(tokenId)).to.equal(caller.address);
      expect(await zns.registry.getDomainOwner(domainHash)).to.equal(caller.address);

      // The owner of the reg record can still update independent of the token transfer method
      await zns.registry.connect(caller).updateDomainOwner(domainHash, deployer.address);

      expect(await zns.registry.getDomainOwner(domainHash)).to.equal(deployer.address);
      expect(await zns.domainToken.ownerOf(tokenId)).to.equal(caller.address);
    });

    // eslint-disable-next-line max-len
    it("Fails when non-owner tries to transfer through `safeTransferFrom` and transfers with approval when token and registry record owned by the same address", async () => {
      // Setup for caller as owner of both
      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, "");
      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, caller.address, "0x0");

      await expect(
        zns.domainToken.connect(deployer)
          ["safeTransferFrom(address,address,uint256)"]
          (caller.address, deployer.address, tokenId)
      ).to.be.revertedWithCustomError(zns.domainToken, ERC721_NOT_APPROVED_ERR);

      await expect(
        zns.domainToken.connect(deployer)
          ["safeTransferFrom(address,address,uint256,bytes)"]
          (caller.address, deployer.address, tokenId, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(zns.domainToken, ERC721_NOT_APPROVED_ERR);

      // Approve deployer to spend on behalf of caller, then deployer safeTransferFrom passes
      await zns.domainToken.connect(caller).approve(deployer.address, tokenId);
      await zns.domainToken.connect(deployer)
        ["safeTransferFrom(address,address,uint256)"]
        (caller.address, deployer.address, tokenId);

      // validate
      expect(await zns.domainToken.ownerOf(tokenId)).to.equal(deployer.address);
      expect(await zns.registry.getDomainOwner(domainHash)).to.equal(deployer.address);
    });

    it("Fails when non-owner tries to transfer through `transferFrom`", async () => {
      // Setup for caller as owner of both
      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, "");
      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, caller.address, "0x0");

      await expect(
        zns.domainToken.connect(deployer).transferFrom(caller.address, deployer.address, tokenId)
      ).to.be.revertedWithCustomError(zns.domainToken, ERC721_NOT_APPROVED_ERR);

      // Approve deployer to spend on behalf of caller, then deployer transferFrom passes
      await zns.domainToken.connect(caller).approve(deployer.address, tokenId);
      await zns.domainToken.connect(deployer).transferFrom(caller.address, deployer.address, tokenId);

      // validate
      expect(await zns.domainToken.ownerOf(tokenId)).to.equal(deployer.address);
      expect(await zns.registry.getDomainOwner(domainHash)).to.equal(deployer.address);
    });

    // eslint-disable-next-line max-len
    it("#transferFrom() should fail when called by address that only owns the token and not registry record", async () => {
      // Setup for caller as owner of token only
      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, "");
      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, deployer.address, "0x0");

      await expect(
        zns.domainToken.connect(caller).transferFrom(caller.address, deployer.address, tokenId)
      ).to.be.revertedWithCustomError(zns.domainToken, NOT_FULL_OWNER_ERR);
    });

    it("#transferOverride() should fail when called by non-registrar", async () => {
      // Setup for caller as owner of both
      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, "");
      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, caller.address, "0x0");

      await expect(
        zns.domainToken.connect(deployer).transferOverride(deployer.address, tokenId)
      ).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR);
    });

    it("#transferOverride() should update owner for DomainToken only and not for Registry", async () => {
      // Setup for caller as owner of both
      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, "");
      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, caller.address, "0x0");

      expect(await zns.domainToken.ownerOf(tokenId)).to.equal(caller.address);
      expect(await zns.registry.getDomainOwner(domainHash)).to.equal(caller.address);

      // After calling the reg owner will be the same but the token owner is different
      await zns.domainToken.connect(mockRegistrar).transferOverride(deployer.address, tokenId);

      expect(await zns.domainToken.ownerOf(tokenId)).to.equal(deployer.address);
      expect(await zns.registry.getDomainOwner(domainHash)).to.equal(caller.address);
    });

    it("#transferOverride() should revert when transferring to an existing owner", async () => {
      // Setup for caller as owner of both
      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, "");
      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, caller.address, "0x0");

      await expect(
        zns.domainToken.connect(mockRegistrar).transferOverride(caller.address, tokenId)
      ).to.be.revertedWithCustomError(zns.domainToken, ALREADY_FULL_OWNER_ERR)
        .withArgs(caller.address, domainHash);
    });

    it("#transferOverride() should override approvals", async () => {
      // Setup for different addresses owning hash and token
      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, "");
      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, beneficiary.address, "0x0");

      // Approve deployer
      await zns.domainToken.connect(caller).approve(deployer.address, tokenId);
      // if called by Registrar it should override the approval and be able to transfer anywhere
      await zns.domainToken.connect(mockRegistrar).transferOverride(mockRegistry.address, tokenId);

      // validate this cleared the approval
      const approvedAddress = await zns.domainToken.getApproved(tokenId);
      expect(approvedAddress).to.equal(ethers.ZeroAddress);

      // should revert if called by the approved address
      await zns.domainToken.connect(mockRegistry).approve(deployer.address, tokenId);
      await expect(
        zns.domainToken.connect(deployer).transferOverride(deployer.address, tokenId)
      ).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(deployer.address, REGISTRAR_ROLE);

      // validate
      expect(await zns.domainToken.ownerOf(tokenId)).to.equal(mockRegistry.address);
      expect(await zns.registry.getDomainOwner(domainHash)).to.equal(beneficiary.address);
    });

    it("#transferOverride() should emit a `Transfer` event", async () => {
      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, "");
      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, caller.address, "0x0");

      await expect(
        zns.domainToken.connect(mockRegistrar).transferOverride(deployer.address, tokenId)
      ).to.emit(zns.domainToken, "Transfer").withArgs(
        caller.address,
        deployer.address,
        tokenId
      );
    });

    // eslint-disable-next-line max-len
    it("#transferOverride() should revert when transferring to address zero (should NOT let to burn the token)", async () => {
      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, "");
      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, caller.address, "0x0");

      await expect(
        zns.domainToken.connect(mockRegistrar).transferOverride(ethers.ZeroAddress, tokenId)
      ).to.be.revertedWithCustomError(zns.domainToken, CANNOT_BURN_TOKEN_ERR);
    });

    // eslint-disable-next-line max-len
    it("#transferOverride() should revert when transferring to a contract not implementing #onERC721Received()", async () => {
      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, "");
      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, caller.address, "0x0");

      await expect(
        zns.domainToken.connect(mockRegistrar).transferOverride(zns.registry.target, tokenId)
      ).to.be.revertedWithCustomError(zns.domainToken, ERC721_INVALID_RECEIVER_ERR);
    });

    // eslint-disable-next-line max-len
    it("#transferOverride() should revert when transferring to an address that returns incorrect selector from #onERC721Received", async () => {
      // Deploy a mock contract that implements the ERC721Receiver interface but returns an incorrect selector
      const MockERC721Receiver = await hre.ethers.getContractFactory("ERC721ReceiverIncorrect", deployer);
      const mockReceiver = await MockERC721Receiver.deploy();
      await mockReceiver.waitForDeployment();

      await zns.domainToken.connect(mockRegistrar).register(caller.address, tokenId, "");
      await zns.registry.connect(mockRegistrar).createDomainRecord(domainHash, caller.address, "0x0");

      await expect(
        zns.domainToken.connect(mockRegistrar).transferOverride(mockReceiver.target, tokenId)
      ).to.be.revertedWithCustomError(zns.domainToken, ERC721_INVALID_RECEIVER_ERR);
    });
  });

  describe("Custom Error Validation", () => {
    it("Only the registrar can call to register a token", async () => {
      const tokenId = BigInt("1");
      const registerTx = zns.domainToken
        .connect(caller)
        .register(caller.address, tokenId, randomTokenURI);

      await expect(registerTx).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(caller.address,REGISTRAR_ROLE);
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
      await expect(tx).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(caller.address,REGISTRAR_ROLE);

      // Verify token has not been burned
      expect(await zns.domainToken.ownerOf(tokenId)).to.equal(caller.address);
    });

    it("Should revert when setting access controller if caller does not have ADMIN_ROLE", async () => {
      await expect(zns.domainToken.connect(caller).setAccessController(caller.address))
        .to.be.revertedWithCustomError(zns.domainToken, AC_UNAUTHORIZED_ERR)
        .withArgs(caller.address, GOVERNOR_ROLE);
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

      const assetPrice = ethers.parseEther("19");
      const royaltyPerc = BigInt("1013"); // 2.37%

      await zns.domainToken.connect(deployer).setTokenRoyalty(tokenId, beneficiary.address, royaltyPerc);

      const royaltyAmountExp = assetPrice * royaltyPerc / DEFAULT_PERCENTAGE_BASIS;

      // try pulling with incorrect tokenID - should return default values from initizlize()
      const royaltyInfoNoID = await zns.domainToken.royaltyInfo("0", assetPrice);

      expect(royaltyInfoNoID[0]).to.equal(zeroVault.address);
      expect(royaltyInfoNoID[1]).to.equal(assetPrice * DEFAULT_ROYALTY_FRACTION / DEFAULT_PERCENTAGE_BASIS);

      // try pulling with correct tokenID - should return correct amount
      const royaltyInfo = await zns.domainToken.royaltyInfo(tokenId, assetPrice);
      expect(royaltyInfo[0]).to.equal(beneficiary.address);
      expect(royaltyInfo[1]).to.equal(royaltyAmountExp);
    });

    it("#setDefaultRoyalty() should revert if called by anyone other than ADMIN_ROLE", async () => {
      await expect(zns.domainToken.connect(caller).setDefaultRoyalty(beneficiary.address, 100))
        .to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(caller.address,ADMIN_ROLE);
    });

    it("#setTokenRoyalty() should revert if called by anyone other than ADMIN_ROLE", async () => {
      // mint token
      const tokenId = BigInt("777356");
      await zns.domainToken.connect(mockRegistrar).register(deployer.address, tokenId, randomTokenURI);

      await expect(zns.domainToken.connect(caller).setTokenRoyalty(tokenId, beneficiary.address, 100))
        .to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(caller.address, ADMIN_ROLE);
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

      await expect(zns.domainToken.connect(caller).setTokenURI(tokenId, newTokenURI))
        .to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(caller.address, ADMIN_ROLE);
    });

    it("#setBaseURI() should revert when called by anyone other than ADMIN_ROLE", async () => {
      const baseURI = "https://www.zNS.domains/";

      await expect(zns.domainToken.connect(caller).setBaseURI(baseURI))
        .to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(caller.address, ADMIN_ROLE);
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
      const fragment = erc165Interface.getFunction("supportsInterface");

      expect(await zns.domainToken.supportsInterface(fragment.selector)).to.be.true;
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

      const upgradeTx = zns.domainToken.connect(deployer).upgradeToAndCall(
        await newDomainToken.getAddress(),
        "0x"
      );

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
      await expect(zns.accessController.checkGovernor(caller.address))
        .to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(caller.address, GOVERNOR_ROLE);

      const upgradeTx = zns.domainToken.connect(caller).upgradeToAndCall(
        await newDomainToken.getAddress(),
        "0x"
      );

      await expect(upgradeTx).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(caller.address, GOVERNOR_ROLE);
    });
  });
});
