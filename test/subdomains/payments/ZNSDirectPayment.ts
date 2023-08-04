import * as hre from "hardhat";
import {
  ADMIN_ROLE,
  deployDirectPayment,
  deployZNS,
  getAccessRevertMsg, hashSubdomainName, NOT_AUTHORIZED_REG_ERR,
  priceConfigDefault, REGISTRAR_ROLE,
} from "../../helpers";
import { BigNumber, ethers } from "ethers";
import { registrationWithSetup } from "../../helpers/register-setup";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSContracts } from "../../helpers/types";
import { expect } from "chai";


describe("ZNSDirectPayment", () => {
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

    await zns.zeroToken.connect(user).approve(zns.treasury.address, ethers.constants.MaxUint256);
    await zns.zeroToken.mint(user.address, priceConfigDefault.maxPrice);

    subdomainPrice = ethers.utils.parseEther("2223");

    const fullConfig = {
      distrConfig: {
        pricingContract: zns.fixedPricing.address,
        paymentContract: zns.directPayment.address,
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

  it("should deploy with correct parameters", async () => {
    expect(await zns.directPayment.getAccessController()).to.equal(zns.accessController.address);
    expect(await zns.directPayment.registry()).to.equal(zns.registry.address);
  });

  it("should not allow to be deployed by anyone other than ADMIN_ROLE", async () => {
    await expect(
      deployDirectPayment({
        deployer: random,
        acAddress: zns.accessController.address,
        regAddress: zns.registry.address,
      }),
    ).to.be.revertedWith(
      getAccessRevertMsg(random.address, ADMIN_ROLE)
    );
  });

  describe("#processPayment()", () => {
    it("should not be callable by anyone other than the REGISTRAR_ROLE", async () => {
      await expect(
        zns.directPayment.connect(user).processPayment(
          domainHash,
          randomHash,
          user.address,
          subdomainPrice,
          BigNumber.from(0),
        ),
      ).to.be.revertedWith(
        getAccessRevertMsg(user.address, REGISTRAR_ROLE),
      );
    });

    // eslint-disable-next-line max-len
    it("should process payment correctly with fee if called by the REGISTRAR_ROLE and fire #PaymentProcessed event", async () => {
      const fee = ethers.utils.parseEther("19");

      await zns.zeroToken.mint(subUser.address, subdomainPrice.add(fee));
      await zns.zeroToken.connect(subUser).approve(zns.directPayment.address, subdomainPrice.add(fee));

      const subUserBalBefore = await zns.zeroToken.balanceOf(subUser.address);
      const parentBalBefore = await zns.zeroToken.balanceOf(user.address);

      const tx = await zns.directPayment.connect(mockRegistrar).processPayment(
        domainHash,
        randomHash,
        subUser.address,
        subdomainPrice,
        fee,
      );

      const subUserBalAfter = await zns.zeroToken.balanceOf(subUser.address);
      const parentBalAfter = await zns.zeroToken.balanceOf(user.address);

      expect(subUserBalBefore.sub(subUserBalAfter)).to.equal(subdomainPrice.add(fee));
      expect(parentBalAfter.sub(parentBalBefore)).to.equal(subdomainPrice.add(fee));

      await expect(tx).to.emit(zns.directPayment, "PaymentProcessed").withArgs(
        domainHash,
        randomHash,
        subUser.address,
        subdomainPrice,
        fee,
      );
    });

    // eslint-disable-next-line max-len
    it("should process payment correctly without fee if called by the REGISTRAR_ROLE and fire #PaymentProcessed event", async () => {
      const zero = "0";

      await zns.zeroToken.mint(subUser.address, subdomainPrice);
      await zns.zeroToken.connect(subUser).approve(zns.directPayment.address, subdomainPrice);

      const subUserBalBefore = await zns.zeroToken.balanceOf(subUser.address);
      const parentBalBefore = await zns.zeroToken.balanceOf(user.address);

      const tx = await zns.directPayment.connect(mockRegistrar).processPayment(
        domainHash,
        randomHash,
        subUser.address,
        subdomainPrice,
        zero,
      );

      const subUserBalAfter = await zns.zeroToken.balanceOf(subUser.address);
      const parentBalAfter = await zns.zeroToken.balanceOf(user.address);

      expect(subUserBalBefore.sub(subUserBalAfter)).to.equal(subdomainPrice);
      expect(parentBalAfter.sub(parentBalBefore)).to.equal(subdomainPrice);

      await expect(tx).to.emit(zns.directPayment, "PaymentProcessed").withArgs(
        domainHash,
        randomHash,
        subUser.address,
        subdomainPrice,
        zero,
      );
    });

    it("should not process payment if the payment token is set as 0x0", async () => {
      await zns.directPayment.connect(user).setPaymentToken(domainHash, ethers.constants.AddressZero);

      const subUserBalBefore = await zns.zeroToken.balanceOf(subUser.address);
      const parentBalBefore = await zns.zeroToken.balanceOf(user.address);

      const tx = await zns.directPayment.connect(mockRegistrar).processPayment(
        domainHash,
        randomHash,
        subUser.address,
        subdomainPrice,
        BigNumber.from(0),
      );

      const subUserBalAfter = await zns.zeroToken.balanceOf(subUser.address);
      const parentBalAfter = await zns.zeroToken.balanceOf(user.address);

      expect(subUserBalBefore).to.equal(subUserBalAfter);
      expect(parentBalBefore).to.equal(parentBalAfter);

      await expect(tx).to.not.emit(zns.directPayment, "PaymentProcessed");
    });
  });

  // eslint-disable-next-line max-len
  it("#setPaymentConfig() should set the correct config, emit #PaymentTokenChanged and #PaymentBeneficiaryChanged events, and #getPaymentConfig() should return it", async () => {
    const config = {
      paymentToken: random.address,
      beneficiary: random.address,
    };

    const tx = await zns.directPayment.connect(user).setPaymentConfig(domainHash, config);

    await expect(tx).to.emit(zns.directPayment, "PaymentTokenChanged").withArgs(
      domainHash,
      random.address,
    );
    await expect(tx).to.emit(zns.directPayment, "PaymentBeneficiaryChanged").withArgs(
      domainHash,
      random.address,
    );

    const {
      paymentToken,
      beneficiary,
    } = await zns.directPayment.getPaymentConfig(domainHash);

    expect(paymentToken).to.deep.equal(config.paymentToken);
    expect(beneficiary).to.deep.equal(config.beneficiary);
  });

  it("#setPaymentConfig() should not be callable by anyone other than domain owner", async () => {
    await expect(
      zns.directPayment.connect(subUser).setPaymentConfig(domainHash,
        {
          paymentToken: random.address,
          beneficiary: random.address,
        }
      ),
    ).to.be.revertedWith(NOT_AUTHORIZED_REG_ERR);
  });

  it("#setPaymentToken() should set the new token correctly and emit #PaymentTokenChanged event", async () => {
    const tx = await zns.directPayment.connect(user).setPaymentToken(domainHash, random.address);

    await expect(tx).to.emit(zns.directPayment, "PaymentTokenChanged").withArgs(
      domainHash,
      random.address,
    );

    const { paymentToken } = await zns.directPayment.getPaymentConfig(domainHash);

    expect(paymentToken).to.equal(random.address);
  });

  // eslint-disable-next-line max-len
  it("#setPaymentBeneficiary() should set the new beneficiary correctly and emit #PaymentBeneficiaryChanged event", async () => {
    const tx = await zns.directPayment.connect(user).setPaymentBeneficiary(domainHash, random.address);

    await expect(tx).to.emit(zns.directPayment, "PaymentBeneficiaryChanged").withArgs(
      domainHash,
      random.address,
    );

    const { beneficiary } = await zns.directPayment.getPaymentConfig(domainHash);

    expect(beneficiary).to.equal(random.address);
  });

  it("#setRegistry() should set the new registry correctly and emit #RegistrySet event", async () => {
    const tx = await zns.directPayment.connect(admin).setRegistry(random.address);

    await expect(tx).to.emit(zns.directPayment, "RegistrySet").withArgs(random.address);

    expect(await zns.directPayment.registry()).to.equal(random.address);
  });

  it("#setRegistry() should not be callable by anyone other than ADMIN_ROLE", async () => {
    await expect(
      zns.directPayment.connect(user).setRegistry(random.address),
    ).to.be.revertedWith(
      getAccessRevertMsg(user.address, ADMIN_ROLE),
    );
  });

  // eslint-disable-next-line max-len
  it("#setAccessController() should set the new access controller correctly and emit #AccessControllerSet event", async () => {
    const tx = await zns.directPayment.connect(admin).setAccessController(random.address);

    await expect(tx).to.emit(zns.directPayment, "AccessControllerSet").withArgs(random.address);

    expect(await zns.directPayment.getAccessController()).to.equal(random.address);
  });

  it("#setAccessController() should not be callable by anyone other than ADMIN_ROLE", async () => {
    await expect(
      zns.directPayment.connect(user).setAccessController(random.address),
    ).to.be.revertedWith(
      getAccessRevertMsg(user.address, ADMIN_ROLE),
    );
  });

  it("#getAccessController() should return the correct access controller", async () => {
    expect(
      await zns.directPayment.getAccessController()
    ).to.equal(zns.accessController.address);
  });
});
