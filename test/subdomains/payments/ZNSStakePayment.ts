import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSContracts } from "../../helpers/types";
import { BigNumber, ethers } from "ethers";
import {
  ADMIN_ROLE,
  checkBalance, deployStakePayment,
  deployZNS, getAccessRevertMsg,
  hashSubdomainName, NOT_AUTHORIZED_REG_ERR,
  priceConfigDefault,
  REGISTRAR_ROLE,
} from "../../helpers";
import * as hre from "hardhat";
import { registrationWithSetup } from "../../helpers/register-setup";
import { expect } from "chai";


describe("ZNSStakePayment", () => {
  let deployer : SignerWithAddress;
  let user : SignerWithAddress;
  let subUser : SignerWithAddress;
  let admin : SignerWithAddress;
  let random : SignerWithAddress;
  let mockRegistrar : SignerWithAddress;

  let zns : ZNSContracts;
  let domainHash : string;
  let subdomainPrice : BigNumber;

  const randomHash = hashSubdomainName("random");
  const subFee = ethers.utils.parseEther("11");

  beforeEach(async () => {
    [
      deployer,
      user,
      subUser,
      admin,
      random,
      mockRegistrar,
    ] = await hre.ethers.getSigners();

    zns = await deployZNS({
      deployer,
      governorAddresses: [deployer.address],
      adminAddresses: [admin.address],
    });

    subdomainPrice = ethers.utils.parseEther("2223");

    await zns.zeroToken.connect(user).approve(zns.treasury.address, ethers.constants.MaxUint256);
    await zns.zeroToken.mint(user.address, priceConfigDefault.maxPrice);
    await zns.zeroToken.mint(subUser.address, subdomainPrice.add(subFee));
    await zns.zeroToken.connect(subUser).approve(zns.stakePayment.address, subdomainPrice.add(subFee));

    const fullConfig = {
      distrConfig: {
        pricingContract: zns.fixedPricing.address,
        paymentContract: zns.stakePayment.address,
        accessType: 1,
      },
      priceConfig: subdomainPrice,
      paymentConfig: {
        paymentToken: zns.zeroToken.address,
        beneficiary: user.address,
      },
    };

    domainHash = await registrationWithSetup({
      zns,
      user,
      domainLabel: "testdomain",
      fullConfig,
      isRootDomain: true,
    });

    await zns.accessController.connect(admin).grantRole(REGISTRAR_ROLE, mockRegistrar.address);
  });

  it("should deploy with correct state", async () => {
    const registry = await zns.stakePayment.registry();
    const accessController = await zns.stakePayment.getAccessController();

    expect(registry).to.eq(zns.registry.address);
    expect(accessController).to.eq(zns.accessController.address);
  });

  it("should not allow to be deployed by anyone other than ADMIN_ROLE", async () => {
    await expect(
      deployStakePayment({
        deployer: random,
        acAddress: zns.accessController.address,
        regAddress: zns.registry.address,
      })
    ).to.be.revertedWith(
      getAccessRevertMsg(random.address, ADMIN_ROLE)
    );
  });


  describe("#processPayment()", () => {
    it("should stake the correct amount and fire #PaymentProcessed event", async () => {
      const balanceBeforeStake = await zns.zeroToken.balanceOf(subUser.address);
      const parentBalanceBefore = await zns.zeroToken.balanceOf(user.address);
      const contractBalanceBefore = await zns.zeroToken.balanceOf(zns.stakePayment.address);

      const tx = await zns.stakePayment.connect(mockRegistrar).processPayment(
        domainHash,
        randomHash,
        subUser.address,
        subdomainPrice,
        subFee
      );

      const stake = await zns.stakePayment.stakedForDomain(randomHash);
      expect(stake).to.eq(subdomainPrice);

      await checkBalance({
        token: zns.zeroToken,
        balanceBefore: balanceBeforeStake,
        userAddress: subUser.address,
        target: stake.add(subFee),
        shouldDecrease: true,
      });

      const contractBalanceAfter = await zns.zeroToken.balanceOf(zns.stakePayment.address);
      const parentBalanceAfter = await zns.zeroToken.balanceOf(user.address);

      expect(parentBalanceAfter).to.eq(parentBalanceBefore.add(subFee));
      expect(contractBalanceAfter).to.eq(contractBalanceBefore.add(subdomainPrice));

      await expect(tx).to.emit(zns.stakePayment, "PaymentProcessed").withArgs(
        domainHash,
        randomHash,
        subUser.address,
        subdomainPrice,
        subFee
      );
    });

    it("Should revert if called from an address without REGISTRAR_ROLE", async () => {
      const tx = zns.stakePayment.connect(random).processPayment(
        domainHash,
        randomHash,
        subUser.address,
        subdomainPrice,
        subFee
      );

      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(random.address, REGISTRAR_ROLE)
      );
    });

    it("should not process payment if paymentToken is set to 0x0", async () => {
      await zns.stakePayment.connect(user).setPaymentToken(domainHash, ethers.constants.AddressZero);

      const subUserBalBefore = await zns.zeroToken.balanceOf(subUser.address);
      const parentBalBefore = await zns.zeroToken.balanceOf(user.address);

      const tx = await zns.stakePayment.connect(mockRegistrar).processPayment(
        domainHash,
        randomHash,
        subUser.address,
        subdomainPrice,
        subFee
      );

      const subUserBalAfter = await zns.zeroToken.balanceOf(subUser.address);
      const parentBalAfter = await zns.zeroToken.balanceOf(user.address);

      expect(subUserBalBefore).to.equal(subUserBalAfter);
      expect(parentBalBefore).to.equal(parentBalAfter);

      await expect(tx).to.not.emit(zns.stakePayment, "PaymentProcessed");
    });
  });

  describe("#refund()", () => {
    it("should unstake the correct amount, fire #RefundProcessed event and clear state mapping entry", async () => {
      await zns.stakePayment.connect(mockRegistrar).processPayment(
        domainHash,
        randomHash,
        subUser.address,
        subdomainPrice,
        subFee
      );

      const userBalanceBeforeUnstake = await zns.zeroToken.balanceOf(subUser.address);
      const contractBalanceBeforeUnstake = await zns.zeroToken.balanceOf(zns.stakePayment.address);

      const stake = await zns.stakePayment.stakedForDomain(randomHash);
      expect(stake).to.eq(subdomainPrice);

      const tx = await zns.stakePayment.connect(mockRegistrar).refund(
        domainHash,
        randomHash,
        subUser.address,
      );

      await expect(tx).to.emit(zns.stakePayment, "RefundProcessed").withArgs(
        domainHash,
        randomHash,
        subUser.address,
        subdomainPrice,
      );

      await checkBalance({
        token: zns.zeroToken,
        balanceBefore: userBalanceBeforeUnstake,
        userAddress: subUser.address,
        target: subdomainPrice,
        shouldDecrease: false,
      });

      const contractBalanceAfterUnstake = await zns.zeroToken.balanceOf(zns.stakePayment.address);
      expect(contractBalanceAfterUnstake).to.eq(contractBalanceBeforeUnstake.sub(subdomainPrice));

      const stakeAfter = await zns.stakePayment.stakedForDomain(randomHash);
      expect(stakeAfter).to.eq(BigNumber.from(0));
    });

    it("should revert if called from an address without REGISTRAR_ROLE", async () => {
      const tx = zns.stakePayment.connect(random).refund(
        domainHash,
        randomHash,
        subUser.address,
      );

      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(random.address, REGISTRAR_ROLE)
      );
    });

    it("should not refund if nothing was staked", async () => {
      const subUserBalBefore = await zns.zeroToken.balanceOf(subUser.address);
      const parentBalBefore = await zns.zeroToken.balanceOf(user.address);

      const tx = await zns.stakePayment.connect(mockRegistrar).refund(
        domainHash,
        randomHash,
        subUser.address,
      );

      const subUserBalAfter = await zns.zeroToken.balanceOf(subUser.address);
      const parentBalAfter = await zns.zeroToken.balanceOf(user.address);

      expect(subUserBalBefore).to.equal(subUserBalAfter);
      expect(parentBalBefore).to.equal(parentBalAfter);

      await expect(tx).to.not.emit(zns.stakePayment, "RefundProcessed");
    });
  });

  // eslint-disable-next-line max-len
  it("#setPaymentConfig() should set the correct config, emit #PaymentTokenChanged and #PaymentBeneficiaryChanged events, and #getPaymentConfig() should return it", async () => {
    const config = {
      paymentToken: random.address,
      beneficiary: random.address,
    };

    const tx = await zns.stakePayment.connect(user).setPaymentConfig(domainHash, config);

    await expect(tx).to.emit(zns.stakePayment, "PaymentTokenChanged").withArgs(
      domainHash,
      random.address,
    );
    await expect(tx).to.emit(zns.stakePayment, "PaymentBeneficiaryChanged").withArgs(
      domainHash,
      random.address,
    );

    const {
      paymentToken,
      beneficiary,
    } = await zns.stakePayment.getPaymentConfig(domainHash);

    expect(paymentToken).to.deep.equal(config.paymentToken);
    expect(beneficiary).to.deep.equal(config.beneficiary);
  });

  it("#setPaymentConfig() should not be callable by anyone other than domain owner", async () => {
    await expect(
      zns.stakePayment.connect(subUser).setPaymentConfig(domainHash,
        {
          paymentToken: random.address,
          beneficiary: random.address,
        }
      ),
    ).to.be.revertedWith(NOT_AUTHORIZED_REG_ERR);
  });

  it("#setPaymentToken() should set the new token correctly and emit #PaymentTokenChanged event", async () => {
    const tx = await zns.stakePayment.connect(user).setPaymentToken(domainHash, random.address);

    await expect(tx).to.emit(zns.stakePayment, "PaymentTokenChanged").withArgs(
      domainHash,
      random.address,
    );

    const { paymentToken } = await zns.stakePayment.getPaymentConfig(domainHash);

    expect(paymentToken).to.equal(random.address);
  });

  // eslint-disable-next-line max-len
  it("#setBeneficiary() should set the new beneficiary correctly and emit #PaymentBeneficiaryChanged event", async () => {
    const tx = await zns.stakePayment.connect(user).setBeneficiary(domainHash, random.address);

    await expect(tx).to.emit(zns.stakePayment, "PaymentBeneficiaryChanged").withArgs(
      domainHash,
      random.address,
    );

    const { beneficiary } = await zns.stakePayment.getPaymentConfig(domainHash);

    expect(beneficiary).to.equal(random.address);
  });

  it("#setRegistry() should set the new registry correctly and emit #RegistrySet event", async () => {
    const tx = await zns.stakePayment.connect(admin).setRegistry(random.address);

    await expect(tx).to.emit(zns.stakePayment, "RegistrySet").withArgs(random.address);

    expect(await zns.stakePayment.registry()).to.equal(random.address);
  });

  it("#setRegistry() should not be callable by anyone other than ADMIN_ROLE", async () => {
    await expect(
      zns.stakePayment.connect(user).setRegistry(random.address),
    ).to.be.revertedWith(
      getAccessRevertMsg(user.address, ADMIN_ROLE),
    );
  });

  // eslint-disable-next-line max-len
  it("#setAccessController() should set the new access controller correctly and emit #AccessControllerSet event", async () => {
    const tx = await zns.stakePayment.connect(admin).setAccessController(random.address);

    await expect(tx).to.emit(zns.stakePayment, "AccessControllerSet").withArgs(random.address);

    expect(await zns.stakePayment.getAccessController()).to.equal(random.address);
  });

  it("#setAccessController() should not be callable by anyone other than ADMIN_ROLE", async () => {
    await expect(
      zns.stakePayment.connect(user).setAccessController(random.address),
    ).to.be.revertedWith(
      getAccessRevertMsg(user.address, ADMIN_ROLE),
    );
  });

  it("#getAccessController() should return the correct access controller", async () => {
    expect(
      await zns.stakePayment.getAccessController()
    ).to.equal(zns.accessController.address);
  });
});
