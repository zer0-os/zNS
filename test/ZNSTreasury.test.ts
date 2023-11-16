import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  checkBalance, DEFAULT_TOKEN_URI, deployTreasury,
  deployZNS,
  distrConfigEmpty,
  getPriceObject,
  NO_BENEFICIARY_ERR,
  NOT_AUTHORIZED_REG_WIRED_ERR,
  INITIALIZED_ERR,
  DEFAULT_PRICE_CONFIG,
  validateUpgrade,
} from "./helpers";
import { DeployZNSParams, IZNSContracts } from "./helpers/types";
import * as ethers from "ethers";
import { hashDomainLabel, hashSubdomainName } from "./helpers/hashing";
import { ADMIN_ROLE, REGISTRAR_ROLE, GOVERNOR_ROLE } from "../src/deploy/constants";
import { getAccessRevertMsg } from "./helpers/errors";
import { ZNSTreasury__factory, ZNSTreasuryUpgradeMock__factory } from "../typechain";
import { parseEther } from "ethers/lib/utils";
import { getProxyImplAddress } from "./helpers/utils";

require("@nomicfoundation/hardhat-chai-matchers");


describe("ZNSTreasury", () => {
  let deployer : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let user : SignerWithAddress;
  let zeroVault : SignerWithAddress;
  let mockRegistrar : SignerWithAddress;
  let randomAcc : SignerWithAddress;
  let zns : IZNSContracts;

  const domainName = "wilderrr";
  const domainHash = hashDomainLabel(domainName);

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

    // give REGISTRAR_ROLE to a wallet address to be calling guarded functions
    await zns.accessController.connect(admin).grantRole(REGISTRAR_ROLE, mockRegistrar.address);

    // Give funds to user
    await zns.meowToken.connect(user).approve(zns.treasury.address, ethers.constants.MaxUint256);
    await zns.meowToken.mint(user.address, ethers.utils.parseEther("50000"));

    // register random domain
    await zns.rootRegistrar.connect(user).registerRootDomain(
      domainName,
      user.address,
      DEFAULT_TOKEN_URI,
      distrConfigEmpty
    );
  });

  it("Should initialize correctly", async () => {
    const registry = await zns.treasury.registry();
    const {
      token,
      beneficiary,
    } = await zns.treasury.paymentConfigs(ethers.constants.HashZero);
    const accessController = await zns.treasury.getAccessController();

    expect(registry).to.eq(zns.registry.address);
    expect(token).to.eq(zns.meowToken.address);
    expect(beneficiary).to.eq(zns.zeroVaultAddress);
    expect(accessController).to.eq(zns.accessController.address);
  });

  it("should NOT initialize twice", async () => {
    const tx = zns.treasury.initialize(
      zns.registry.address,
      zns.meowToken.address,
      zns.zeroVaultAddress,
      zns.accessController.address
    );
    await expect(tx).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("Should NOT let initialize the implementation contract", async () => {
    const factory = new ZNSTreasury__factory(deployer);
    const impl = await getProxyImplAddress(zns.treasury.address);
    const implContract = factory.attach(impl);

    await expect(
      implContract.initialize(
        zns.registry.address,
        zns.meowToken.address,
        zns.zeroVaultAddress,
        zns.accessController.address
      )
    ).to.be.revertedWith(INITIALIZED_ERR);
  });

  it("should NOT deploy/initialize with 0x0 addresses as args", async () => {
    const args = {
      deployer,
      accessControllerAddress: zns.accessController.address,
      registryAddress: zns.registry.address,
      zTokenMockAddress: zns.meowToken.address,
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
              [key]: ethers.constants.AddressZero,
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
        ethers.constants.HashZero,
        domainName,
        false
      );
      const fee = await zns.curvePricer.getFeeForPrice(ethers.constants.HashZero, expectedStake);

      await zns.treasury.connect(mockRegistrar).stakeForDomain(
        ethers.constants.HashZero,
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
        target: stake.add(fee),
        shouldDecrease: true,
      });

      const zeroVaultBalanceAfterStake = await zns.meowToken.balanceOf(zeroVault.address);
      expect(zeroVaultBalanceAfterStake).to.eq(zeroVaultBalanceBeforeStake.add(fee));
    });

    it("Should revert if called from an address without REGISTRAR_ROLE", async () => {
      await expect(
        zns.treasury.connect(randomAcc).stakeForDomain(
          ethers.constants.HashZero,
          domainHash,
          user.address,
          ethers.constants.Zero,
          ethers.constants.Zero,
          ethers.constants.Zero
        )
      ).to.be.revertedWith(
        getAccessRevertMsg(randomAcc.address, REGISTRAR_ROLE)
      );
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
        ethers.constants.HashZero,
        domainHash,
        user.address,
        expectedPrice,
        ethers.constants.Zero,
        protocolFee
      );

      await expect(tx)
        .to.emit(zns.treasury, "StakeDeposited")
        .withArgs(
          ethers.constants.HashZero,
          domainHash,
          user.address,
          zns.meowToken.address,
          expectedPrice,
          ethers.constants.Zero,
          protocolFee
        );
    });
  });

  describe("#unstakeForDomain()", () => {
    it("Unstakes the correct amount and saves the correct token", async () => {
      const stakeAmt = ethers.utils.parseEther("173");
      const protocolFee = ethers.utils.parseEther("3.112");

      await zns.treasury.connect(mockRegistrar).stakeForDomain(
        ethers.constants.HashZero,
        domainHash,
        user.address,
        stakeAmt,
        ethers.constants.Zero,
        protocolFee
      );

      const balanceBeforeUnstake = await zns.meowToken.balanceOf(user.address);
      const { token, amount: stake } = await zns.treasury.stakedForDomain(domainHash);

      await zns.treasury.connect(mockRegistrar).unstakeForDomain(domainHash, user.address);

      await checkBalance({
        token: zns.meowToken,
        balanceBefore: balanceBeforeUnstake,
        userAddress: user.address,
        target: stake,
        shouldDecrease: false,
      });
      expect(token).to.eq(zns.meowToken.address);
    });

    it("Should revert if called from an address without REGISTRAR_ROLE", async () => {
      await expect(
        zns.treasury.connect(user).unstakeForDomain(
          domainHash,
          user.address
        )
      ).to.be.revertedWith(
        getAccessRevertMsg(user.address, REGISTRAR_ROLE)
      );
    });
  });

  describe("#processDirectPayment()", () => {
    it("should process payment correctly with paymentConfig set", async () => {
      const randomHash = hashDomainLabel("randommmmmmmm2342342");
      const config = {
        token: zns.meowToken.address,
        beneficiary: user.address,
      };

      await zns.registry.connect(mockRegistrar).createDomainRecord(
        randomHash,
        user.address,
        ethers.constants.AddressZero,
      );

      await zns.treasury.connect(user).setPaymentConfig(
        randomHash,
        config
      );

      const paymentAmt = parseEther("1000");
      const protocolFee = parseEther("10");
      // give tokens to mock registrar
      await zns.meowToken.connect(user).transfer(mockRegistrar.address, paymentAmt.add(protocolFee));
      await zns.meowToken.connect(mockRegistrar).approve(zns.treasury.address, paymentAmt.add(protocolFee));

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

      expect(userBalanceAfter.sub(userBalanceBefore)).to.eq(paymentAmt);
      expect(payerBalanceBefore.sub(payerBalanceAfter)).to.eq(paymentAmt.add(protocolFee));
      expect(zeroVaultBalanceAfter.sub(zeroVaultBalanceBefore)).to.eq(protocolFee);
    });

    it("should revert if paymentConfig not set", async () => {
      const randomHash = hashDomainLabel("randommmmmmmm2342342");

      const {
        token,
        beneficiary,
      } = await zns.treasury.paymentConfigs(randomHash);
      expect(token).to.eq(ethers.constants.AddressZero);
      expect(beneficiary).to.eq(ethers.constants.AddressZero);

      const paymentAmt = parseEther("100");
      const protocolFee = parseEther("7");

      await expect(
        zns.treasury.connect(mockRegistrar).processDirectPayment(
          randomHash,
          domainHash,
          mockRegistrar.address,
          paymentAmt,
          protocolFee
        )
      ).to.be.revertedWith(NO_BENEFICIARY_ERR);
    });

    it("should revert if called by anyone other than REGISTRAR_ROLE", async () => {
      await expect(
        zns.treasury.connect(randomAcc).processDirectPayment(
          ethers.constants.HashZero,
          domainHash,
          mockRegistrar.address,
          "0",
          "0"
        )
      ).to.be.revertedWith(
        getAccessRevertMsg(randomAcc.address, REGISTRAR_ROLE)
      );
    });

    it("should emit DirectPaymentProcessed event with correct params", async () => {
      const paymentAmt = parseEther("100");
      const protocolFee = parseEther("7");
      // give tokens to mock registrar
      await zns.meowToken.connect(user).transfer(mockRegistrar.address, paymentAmt.add(protocolFee));
      await zns.meowToken.connect(mockRegistrar).approve(zns.treasury.address, paymentAmt.add(protocolFee));

      await expect(
        zns.treasury.connect(mockRegistrar).processDirectPayment(
          ethers.constants.HashZero,
          domainHash,
          mockRegistrar.address,
          paymentAmt,
          protocolFee
        )
      ).to.emit(zns.treasury, "DirectPaymentProcessed").withArgs(
        ethers.constants.HashZero,
        domainHash,
        mockRegistrar.address,
        zeroVault.address,
        paymentAmt,
        protocolFee
      );
    });
  });

  describe("#setPaymentConfig(), BeneficiarySet and PaymentTokenSet", () => {
    it("should re-set payment config for an existing subdomain", async () => {
      const {
        token: paymentTokenBefore,
        beneficiary: beneficiaryBefore,
      } = await zns.treasury.paymentConfigs(domainHash);
      expect(paymentTokenBefore).to.eq(ethers.constants.AddressZero);
      expect(beneficiaryBefore).to.eq(ethers.constants.AddressZero);

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
        zns.treasury.connect(randomAcc).setPaymentConfig(
          domainHash,
          configToSet,
        )
      ).to.be.revertedWith(
        NOT_AUTHORIZED_REG_WIRED_ERR
      );
    });

    it("should NOT set token or beneficiary to 0x0 address", async () => {
      const zeroBeneficiaryConf = {
        beneficiary: ethers.constants.AddressZero,
        token: randomAcc.address,
      };

      await expect(
        zns.treasury.connect(user).setPaymentConfig(
          domainHash,
          zeroBeneficiaryConf
        )
      ).to.be.revertedWith(
        "ZNSTreasury: beneficiary passed as 0x0 address"
      );

      const meowTokenConf = {
        token: ethers.constants.AddressZero,
        beneficiary: randomAcc.address,
      };

      await expect(
        zns.treasury.connect(user).setPaymentConfig(
          domainHash,
          meowTokenConf
        )
      ).to.be.revertedWith(
        "ZNSTreasury: paymentToken passed as 0x0 address"
      );
    });
  });

  describe("#setBeneficiary() and BeneficiarySet event", () => {
    it("Should set the correct address of Zero Vault", async () => {
      const {
        beneficiary: currentZeroVault,
      } = await zns.treasury.paymentConfigs(ethers.constants.HashZero);
      expect(currentZeroVault).to.not.eq(mockRegistrar.address);

      const tx = await zns.treasury.setBeneficiary(
        ethers.constants.HashZero,
        mockRegistrar.address
      );

      const { beneficiary: newZeroVault } = await zns.treasury.paymentConfigs(ethers.constants.HashZero);
      expect(newZeroVault).to.eq(mockRegistrar.address);

      await expect(tx).to.emit(zns.treasury, "BeneficiarySet").withArgs(
        ethers.constants.HashZero,
        mockRegistrar.address
      );
    });

    it("Should revert when called by anyone other than owner or operator", async () => {
      const tx = zns.treasury.connect(randomAcc).setBeneficiary(
        ethers.constants.HashZero,
        mockRegistrar.address
      );
      await expect(tx).to.be.revertedWith(
        NOT_AUTHORIZED_REG_WIRED_ERR
      );
    });

    it("Should revert when beneficiary is address 0", async () => {
      const tx = zns.treasury.setBeneficiary(
        ethers.constants.HashZero,
        ethers.constants.AddressZero
      );
      await expect(tx).to.be.revertedWith("ZNSTreasury: beneficiary passed as 0x0 address");
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
      await expect(tx).to.be.revertedWith(
        NOT_AUTHORIZED_REG_WIRED_ERR
      );
    });

    it("Should revert when paymentToken is address 0", async () => {
      const tx = zns.treasury.connect(user).setPaymentToken(domainHash, ethers.constants.AddressZero);
      await expect(tx).to.be.revertedWith("ZNSTreasury: paymentToken passed as 0x0 address");
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
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });

    it("Should revert when accessController is address 0", async () => {
      const tx = zns.treasury.setAccessController(ethers.constants.AddressZero);
      await expect(tx).to.be.revertedWith("AC: _accessController is 0x0 address");
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
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });

    it("Should revert when registry is address 0", async () => {
      const tx = zns.treasury.setRegistry(ethers.constants.AddressZero);
      await expect(tx).to.be.revertedWith("ARegistryWired: _registry can not be 0x0 address");
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
      await treasury.deployed();

      await expect(zns.treasury.connect(deployer).upgradeTo(treasury.address)).to.not.be.reverted;
    });

    it("Fails when an unauthorized user tries to upgrade the contract", async () => {
      expect(
        await zns.accessController.hasRole(GOVERNOR_ROLE, deployer.address)
      ).to.be.true;

      const treasuryFactory = new ZNSTreasuryUpgradeMock__factory(deployer);
      const treasury = await treasuryFactory.deploy();
      await treasury.deployed();

      const deployTx = zns.treasury.connect(user).upgradeTo(treasury.address);
      await expect(deployTx).to.be.revertedWith(getAccessRevertMsg(user.address, GOVERNOR_ROLE));
    });

    it("Verifies that variable values are not changed in the upgrade process", async () => {
      const treasuryFactory = new ZNSTreasuryUpgradeMock__factory(deployer);
      const treasury = await treasuryFactory.deploy();
      await treasury.deployed();

      // Confirm deployer has the correct role first
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const newLabel = "world";
      const newHash = hashSubdomainName(newLabel);
      const { expectedPrice, stakeFee } = getPriceObject(newLabel, DEFAULT_PRICE_CONFIG);

      await zns.treasury.connect(mockRegistrar).stakeForDomain(
        ethers.constants.HashZero,
        newHash,
        deployer.address,
        expectedPrice,
        ethers.constants.Zero,
        stakeFee
      );

      const calls = [
        treasury.registry(),
        treasury.getAccessController(),
        treasury.paymentConfigs(ethers.constants.HashZero),
        treasury.stakedForDomain(newHash),
      ];

      await validateUpgrade(deployer, zns.treasury, treasury, treasuryFactory, calls);
    });
  });
});
