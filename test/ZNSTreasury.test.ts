import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  checkBalance,
  deployZNS,
  distrConfigEmpty,
  getPriceObject,
  PaymentType,
  priceConfigDefault,
  validateUpgrade,
} from "./helpers";
import { DeployZNSParams, ZNSContracts } from "./helpers/types";
import * as ethers from "ethers";
import { hashDomainLabel, hashSubdomainName } from "./helpers/hashing";
import { ADMIN_ROLE, REGISTRAR_ROLE, GOVERNOR_ROLE } from "./helpers/access";
import { getAccessRevertMsg } from "./helpers/errors";
import { ZNSTreasuryUpgradeMock__factory } from "../typechain";

require("@nomicfoundation/hardhat-chai-matchers");

describe("ZNSTreasury", () => {
  let deployer : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let user : SignerWithAddress;
  let zeroVault : SignerWithAddress;
  let mockRegistrar : SignerWithAddress;
  let randomAcc : SignerWithAddress;
  let zns : ZNSContracts;

  const domainName = "wilderrr";
  const domainHash = ethers.utils.keccak256(ethers.utils.randomBytes(32));

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
    await zns.zeroToken.connect(user).approve(zns.treasury.address, ethers.constants.MaxUint256);
    await zns.zeroToken.mint(user.address, ethers.utils.parseEther("50000"));

    // register random domain
    await zns.registrar.connect(user).registerDomain(
      domainName,
      user.address,
      distrConfigEmpty
    );

    it("Should initialize correctly", async () => {
      const registry = await zns.treasury.registry();
      const {
        token,
        beneficiary,
      } = await zns.treasury.paymentConfigs(ethers.constants.HashZero);
      const accessController = await zns.treasury.getAccessController();

      expect(registry).to.eq(zns.registry.address);
      expect(token).to.eq(zns.zeroToken.address);
      expect(beneficiary).to.eq(zns.zeroVaultAddress);
      expect(accessController).to.eq(zns.accessController.address);
    });

    describe("#stakeForDomain", () => {
      it("Stakes the correct amount", async () => {
        const domain = "wilder";
        const domainHash = hashDomainLabel(domain);

        const balanceBeforeStake = await zns.zeroToken.balanceOf(user.address);
        const zeroVaultBalanceBeforeStake = await zns.zeroToken.balanceOf(zeroVault.address);

        const expectedStake = await zns.priceOracle.getPrice(
          ethers.constants.HashZero,
          domain
        );
        const fee = await zns.priceOracle.getProtocolFee(expectedStake);

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
          token: zns.zeroToken,
          balanceBefore: balanceBeforeStake,
          userAddress: user.address,
          target: stake.add(fee),
          shouldDecrease: true,
        });

        const zeroVaultBalanceAfterStake = await zns.zeroToken.balanceOf(zeroVault.address);
        expect(zeroVaultBalanceAfterStake).to.eq(zeroVaultBalanceBeforeStake.add(fee));
      });

      it("Should revert if called from an address without REGISTRAR_ROLE", async () => {
        const domain = "wilder";
        const domainHash = hashDomainLabel(domain);

        const tx = zns.treasury.connect(randomAcc).stakeForDomain(
          ethers.constants.HashZero,
          domainHash,
          user.address,
          ethers.constants.Zero,
          ethers.constants.Zero,
          ethers.constants.Zero
        );

        await expect(tx).to.be.revertedWith(
          getAccessRevertMsg(randomAcc.address, REGISTRAR_ROLE)
        );
      });

      it("Should fire StakeDeposited event with correct params", async () => {
        const domain = "wilder";
        const domainHash = hashDomainLabel(domain);

        const {
          expectedPrice,
          stakeFee: protocolFee,
        } = getPriceObject(
          domain,
          priceConfigDefault
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
            zns.zeroToken.address,
            expectedPrice,
            ethers.constants.Zero,
            protocolFee
          );
      });
    });

    describe("#unstakeForDomain", () => {
      it("Unstakes the correct amount and saves the correct token", async () => {
        const domain = "wilder";
        const domainHash = hashDomainLabel(domain);
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

        const balanceBeforeUnstake = await zns.zeroToken.balanceOf(user.address);
        const { token, amount: stake } = await zns.treasury.stakedForDomain(domainHash);

        await zns.treasury.connect(mockRegistrar).unstakeForDomain(domainHash, user.address);

        await checkBalance({
          token: zns.zeroToken,
          balanceBefore: balanceBeforeUnstake,
          userAddress: user.address,
          target: stake,
          shouldDecrease: false,
        });
        expect(token).to.eq(zns.zeroToken.address);
      });

      it("Should revert if called from an address without REGISTRAR_ROLE", async () => {
        const domain = "wilder";
        const domainHash = hashDomainLabel(domain);

        const tx = zns.treasury.connect(user).unstakeForDomain(
          domainHash,
          user.address
        );

        await expect(tx).to.be.revertedWith(
          getAccessRevertMsg(user.address, REGISTRAR_ROLE)
        );
      });
    });

    // TODO sub data: adapt these tests brought from SubRegistrar test and add more tests!
    // describe("#setPaymentConfig() and ", () => {
    //   it("#setPaymentConfigForDomain() should re-set payment config for an existing subdomain", async () => {
    //     const domainHash = regResults[1].domainHash;
    //
    //     const paymentContractBefore = await zns.subdomainRegistrar.distrConfigs(domainHash);
    //     expect(
    //       paymentContractBefore.paymentConfig.paymentType
    //     ).to.eq(
    //       domainConfigs[1].fullConfig.distrConfig.paymentConfig.paymentType
    //     );
    //     expect(
    //       paymentContractBefore.paymentConfig.token
    //     ).to.eq(
    //       domainConfigs[1].fullConfig.distrConfig.paymentConfig.token
    //     );
    //     expect(
    //       paymentContractBefore.paymentConfig.beneficiary
    //     ).to.eq(
    //       domainConfigs[1].fullConfig.distrConfig.paymentConfig.beneficiary
    //     );
    //
    //     const configToSet = {
    //       paymentType: PaymentType.STAKE,
    //       token: lvl2SubOwner.address,
    //       beneficiary: lvl2SubOwner.address,
    //     };
    //
    //     await zns.subdomainRegistrar.connect(lvl2SubOwner).setPaymentConfigForDomain(
    //       domainHash,
    //       configToSet,
    //     );
    //
    //     const paymentContractAfter = await zns.subdomainRegistrar.distrConfigs(domainHash);
    //     expect(paymentContractAfter.paymentConfig.paymentType).to.eq(configToSet.paymentType);
    //     expect(paymentContractAfter.paymentConfig.token).to.eq(configToSet.token);
    //     expect(paymentContractAfter.paymentConfig.beneficiary).to.eq(configToSet.beneficiary);
    //
    //     // reset it back
    //     await zns.subdomainRegistrar.connect(lvl2SubOwner).setPaymentConfigForDomain(
    //       domainHash,
    //       domainConfigs[1].fullConfig.distrConfig.paymentConfig,
    //     );
    //   });
    //
    //   it("#setPaymentConfigForDomain() should NOT allow setting for non-authorized account", async () => {
    //     const domainHash = regResults[1].domainHash;
    //
    //     const configToSet = {
    //       paymentType: PaymentType.STAKE,
    //       token: lvl3SubOwner.address,
    //       beneficiary: lvl3SubOwner.address,
    //     };
    //
    //     await expect(
    //       zns.subdomainRegistrar.connect(lvl3SubOwner).setPaymentConfigForDomain(
    //         domainHash,
    //         configToSet,
    //       )
    //     ).to.be.revertedWith(
    //       "ZNSSubdomainRegistrar: Not authorized"
    //     );
    //   });
    //
    //   it("#setPaymentConfigForDomain() should NOT set token or beneficiary to 0x0 address", async () => {
    //     const domainHash = regResults[1].domainHash;
    //     const zeroTokenConfig = {
    //       paymentType: PaymentType.STAKE,
    //       token: ethers.constants.AddressZero,
    //       beneficiary: lvl2SubOwner.address,
    //     };
    //
    //     await expect(
    //       zns.subdomainRegistrar.connect(lvl2SubOwner).setPaymentConfigForDomain(
    //         domainHash,
    //         zeroTokenConfig
    //       )
    //     ).to.be.revertedWith(
    //       "ZNSSubdomainRegistrar: token can not be 0x0 address"
    //     );
    //
    //     const zeroBeneficiaryConfig = {
    //       paymentType: PaymentType.STAKE,
    //       token: lvl2SubOwner.address,
    //       beneficiary: ethers.constants.AddressZero,
    //     };
    //
    //     await expect(
    //       zns.subdomainRegistrar.connect(lvl2SubOwner).setPaymentConfigForDomain(
    //         domainHash,
    //         zeroBeneficiaryConfig
    //       )
    //     ).to.be.revertedWith(
    //       "ZNSSubdomainRegistrar: beneficiary can not be 0x0 address"
    //     );
    //   });
    // });

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
          getAccessRevertMsg(user.address, ADMIN_ROLE)
        );
      });

      it("Should revert when zeroVault is address 0", async () => {
        const tx = zns.treasury.setBeneficiary(
          ethers.constants.HashZero,
          ethers.constants.AddressZero
        );
        await expect(tx).to.be.revertedWith("ZNSTreasury: zeroVault passed as 0x0 address");
      });
    });

    describe("#setPaymentToken() and PaymentTokenSet event", () => {
      it("Should set the correct address", async () => {
        const { token: currentStakingToken } = await zns.treasury.paymentConfigs(domainHash);
        expect(currentStakingToken).to.not.eq(randomAcc.address);

        const tx = await zns.treasury.setPaymentToken(
          domainHash,
          randomAcc.address
        );

        const newStakingToken = await zns.treasury.paymentConfigs(domainHash);
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
          getAccessRevertMsg(user.address, ADMIN_ROLE)
        );
      });

      it("Should revert when stakingToken is address 0", async () => {
        const tx = zns.treasury.connect(user).setPaymentToken(domainHash, ethers.constants.AddressZero);
        await expect(tx).to.be.revertedWith("ZNSTreasury: stakingToken_ passed as 0x0 address");
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

        const domainName = "world";
        const domainHash = hashSubdomainName(domainName);
        const { expectedPrice, stakeFee } = getPriceObject(domainName, priceConfigDefault);

        await zns.treasury.connect(mockRegistrar).stakeForDomain(
          ethers.constants.HashZero,
          domainHash,
          deployer.address,
          expectedPrice,
          ethers.constants.Zero,
          stakeFee
        );

        const calls = [
          treasury.registry(),
          treasury.getAccessController(),
          treasury.paymentConfigs(ethers.constants.HashZero),
          treasury.stakedForDomain(domainHash),
        ];

        await validateUpgrade(deployer, zns.treasury, treasury, treasuryFactory, calls);
      });
    });
  });
});
