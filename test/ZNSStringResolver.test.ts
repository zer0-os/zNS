import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import * as hre from "hardhat";
import {
  AC_UNAUTHORIZED_ERR,
  AC_WRONGADDRESS_ERR,
  GOVERNOR_ROLE,
  hashDomainLabel,
  INITIALIZED_ERR, NOT_AUTHORIZED_ERR,
  validateUpgrade,
} from "./helpers";
import { IZNSCampaignConfig, IZNSContracts } from "../src/deploy/campaign/types";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { expect } from "chai";
import { ethers } from "hardhat";
import { registrationWithSetup } from "./helpers/register-setup";
import {
  ERC165__factory,
  ERC20Mock, ZNSAccessController, ZNSDomainToken, ZNSRegistry,
  ZNSStringResolver,
  ZNSStringResolverUpgradeMock__factory,
  ZNSTreasury,
} from "../typechain";
import { DeployCampaign, MongoDBAdapter } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getConfig } from "../src/deploy/campaign/get-config";
import Domain from "./helpers/domain/domain";


describe("ZNSStringResolver", () => {
  let domain : Domain;

  describe("Single state tests", () => {
    let zeroVault : SignerWithAddress;
    let user : SignerWithAddress;
    let deployAdmin : SignerWithAddress;
    let deployer : SignerWithAddress;
    let admin : SignerWithAddress;

    const env = "dev";

    let stringResolver : ZNSStringResolver;
    let registry : ZNSRegistry;
    let campaign : DeployCampaign<
    HardhatRuntimeEnvironment,
    SignerWithAddress,
    IZNSCampaignConfig,
    IZNSContracts
    >;
    let zns : IZNSContracts;
    let accessController : ZNSAccessController;

    let userBalance : bigint;

    const uri = "https://example.com/817c64af";
    const domainName = "domain";

    let mongoAdapter : MongoDBAdapter;

    before(async () => {
      [
        deployer,
        zeroVault,
        user,
        deployAdmin,
        admin,
      ] = await hre.ethers.getSigners();

      const campaignConfig = await getConfig({
        deployer,
        governors: [deployAdmin.address],
        admins: [admin.address],
        zeroVaultAddress: zeroVault.address,
        env,
      });

      campaign = await runZnsCampaign({
        config: campaignConfig,
      });
      zns = campaign.state.contracts;

      let meowToken : ERC20Mock;
      let treasury : ZNSTreasury;

      ({
        accessController,
        stringResolver,
        registry,
        meowToken,
        treasury,
        dbAdapter: mongoAdapter,
      } = campaign);

      userBalance = ethers.parseEther("1000000000000000000");
      await meowToken.mint(user.address, userBalance);
      await meowToken.connect(user).approve(await treasury.getAddress(), ethers.MaxUint256);

      domain = new Domain({
        zns,
        domainConfig: {
          label: domainName,
          parentHash: ethers.ZeroHash,
          owner: user,
          tokenURI: uri,
          tokenOwner: user.address,
          domainAddress: hre.ethers.ZeroAddress,
        },
      });
    });

    after(async () => {
      await mongoAdapter.dropDB();
    });

    it("Should not let initialize the contract twice", async () => {
      await expect(
        stringResolver.initialize(
          await zns.accessController.getAddress(),
          await registry.getAddress(),
        )
      ).to.be.revertedWithCustomError(
        stringResolver,
        INITIALIZED_ERR
      );
    });

    it("Should correctly attach the string to the domain", async () => {

      const newString = "hippopotamus";

      await domain.register();

      await stringResolver.connect(user).setString(domain.hash, newString);

      expect(
        await stringResolver.resolveDomainString(domain.hash)
      ).to.eq(
        newString
      );
    });

    it("Should setRegistry() using ADMIN_ROLE and emit an event", async () => {
      await expect(
        stringResolver.connect(admin).setRegistry(admin.address)
      ).to.emit(
        stringResolver,
        "RegistrySet"
      ).withArgs(admin.address);

      expect(await stringResolver.registry()).to.equal(admin.address);

      // reset regestry address on stringResolver
      await stringResolver.connect(admin).setRegistry(registry.target);
    });

    it("Should revert when setRegistry() without ADMIN_ROLE", async () => {
      await expect(
        stringResolver.connect(user).setRegistry(user.address)
      ).to.be.revertedWithCustomError(
        accessController,
        AC_UNAUTHORIZED_ERR
      );

      // reset regestry address on stringResolver
      await stringResolver.connect(admin).setRegistry(registry.target);
    });

    it("Should revert when setAccessController() without ADMIN_ROLE " +
      "(It cannot rewrite AC address after an incorrect address has been submitted to it)", async () => {
      await expect(
        stringResolver.connect(user).setAccessController(user.address)
      ).to.be.revertedWithCustomError(
        stringResolver,
        AC_UNAUTHORIZED_ERR
      );
    });
  });

  describe("New campaign for each test", () => {
    let deployer : SignerWithAddress;
    let zeroVault : SignerWithAddress;
    let operator : SignerWithAddress;
    let user : SignerWithAddress;
    let deployAdmin : SignerWithAddress;
    let admin : SignerWithAddress;

    const env = "dev";

    let stringResolver :  ZNSStringResolver;
    let registry : ZNSRegistry;
    let campaign : DeployCampaign<
    HardhatRuntimeEnvironment,
    SignerWithAddress,
    IZNSCampaignConfig,
    IZNSContracts
    >;
    let accessController : ZNSAccessController;
    let domainToken : ZNSDomainToken;
    let operatorBalance : bigint;
    let userBalance : bigint;
    let deployerBalance : bigint;

    let zns : IZNSContracts;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let mongoAdapter : MongoDBAdapter;

    beforeEach(async () => {
      [
        deployer,
        zeroVault,
        user,
        deployAdmin,
        admin,
        operator,
      ] = await hre.ethers.getSigners();

      const campaignConfig = await getConfig({
        deployer: deployer as unknown as SignerWithAddress,
        governors: [deployAdmin.address],
        admins: [admin.address],
        zeroVaultAddress: zeroVault.address,
        env,
      });

      campaign = await runZnsCampaign({
        config: campaignConfig,
      });

      let meowToken : ERC20Mock;
      let treasury : ZNSTreasury;

      zns = campaign.state.contracts;

      // eslint-disable-next-line max-len
      ({ stringResolver, registry, meowToken, treasury, accessController, domainToken, dbAdapter: mongoAdapter } = campaign);

      operatorBalance = ethers.parseEther("1000000000000000000");
      await meowToken.mint(operator.address, operatorBalance);
      await meowToken.connect(operator).approve(await treasury.getAddress(), ethers.MaxUint256);

      userBalance = ethers.parseEther("1000000000000000000");
      await meowToken.mint(user.address, userBalance);
      await meowToken.connect(user).approve(await treasury.getAddress(), ethers.MaxUint256);

      deployerBalance = ethers.parseEther("1000000000000000000");
      await meowToken.mint(deployer.address, deployerBalance);
      await meowToken.connect(deployer).approve(await treasury.getAddress(), ethers.MaxUint256);
    });

    afterEach(async () => {
      await mongoAdapter.dropDB();
    });

    it("Should not allow non-owner address to setString (similar domain and string)", async () => {
      const curStringDomain = "shouldbrake";

      domain = new Domain({
        zns,
        domainConfig: {
          label: curStringDomain,
          parentHash: ethers.ZeroHash,
          owner: operator,
          domainAddress: ethers.ZeroAddress,
        },
      });
      await domain.register();

      await expect(
        stringResolver.connect(user).setString(domain.hash, curStringDomain)
      ).to.be.revertedWithCustomError(
        stringResolver,
        NOT_AUTHORIZED_ERR
      );
    });

    it("Should allow OWNER to setString and emit event (similar domain and string)", async () => {
      const curString = "wolf";

      domain = new Domain({
        zns,
        domainConfig: {
          label: curString,
          parentHash: ethers.ZeroHash,
          owner: user,
          domainAddress: ethers.ZeroAddress,
        },
      });
      await domain.register();

      await expect(
        stringResolver.connect(user).setString(domain.hash, curString)
      ).to.emit(
        stringResolver,
        "StringSet"
      ).withArgs(
        domain.hash,
        curString
      );

      expect(
        await stringResolver.resolveDomainString(domain.hash)
      ).to.equal(curString);
    });

    it("Should allow OPERATOR to setString and emit event (different domain and string)", async () => {
      const curDomain = "wild";
      const curString = "wildlife";

      domain = new Domain({
        zns,
        domainConfig: {
          label: curDomain,
          parentHash: ethers.ZeroHash,
          owner: deployer,
          domainAddress: ethers.ZeroAddress,
        },
      });
      await domain.register();

      await registry.connect(deployer).setOwnersOperator(operator, true);

      await expect(
        stringResolver.connect(operator).setString(domain.hash, curString)
      ).to.emit(
        stringResolver,
        "StringSet"
      ).withArgs(
        domain.hash,
        curString
      );

      expect(
        await stringResolver.resolveDomainString(domain.hash)
      ).to.equal(curString);
    });

    it("Should support the IZNSAddressResolver interface ID", async () => {
      const interfaceId = await stringResolver.getInterfaceId();
      const supported = await stringResolver.supportsInterface(interfaceId);
      expect(supported).to.be.true;
    });

    it("Should support the ERC-165 interface ID", async () => {
      expect(
        await stringResolver.supportsInterface(
          ERC165__factory.createInterface()
            .getFunction("supportsInterface").selector
        )
      ).to.be.true;
    });

    it("Should not support other interface IDs", async () => {
      expect(
        await stringResolver.supportsInterface("0xffffffff")
      ).to.be.false;
    });

    describe("#setAccessController", () => {
      it("should allow ADMIN to set a valid AccessController", async () => {
        await stringResolver.connect(deployer).setAccessController(accessController.target);

        const currentAccessController = await stringResolver.getAccessController();

        expect(currentAccessController).to.equal(accessController.target);
      });

      it("should allow re-setting the AccessController to another valid contract", async () => {
        expect(
          await stringResolver.getAccessController()
        ).to.equal(
          accessController.target
        );

        const ZNSAccessControllerFactory = await ethers.getContractFactory("ZNSAccessController", deployer);
        const newAccessController = await ZNSAccessControllerFactory.deploy(
          [deployer.address],
          [deployer.address]
        );

        // then change the AccessController
        await stringResolver.connect(deployer).setAccessController(newAccessController.target);

        expect(
          await stringResolver.getAccessController()
        ).to.equal(
          newAccessController.target
        );
      });

      it("should emit AccessControllerSet event when setting a valid AccessController", async () => {
        await expect(
          stringResolver.connect(deployer).setAccessController(accessController.target)
        ).to.emit(
          stringResolver,
          "AccessControllerSet"
        ).withArgs(accessController.target);
      });

      it("should revert when a non-ADMIN tries to set AccessController", async () => {
        await expect(
          stringResolver.connect(user).setAccessController(accessController.target)
        ).to.be.revertedWithCustomError(
          stringResolver,
          AC_UNAUTHORIZED_ERR
        ).withArgs(user.address, GOVERNOR_ROLE);
      });

      it("should revert when setting an AccessController as EOA address", async () => {
        await expect(
          stringResolver.connect(deployer).setAccessController(user.address)
        ).to.be.revertedWithCustomError(
          stringResolver,
          AC_WRONGADDRESS_ERR
        ).withArgs(user.address);
      });

      it("should revert when setting an AccessController as another non-AC contract address", async () => {
        await expect(
          stringResolver.connect(deployer).setAccessController(stringResolver.target)
        ).to.be.revertedWithCustomError(
          stringResolver,
          AC_WRONGADDRESS_ERR
        ).withArgs(stringResolver.target);
      });

      it("should revert when setting a zero address as AccessController", async () => {
        await expect(
          stringResolver.connect(deployAdmin).setAccessController(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(
          stringResolver,
          AC_WRONGADDRESS_ERR
        ).withArgs(ethers.ZeroAddress);
      });
    });

    describe("UUPS", () => {

      it("Allows an authorized user to upgrade the StringResolver", async () => {
        // deployer deployed, deployAdmin wanna edit
        const factory = new ZNSStringResolverUpgradeMock__factory(deployer);
        const newStringResolver = await factory.deploy();
        await newStringResolver.waitForDeployment();

        // Confirm the deployer is a governor
        expect(
          await accessController.hasRole(GOVERNOR_ROLE, deployAdmin.address)
        ).to.be.true;

        const upgradeTx = domainToken.connect(deployAdmin).upgradeToAndCall(await newStringResolver.getAddress(), "0x");

        await expect(upgradeTx).to.not.be.reverted;
      });

      it("Fails to upgrade if the caller is not authorized", async () => {
        const factory = new ZNSStringResolverUpgradeMock__factory(deployer);

        // DomainToken to upgrade to
        const newStringResolver = await factory.deploy();
        await newStringResolver.waitForDeployment();

        // Confirm the operator is not a governor
        await expect(
          accessController.checkGovernor(operator.address)
        ).to.be.revertedWithCustomError(
          accessController,
          AC_UNAUTHORIZED_ERR
        );

        const upgradeTx = domainToken.connect(operator).upgradeToAndCall(await newStringResolver.getAddress(), "0x");

        await expect(upgradeTx).to.be.revertedWithCustomError(
          accessController,
          AC_UNAUTHORIZED_ERR
        );
      });

      it("Verifies that variable values are not changed in the upgrade process", async () => {
        const curString = "variableschange";

        await registrationWithSetup({
          zns,
          tokenOwner: deployer.address,
          user: deployer,
          domainLabel: curString,
          domainContent: ethers.ZeroAddress,
        });

        const factory = new ZNSStringResolverUpgradeMock__factory(deployer);
        const newStringResolver = await factory.deploy();
        await newStringResolver.waitForDeployment();

        await stringResolver.connect(deployer).setString(hashDomainLabel(curString), curString);

        const contractCalls = [
          stringResolver.registry(),
          stringResolver.resolveDomainString(hashDomainLabel(curString)),
        ];

        await validateUpgrade(deployAdmin, stringResolver, newStringResolver, factory, contractCalls);
      });
    });
  });
});
