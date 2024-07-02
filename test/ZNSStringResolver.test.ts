import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import * as hre from "hardhat";
import {
  ADMIN_ROLE,
  distrConfigEmpty,
  getAccessRevertMsg,
  GOVERNOR_ROLE,
  hashDomainLabel,
  INITIALIZED_ERR,
  paymentConfigEmpty,
  validateUpgrade,
} from "./helpers";
import { IZNSContracts } from "../src/deploy/campaign/types";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { expect } from "chai";
import * as ethers from "ethers";
import { registrationWithSetup } from "./helpers/register-setup";
import {
  ERC165__factory,
  MeowTokenMock, ZNSAccessController, ZNSDomainToken, ZNSRegistry, ZNSRootRegistrar,
  ZNSStringResolver,
  ZNSStringResolverUpgradeMock__factory,
  ZNSTreasury,
} from "../typechain";
import { DeployCampaign, MongoDBAdapter } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DefenderRelayProvider } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { getConfig } from "../src/deploy/campaign/environments";


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
    DefenderRelayProvider,
    IZNSContracts
    >;
    let rootRegistrar : ZNSRootRegistrar;

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
        operator,
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

      let meowToken : MeowTokenMock;
      let treasury : ZNSTreasury;

      ({ stringResolver, registry, meowToken, treasury, rootRegistrar, dbAdapter: mongoAdapter } = campaign);

      userBalance = ethers.parseEther("1000000000000000000");
      await meowToken.mint(user.address, userBalance);
      await meowToken.connect(user).approve(await treasury.getAddress(), ethers.MaxUint256);
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
      ).to.be.revertedWith(
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
      ).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );

      // reset regestry address on stringResolver
      await stringResolver.connect(admin).setRegistry(registry.target);
    });

    it("Should revert when setAccessController() without ADMIN_ROLE " +
      "(It cannot rewrite AC address after an incorrect address has been submitted to it)", async () => {
      await expect(
        stringResolver.connect(user).setAccessController(user.address)
      ).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
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
    DefenderRelayProvider,
    IZNSContracts
    >;
    let accessController : ZNSAccessController;
    let domainToken : ZNSDomainToken;
    let operatorBalance : bigint;
    let userBalance : bigint;
    let deployerBalance : bigint;

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
        mockRegistrar,
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

      let meowToken : MeowTokenMock;
      let treasury : ZNSTreasury;

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

    it("Should not allow non-owner address to setString (similar domain and string)", async () => {

      const curStringDomain = "shouldbrake";

      await registrationWithSetup({
        zns: campaign.state.contracts,
        user: operator,
        domainLabel: curStringDomain,
        domainContent: ethers.ZeroAddress,
      });

      await expect(
        stringResolver.connect(user).setString(hashDomainLabel(curStringDomain), curStringDomain)
      ).to.be.revertedWithCustomError(
        stringResolver,
        "NotOwnerOrOperator"
      );
    });

    it("Should allow OWNER to setString and emit event (similar domain and string)", async () => {

      const curString = "wolf";
      const hash = hashDomainLabel(curString);

      await registrationWithSetup({
        zns: campaign.state.contracts,
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
        zns: campaign.state.contracts,
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
      ).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
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

        const upgradeTx = domainToken.connect(deployAdmin).upgradeTo(await newStringResolver.getAddress());

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
        ).to.be.revertedWith(
          getAccessRevertMsg(operator.address, GOVERNOR_ROLE)
        );

        const upgradeTx = domainToken.connect(operator).upgradeTo(await newStringResolver.getAddress());

        await expect(upgradeTx).to.be.revertedWith(
          getAccessRevertMsg(operator.address, GOVERNOR_ROLE)
        );
      });

      // TODO: Falls on the role. I think, cannot give a REGISTRAR_ROLE to mock "deployAdmin".
      it("Verifies that variable values are not changed in the upgrade process", async () => {
        const curString = "variableschange";

        await registrationWithSetup({
          zns: campaign.state.contracts,
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