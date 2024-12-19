import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import * as hre from "hardhat";
import {
  AC_UNAUTHORIZED_ERR,
  distrConfigEmpty,
  GOVERNOR_ROLE,
  hashDomainLabel,
  INITIALIZED_ERR, NOT_AUTHORIZED_ERR,
  paymentConfigEmpty,
  validateUpgrade,
} from "./helpers";
import { IZNSCampaignConfig, IZNSContracts } from "../src/deploy/campaign/types";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { expect } from "chai";
import * as ethers from "ethers";
import { registrationWithSetup } from "./helpers/register-setup";
import {
  ERC165__factory,
  ZNSAccessController, ZNSDomainToken, ZNSRegistry,
  ZNSRootRegistrar,
  ZNSStringResolver,
  ZTokenMock,
  ZNSStringResolverUpgradeMock__factory,
  ZNSTreasury,
} from "../typechain";
import { DeployCampaign, MongoDBAdapter } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getConfig } from "../src/deploy/campaign/get-config";
import { IZNSContractsLocal } from "./helpers/types";


describe("ZNSStringResolver", () => {
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
    IZNSCampaignConfig<SignerWithAddress>,
    IZNSContracts
    >;
    let rootRegistrar : ZNSRootRegistrar;
    let accessController : ZNSAccessController;

    let userBalance : bigint;

    const uri = "https://example.com/817c64af";
    const domainName = "domain";
    const domainNameHash = hashDomainLabel(domainName);

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

      let zToken : ZTokenMock;
      let treasury : ZNSTreasury;

      ({
        accessController,
        stringResolver,
        registry,
        zToken,
        treasury,
        rootRegistrar,
        dbAdapter: mongoAdapter,
      } = campaign);

      userBalance = ethers.parseEther("1000000");
      await zToken.connect(admin).transfer(user.address, userBalance);
      await zToken.connect(user).approve(await treasury.getAddress(), ethers.MaxUint256);
    });

    after(async () => {
      await mongoAdapter.dropDB();
    });

    it("Should not let initialize the contract twice", async () => {
      await expect(
        stringResolver.initialize(
          await campaign.state.contracts.accessController.getAddress(),
          await registry.getAddress(),
        )
      ).to.be.revertedWithCustomError(
        stringResolver,
        INITIALIZED_ERR
      );
    });

    it("Should correctly attach the string to the domain", async () => {

      const newString = "hippopotamus";

      await rootRegistrar.connect(user).registerRootDomain(
        domainName,
        ethers.ZeroAddress,
        uri,
        distrConfigEmpty,
        paymentConfigEmpty,
      );
      await stringResolver.connect(user).setString(domainNameHash, newString);

      expect(
        await stringResolver.resolveDomainString(domainNameHash)
      ).to.eq(
        newString
      );
    });

    it("Should setRegistry() using ADMIN_ROLE and emit an event", async () => {
      await expect(
        stringResolver.connect(admin).setRegistry(admin.address)
      )
        .to.emit(stringResolver, "RegistrySet")
        .withArgs(admin.address);

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
        accessController,
        AC_UNAUTHORIZED_ERR
      );
    });

    it("Should setAccessController() correctly with ADMIN_ROLE " +
      "(It cannot rewrite AC address after an incorrect address has been submitted to it)", async () => {

      await expect(
        stringResolver.connect(admin).setAccessController(admin.address)
      ).to.emit(
        stringResolver, "AccessControllerSet"
      ).withArgs(admin.address);

      expect(
        await stringResolver.getAccessController()
      ).to.equal(admin.address);
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
    IZNSCampaignConfig<SignerWithAddress>,
    IZNSContracts
    >;
    let accessController : ZNSAccessController;
    let domainToken : ZNSDomainToken;
    let operatorBalance : bigint;
    let userBalance : bigint;
    let deployerBalance : bigint;

    let zns : IZNSContractsLocal;

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

      let zToken : ZTokenMock;
      let treasury : ZNSTreasury;

      zns = campaign.state.contracts as unknown as IZNSContractsLocal;

      // eslint-disable-next-line max-len
      ({ stringResolver, registry, zToken, treasury, accessController, domainToken, dbAdapter: mongoAdapter } = campaign);

      operatorBalance = ethers.parseEther("100000000");
      await zToken.connect(admin).transfer(operator.address, operatorBalance);
      await zToken.connect(operator).approve(await treasury.getAddress(), ethers.MaxUint256);

      userBalance = ethers.parseEther("100000000");
      await zToken.connect(admin).transfer(user.address, userBalance);
      await zToken.connect(user).approve(await treasury.getAddress(), ethers.MaxUint256);

      deployerBalance = ethers.parseEther("10000000");
      await zToken.connect(admin).transfer(deployer.address, deployerBalance);
      await zToken.connect(deployer).approve(await treasury.getAddress(), ethers.MaxUint256);
    });

    afterEach(async () => {
      await mongoAdapter.dropDB();
    });

    it("Should not allow non-owner address to setString (similar domain and string)", async () => {

      const curStringDomain = "shouldbrake";

      await registrationWithSetup({
        zns,
        user: operator,
        domainLabel: curStringDomain,
        domainContent: ethers.ZeroAddress,
      });

      await expect(
        stringResolver.connect(user).setString(hashDomainLabel(curStringDomain), curStringDomain)
      ).to.be.revertedWithCustomError(
        stringResolver,
        NOT_AUTHORIZED_ERR
      );
    });

    it("Should allow OWNER to setString and emit event (similar domain and string)", async () => {

      const curString = "wolf";
      const hash = hashDomainLabel(curString);

      await registrationWithSetup({
        zns,
        user,
        domainLabel: curString,
        domainContent: ethers.ZeroAddress,
      });

      await expect(
        stringResolver.connect(user).setString(hash, curString)
      ).to.emit(
        stringResolver,
        "StringSet"
      ).withArgs(
        hash,
        curString
      );

      expect(
        await stringResolver.resolveDomainString(hash)
      ).to.equal(curString);
    });

    it("Should allow OPERATOR to setString and emit event  (different domain and string)", async () => {

      const curDomain = "wild";
      const curString = "wildlife";
      const hash = hashDomainLabel(curDomain);

      await registrationWithSetup({
        zns,
        user: deployer,
        domainLabel: curDomain,
        domainContent: ethers.ZeroAddress,
      });

      await registry.connect(deployer).setOwnersOperator(operator, true);

      await expect(
        stringResolver.connect(operator).setString(hash, curString)
      ).to.emit(
        stringResolver,
        "StringSet"
      ).withArgs(
        hash,
        curString
      );

      expect(
        await stringResolver.resolveDomainString(hash)
      ).to.equal(curString);
    });

    it("Should setAccessController() correctly with ADMIN_ROLE", async () => {
      await expect(
        stringResolver.connect(admin).setAccessController(admin.address)
      ).to.emit(
        stringResolver, "AccessControllerSet"
      ).withArgs(admin.address);

      expect(
        await stringResolver.getAccessController()
      ).to.equal(admin.address);
    });

    it("Should revert when setAccessController() without ADMIN_ROLE", async () => {
      await expect(
        stringResolver.connect(user).setAccessController(user.address)
      ).to.be.revertedWithCustomError(
        accessController,
        AC_UNAUTHORIZED_ERR
      );
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

      // TODO: Falls on the role. I think, cannot give a REGISTRAR_ROLE to mock "deployAdmin".
      it("Verifies that variable values are not changed in the upgrade process", async () => {
        const curString = "variableschange";

        await registrationWithSetup({
          zns,
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
