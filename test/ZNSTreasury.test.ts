import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  checkBalance, DEFAULT_TOKEN_URI, deployTreasury,
  deployZNS,
  distrConfigEmpty,
  getPriceObject,
  NO_BENEFICIARY_ERR,
  INITIALIZED_ERR,
  DEFAULT_PRICE_CONFIG,
  validateUpgrade,
  NOT_AUTHORIZED_ERR,
  getStakingOrProtocolFee, AC_UNAUTHORIZED_ERR, ZERO_ADDRESS_ERR,
} from "./helpers";
import { DeployZNSParams, IZNSContractsLocal } from "./helpers/types";
import * as ethers from "ethers";
import { hashDomainLabel, hashSubdomainName } from "./helpers/hashing";
import { ADMIN_ROLE, REGISTRAR_ROLE, GOVERNOR_ROLE } from "../src/deploy/constants";
import { ZNSTreasury, ZNSTreasury__factory, ZNSTreasuryUpgradeMock__factory } from "../typechain";
import { getProxyImplAddress } from "./helpers/utils";
import { defaultRootRegistration } from "./helpers/register-setup";

require("@nomicfoundation/hardhat-chai-matchers");


describe("ZNSTreasury", () => {
  let deployer : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let user : SignerWithAddress;
  let zeroVault : SignerWithAddress;
  let mockRegistrar : SignerWithAddress;
  let randomAcc : SignerWithAddress;
  let zns : IZNSContractsLocal;

  const domainName = "wilderrr";
  const domainHash = hashDomainLabel(domainName);
  let paymentConfig : {
    token : string;
    beneficiary : string;
  };

  beforeEach(async () => {
    [
      deployer,
      governor,
      admin,
      zeroVault,
      user,
      mockRegistrar,
      randomAcc,
    ] = await hre.ethers.getSigners();

    const params : DeployZNSParams = {
      deployer,
      governorAddresses: [governor.address],
      adminAddresses: [admin.address],
      zeroVaultAddress: zeroVault.address,
    };

    zns = await deployZNS(params);

    paymentConfig = {
      token: await zns.meowToken.getAddress(),
      beneficiary: user.address,
    };

    // give REGISTRAR_ROLE to a wallet address to be calling guarded functions
    await zns.accessController.connect(admin).grantRole(REGISTRAR_ROLE, mockRegistrar.address);

    // Give funds to user
    await zns.meowToken.connect(user).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
    await zns.meowToken.mint(user.address, ethers.parseEther("50000"));

    // register random domain
    await defaultRootRegistration({
      user,
      zns,
      domainName,
      tokenOwner: user.address,
      paymentConfig,
    });
  });

  it("Should initialize correctly", async () => {
    const registry = await zns.treasury.registry();
    const {
      token,
      beneficiary,
    } = await zns.treasury.paymentConfigs(ethers.ZeroHash);
    const accessController = await zns.treasury.getAccessController();

    expect(registry).to.eq(await zns.registry.getAddress());
    expect(token).to.eq(await zns.meowToken.getAddress());
    expect(beneficiary).to.eq(zns.zeroVaultAddress);
    expect(accessController).to.eq(await zns.accessController.getAddress());
  });

  it("should NOT initialize twice", async () => {
    const tx = zns.treasury.initialize(
      await zns.registry.getAddress(),
      await zns.meowToken.getAddress(),
      zns.zeroVaultAddress,
      await zns.accessController.getAddress()
    );
    await expect(tx).to.be.revertedWithCustomError(
      zns.treasury,
      INITIALIZED_ERR
    );
  });

  it("Should NOT let initialize the implementation contract", async () => {
    const factory = new ZNSTreasury__factory(deployer);
    const impl = await getProxyImplAddress(await zns.treasury.getAddress());
    const implContract = factory.attach(impl) as ZNSTreasury;

    await expect(
      implContract.initialize(
        await zns.registry.getAddress(),
        await zns.meowToken.getAddress(),
        zns.zeroVaultAddress,
        await zns.accessController.getAddress()
      )
    ).to.be.revertedWithCustomError(implContract, INITIALIZED_ERR);
  });

  it("should NOT deploy/initialize with 0x0 addresses as args", async () => {
    const args = {
      deployer,
      accessControllerAddress: await zns.accessController.getAddress(),
      registryAddress: await zns.registry.getAddress(),
      zTokenMockAddress: await zns.meowToken.getAddress(),
      zeroVaultAddress: zns.zeroVaultAddress,
      isTenderlyRun: false,
    };

    await Object.keys(args).reduce(
      async (acc, key) => {
        await acc;

        if (key !== "deployer" && key !== "isTenderlyRun") {
          await expect(
            deployTreasury({
              ...args,
              [key]: ethers.ZeroAddress,
            })
          ).to.be.reverted;
        }
      }, Promise.resolve()
    );
  });

  describe("#stakeForDomain()", () => {
    it("Stakes the correct amount", async () => {
      const balanceBeforeStake = await zns.meowToken.balanceOf(user.address);
      const zeroVaultBalanceBeforeStake = await zns.meowToken.balanceOf(zeroVault.address);

      const expectedStake = await zns.curvePricer.getPrice(
        ethers.ZeroHash,
        domainName,
        false
      );
      const fee = await zns.curvePricer.getFeeForPrice(ethers.ZeroHash, expectedStake);

      await zns.treasury.connect(mockRegistrar).stakeForDomain(
        ethers.ZeroHash,
        domainHash,
        user.address,
        expectedStake,
        "0",
        fee
      );

      const { amount: stake } = await zns.treasury.stakedForDomain(domainHash);
      expect(stake).to.eq(expectedStake);

      await checkBalance({
        token: zns.meowToken,
        balanceBefore: balanceBeforeStake,
        userAddress: user.address,
        target: stake + fee,
        shouldDecrease: true,
      });

      const zeroVaultBalanceAfterStake = await zns.meowToken.balanceOf(zeroVault.address);
      expect(zeroVaultBalanceAfterStake).to.eq(zeroVaultBalanceBeforeStake + fee);
    });

    it("Should revert if called from an address without REGISTRAR_ROLE", async () => {
      await expect(zns.treasury.connect(randomAcc).stakeForDomain(
        ethers.ZeroHash,
        domainHash,
        user.address,
        BigInt(0),
        BigInt(0),
        BigInt(0)
      )).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(randomAcc.address,REGISTRAR_ROLE);
    });

    it("Should fire StakeDeposited event with correct params", async () => {
      const {
        expectedPrice,
        stakeFee: protocolFee,
      } = getPriceObject(
        domainName,
        DEFAULT_PRICE_CONFIG
      );

      const tx = zns.treasury.connect(mockRegistrar).stakeForDomain(
        ethers.ZeroHash,
        domainHash,
        user.address,
        expectedPrice,
        BigInt(0),
        protocolFee
      );

      await expect(tx)
        .to.emit(zns.treasury, "StakeDeposited")
        .withArgs(
          ethers.ZeroHash,
          domainHash,
          user.address,
          await zns.meowToken.getAddress(),
          expectedPrice,
          BigInt(0),
          protocolFee
        );
    });
  });

  describe("#unstakeForDomain()", () => {
    it("Unstakes the correct amount and saves the correct token", async () => {
      const stakeAmt = ethers.parseEther("173");
      const protocolFee = ethers.parseEther("3.112");

      await zns.treasury.connect(mockRegistrar).stakeForDomain(
        ethers.ZeroHash,
        domainHash,
        user.address,
        stakeAmt,
        BigInt(0),
        protocolFee
      );

      const balanceBeforeUnstake = await zns.meowToken.balanceOf(user.address);
      const { token, amount: stake } = await zns.treasury.stakedForDomain(domainHash);

      await zns.treasury.connect(mockRegistrar).unstakeForDomain(domainHash, user.address, protocolFee);

      await checkBalance({
        token: zns.meowToken,
        balanceBefore: balanceBeforeUnstake,
        userAddress: user.address,
        target: stake - protocolFee,
        shouldDecrease: false,
      });
      expect(token).to.eq(await zns.meowToken.getAddress());
    });

    it("Should revert if called from an address without REGISTRAR_ROLE", async () => {
      const { amount } = await zns.treasury.stakedForDomain(domainHash);
      const protocolFee = getStakingOrProtocolFee(amount);
      await expect(zns.treasury.connect(user).unstakeForDomain(
        domainHash,
        user.address,
        protocolFee
      )).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(user.address,REGISTRAR_ROLE);
    });
  });

  describe("#processDirectPayment()", () => {
    it("should process payment correctly with paymentConfig set", async () => {
      const randomHash = hashDomainLabel("randommmmmmmm2342342");
      const config = {
        token: await zns.meowToken.getAddress(),
        beneficiary: user.address,
      };

      await zns.registry.connect(mockRegistrar).createDomainRecord(
        randomHash,
        user.address,
        ethers.ZeroAddress,
      );

      await zns.treasury.connect(user).setPaymentConfig(
        randomHash,
        config
      );

      const paymentAmt = ethers.parseEther("1000");
      const protocolFee = ethers.parseEther("10");
      // give tokens to mock registrar
      await zns.meowToken.connect(user).transfer(mockRegistrar.address, paymentAmt + protocolFee);
      await zns.meowToken.connect(mockRegistrar).approve(await zns.treasury.getAddress(), paymentAmt + protocolFee);

      const userBalanceBefore = await zns.meowToken.balanceOf(user.address);
      const payerBalanceBefore = await zns.meowToken.balanceOf(mockRegistrar.address);
      const zeroVaultBalanceBefore = await zns.meowToken.balanceOf(zeroVault.address);

      await zns.treasury.connect(mockRegistrar).processDirectPayment(
        randomHash,
        domainHash,
        mockRegistrar.address,
        paymentAmt,
        protocolFee
      );

      const userBalanceAfter = await zns.meowToken.balanceOf(user.address);
      const payerBalanceAfter = await zns.meowToken.balanceOf(mockRegistrar.address);
      const zeroVaultBalanceAfter = await zns.meowToken.balanceOf(zeroVault.address);

      expect(userBalanceAfter - userBalanceBefore).to.eq(paymentAmt);
      expect(payerBalanceBefore - payerBalanceAfter).to.eq(paymentAmt + protocolFee);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(protocolFee);
    });

    it("should revert if paymentConfig not set", async () => {
      const randomHash = hashDomainLabel("randommmmmmmm2342342");

      const {
        token,
        beneficiary,
      } = await zns.treasury.paymentConfigs(randomHash);
      expect(token).to.eq(ethers.ZeroAddress);
      expect(beneficiary).to.eq(ethers.ZeroAddress);

      const paymentAmt = ethers.parseEther("100");
      const protocolFee = ethers.parseEther("7");

      await expect(
        zns.treasury.connect(mockRegistrar).processDirectPayment(
          randomHash,
          domainHash,
          mockRegistrar.address,
          paymentAmt,
          protocolFee
        )
      ).to.be.revertedWithCustomError(
        zns.treasury,
        NO_BENEFICIARY_ERR
      );
    });

    it("should revert if called by anyone other than REGISTRAR_ROLE", async () => {
      await expect(zns.treasury.connect(randomAcc).processDirectPayment(
        ethers.ZeroHash,
        domainHash,
        mockRegistrar.address,
        "0",
        "0"
      )).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(randomAcc.address,REGISTRAR_ROLE);
    });

    it("should emit DirectPaymentProcessed event with correct params", async () => {
      const paymentAmt = ethers.parseEther("100");
      const protocolFee = ethers.parseEther("7");
      // give tokens to mock registrar
      await zns.meowToken.connect(user).transfer(mockRegistrar.address, paymentAmt + protocolFee);
      await zns.meowToken.connect(mockRegistrar).approve(await zns.treasury.getAddress(), paymentAmt + protocolFee);

      await expect(
        zns.treasury.connect(mockRegistrar).processDirectPayment(
          ethers.ZeroHash,
          domainHash,
          mockRegistrar.address,
          paymentAmt,
          protocolFee
        )
      ).to.emit(zns.treasury, "DirectPaymentProcessed").withArgs(
        ethers.ZeroHash,
        domainHash,
        mockRegistrar.address,
        zeroVault.address,
        paymentAmt,
        protocolFee
      );
    });
  });

  describe("#setPaymentConfig(), BeneficiarySet and PaymentTokenSet", () => {
    it("should set payment config for an existing subdomain", async () => {
      const {
        token: paymentTokenBefore,
        beneficiary: beneficiaryBefore,
      } = await zns.treasury.paymentConfigs(domainHash);
      expect(paymentTokenBefore).to.eq(paymentConfig.token);
      expect(beneficiaryBefore).to.eq(paymentConfig.beneficiary);

      const configToSet = {
        token: randomAcc.address,
        beneficiary: randomAcc.address,
      };

      const tx = await zns.treasury.connect(user).setPaymentConfig(
        domainHash,
        configToSet,
      );

      const {
        token: paymentTokenAfter,
        beneficiary: beneficiaryAfter,
      } = await zns.treasury.paymentConfigs(domainHash);
      expect(paymentTokenAfter).to.eq(configToSet.token);
      expect(beneficiaryAfter).to.eq(configToSet.beneficiary);

      await expect(tx).to.emit(zns.treasury, "BeneficiarySet").withArgs(
        domainHash,
        configToSet.beneficiary
      );
      await expect(tx).to.emit(zns.treasury, "PaymentTokenSet").withArgs(
        domainHash,
        configToSet.token
      );
    });

    it("should NOT allow setting for non-authorized account", async () => {
      const configToSet = {
        token: randomAcc.address,
        beneficiary: randomAcc.address,
      };

      await expect(
        zns.treasury.connect(randomAcc).setPaymentConfig(domainHash, configToSet)
      ).to.be.revertedWithCustomError(
        zns.treasury,
        NOT_AUTHORIZED_ERR
      );
    });

    it("should NOT set token or beneficiary to 0x0 address", async () => {
      const zeroBeneficiaryConf = {
        beneficiary: ethers.ZeroAddress,
        token: randomAcc.address,
      };

      await expect(
        zns.treasury.connect(user).setPaymentConfig(domainHash, zeroBeneficiaryConf)
      ).to.be.revertedWithCustomError(
        zns.treasury,
        ZERO_ADDRESS_ERR
      );

      const meowTokenConf = {
        token: ethers.ZeroAddress,
        beneficiary: randomAcc.address,
      };

      await expect(
        zns.treasury.connect(user).setPaymentConfig(domainHash, meowTokenConf)
      ).to.be.revertedWithCustomError(
        zns.treasury,
        ZERO_ADDRESS_ERR
      );
    });
  });

  describe("#setBeneficiary() and BeneficiarySet event", () => {
    it("Should set the correct address of Zero Vault", async () => {
      const {
        beneficiary: currentZeroVault,
      } = await zns.treasury.paymentConfigs(ethers.ZeroHash);
      expect(currentZeroVault).to.not.eq(mockRegistrar.address);

      const tx = await zns.treasury.setBeneficiary(
        ethers.ZeroHash,
        mockRegistrar.address
      );

      const { beneficiary: newZeroVault } = await zns.treasury.paymentConfigs(ethers.ZeroHash);
      expect(newZeroVault).to.eq(mockRegistrar.address);

      await expect(tx).to.emit(zns.treasury, "BeneficiarySet").withArgs(
        ethers.ZeroHash,
        mockRegistrar.address
      );
    });

    it("Should revert when called by anyone other than owner or operator", async () => {
      const tx = zns.treasury.connect(randomAcc).setBeneficiary(
        ethers.ZeroHash,
        mockRegistrar.address
      );
      await expect(tx).to.be.revertedWithCustomError(zns.treasury, NOT_AUTHORIZED_ERR);
    });

    it("Should revert when beneficiary is address 0", async () => {
      const tx = zns.treasury.setBeneficiary(
        ethers.ZeroHash,
        ethers.ZeroAddress
      );
      await expect(tx).to.be.revertedWithCustomError(zns.treasury, ZERO_ADDRESS_ERR);
    });
  });

  describe("#setPaymentToken() and PaymentTokenSet event", () => {
    it("Should set the correct address", async () => {
      const { token: currentStakingToken } = await zns.treasury.paymentConfigs(domainHash);
      expect(currentStakingToken).to.not.eq(randomAcc.address);

      const tx = await zns.treasury.connect(user).setPaymentToken(
        domainHash,
        randomAcc.address
      );

      const { token: newStakingToken } = await zns.treasury.paymentConfigs(domainHash);
      expect(newStakingToken).to.eq(randomAcc.address);

      await expect(tx).to.emit(zns.treasury, "PaymentTokenSet").withArgs(
        domainHash,
        randomAcc.address
      );
    });

    it("Should revert when called by anyone other than owner or operator ", async () => {
      const tx = zns.treasury.connect(randomAcc).setPaymentToken(
        domainHash,
        randomAcc.address
      );
      await expect(tx).to.be.revertedWithCustomError(
        zns.treasury,
        NOT_AUTHORIZED_ERR
      );
    });

    it("Should revert when paymentToken is address 0", async () => {
      const tx = zns.treasury.connect(user).setPaymentToken(domainHash, ethers.ZeroAddress);
      await expect(tx).to.be.revertedWithCustomError(zns.treasury, ZERO_ADDRESS_ERR);
    });
  });

  describe("#setAccessController() and AccessControllerSet event", () => {
    it("Should set the correct address of Access Controller", async () => {
      const currentAccessController = await zns.treasury.getAccessController();
      expect(currentAccessController).to.not.eq(randomAcc.address);

      const tx = await zns.treasury.setAccessController(randomAcc.address);

      const newAccessController = await zns.treasury.getAccessController();
      expect(newAccessController).to.eq(randomAcc.address);

      await expect(tx).to.emit(zns.treasury, "AccessControllerSet").withArgs(randomAcc.address);
    });

    it("Should revert when called from any address without ADMIN_ROLE", async () => {
      const tx = zns.treasury.connect(user).setAccessController(randomAcc.address);
      await expect(tx).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(user.address,ADMIN_ROLE);
    });

    it("Should revert when accessController is address 0", async () => {
      const tx = zns.treasury.setAccessController(ethers.ZeroAddress);
      await expect(tx).to.be.revertedWithCustomError(zns.treasury, ZERO_ADDRESS_ERR);
    });
  });

  describe("#setRegistry() and RegistrySet event", () => {
    it("Should set the correct address of Registry", async () => {
      const currentRegistry = await zns.treasury.registry();
      expect(currentRegistry).to.not.eq(randomAcc.address);

      const tx = await zns.treasury.setRegistry(randomAcc.address);

      const newRegistry = await zns.treasury.registry();
      expect(newRegistry).to.eq(randomAcc.address);

      await expect(tx).to.emit(zns.treasury, "RegistrySet").withArgs(randomAcc.address);
    });

    it("Should revert when called from any address without ADMIN_ROLE", async () => {
      const tx = zns.treasury.connect(user).setRegistry(randomAcc.address);
      await expect(tx).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(user.address,ADMIN_ROLE);
    });

    it("Should revert when registry is address 0", async () => {
      const tx = zns.treasury.setRegistry(ethers.ZeroAddress);
      await expect(tx).to.be.revertedWithCustomError(zns.treasury, ZERO_ADDRESS_ERR);
    });
  });

  describe("UUPS", () => {
    it("Allows an authorized user can upgrade the contract", async () => {
      // Confirm deployer has the correct role first
      expect(
        await zns.accessController.hasRole(GOVERNOR_ROLE, deployer.address)
      ).to.be.true;

      const treasuryFactory = new ZNSTreasuryUpgradeMock__factory(deployer);
      const treasury = await treasuryFactory.deploy();
      await treasury.waitForDeployment();

      await expect(zns.treasury.connect(deployer).upgradeToAndCall(
        await treasury.getAddress(),
        "0x"
      )).to.not.be.reverted;
    });

    it("Fails when an unauthorized user tries to upgrade the contract", async () => {
      expect(
        await zns.accessController.hasRole(GOVERNOR_ROLE, deployer.address)
      ).to.be.true;

      const treasuryFactory = new ZNSTreasuryUpgradeMock__factory(deployer);
      const treasury = await treasuryFactory.deploy();
      await treasury.waitForDeployment();

      const deployTx = zns.treasury.connect(user).upgradeToAndCall(
        await treasury.getAddress(),
        "0x"
      );
      await expect(deployTx).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(user.address, GOVERNOR_ROLE);
    });

    it("Verifies that variable values are not changed in the upgrade process", async () => {
      const treasuryFactory = new ZNSTreasuryUpgradeMock__factory(deployer);
      const treasury = await treasuryFactory.deploy();
      await treasury.waitForDeployment();

      // Confirm deployer has the correct role first
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const newLabel = "world";
      const newHash = hashSubdomainName(newLabel);
      const { expectedPrice, stakeFee } = getPriceObject(newLabel, DEFAULT_PRICE_CONFIG);

      await zns.treasury.connect(mockRegistrar).stakeForDomain(
        ethers.ZeroHash,
        newHash,
        deployer.address,
        expectedPrice,
        BigInt(0),
        stakeFee
      );

      const calls = [
        treasury.registry(),
        treasury.getAccessController(),
        treasury.paymentConfigs(ethers.ZeroHash),
        treasury.stakedForDomain(newHash),
      ];

      await validateUpgrade(deployer, zns.treasury, treasury, treasuryFactory, calls);
    });
  });
});
