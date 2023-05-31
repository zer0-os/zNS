import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { checkBalance, deployZNS } from "./helpers";
import { DeployZNSParams, ZNSContracts } from "./helpers/types";
import * as ethers from "ethers";
import { hashDomainLabel } from "./helpers/hashing";
import { ADMIN_ROLE, REGISTRAR_ROLE, GOVERNOR_ROLE } from "./helpers/access";
import { getAccessRevertMsg } from "./helpers/errors";
import { ZNSTreasuryMock__factory, ZNSTreasury__factory } from "../typechain";

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
    await zns.zeroToken.transfer(user.address, ethers.utils.parseEther("15"));
  });

  it("Confirms deployment", async () => {
    const priceOracle = await zns.treasury.priceOracle();
    const token = await zns.treasury.stakingToken();
    const accessController = await zns.treasury.getAccessController();

    expect(priceOracle).to.eq(zns.priceOracle.address);
    expect(token).to.eq(zns.zeroToken.address);
    expect(accessController).to.eq(zns.accessController.address);
  });

  describe("#stakeForDomain", () => {
    it("Stakes the correct amount", async () => {
      const domain = "wilder";
      const domainHash = hashDomainLabel(domain);

      const balanceBeforeStake = await zns.zeroToken.balanceOf(user.address);

      await zns.treasury.connect(mockRegistrar).stakeForDomain(
        domainHash,
        domain,
        user.address,
        true
      );

      const stake = await zns.treasury.stakedForDomain(domainHash);
      const { domainPrice: expectedStake, fee } = await zns.priceOracle.getPrice(domain, true);
      expect(stake).to.eq(expectedStake);

      await checkBalance({
        token: zns.zeroToken,
        balanceBefore: balanceBeforeStake,
        userAddress: user.address,
        target: stake.add(fee),
        shouldDecrease: true,
      });
    });

    it("Should revert if called from an address without REGISTRAR_ROLE", async () => {
      const domain = "wilder";
      const domainHash = hashDomainLabel(domain);

      const tx = zns.treasury.connect(randomAcc).stakeForDomain(
        domainHash,
        domain,
        user.address,
        true
      );

      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(randomAcc.address, REGISTRAR_ROLE)
      );
    });
  });

  describe("#unstakeForDomain", () => {
    it("Unstakes the correct amount", async () => {
      const domain = "wilder";
      const domainHash = hashDomainLabel(domain);

      await zns.treasury.connect(mockRegistrar).stakeForDomain(
        domainHash,
        domain,
        user.address,
        true
      );

      const balanceBeforeUnstake = await zns.zeroToken.balanceOf(user.address);
      const stake = await zns.treasury.stakedForDomain(domainHash);

      await zns.treasury.connect(mockRegistrar).unstakeForDomain(domainHash, user.address);

      await checkBalance({
        token: zns.zeroToken,
        balanceBefore: balanceBeforeUnstake,
        userAddress: user.address,
        target: stake,
        shouldDecrease: false,
      });
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

  describe("#setZeroVaultAddress() and ZeroVaultAddressSet event", () => {
    it("Should set the correct address of Zero Vault", async () => {
      const currentZeroVault = await zns.treasury.zeroVault();
      expect(currentZeroVault).to.not.eq(mockRegistrar.address);

      const tx = await zns.treasury.setZeroVaultAddress(mockRegistrar.address);

      const newZeroVault = await zns.treasury.zeroVault();
      expect(newZeroVault).to.eq(mockRegistrar.address);

      await expect(tx).to.emit(zns.treasury, "ZeroVaultAddressSet").withArgs(mockRegistrar.address);
    });

    it("Should revert when called from any address without ADMIN_ROLE", async () => {
      const tx = zns.treasury.connect(user).setZeroVaultAddress(mockRegistrar.address);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });

    it("Should revert when zeroVault is address 0", async () => {
      const tx = zns.treasury.setZeroVaultAddress(ethers.constants.AddressZero);
      await expect(tx).to.be.revertedWith("ZNSTreasury: zeroVault passed as 0x0 address");
    });
  });

  describe("#setPriceOracle() and PriceOracleSet event", () => {
    it("Should set the correct address of ZNS Price Oracle", async () => {
      const currentPriceOracle = await zns.treasury.priceOracle();
      expect(currentPriceOracle).to.not.eq(randomAcc.address);

      const tx = await zns.treasury.setPriceOracle(randomAcc.address);

      const newPriceOracle = await zns.treasury.priceOracle();
      expect(newPriceOracle).to.eq(randomAcc.address);

      await expect(tx).to.emit(zns.treasury, "PriceOracleSet").withArgs(randomAcc.address);
    });

    it("Should revert when called from any address without ADMIN_ROLE", async () => {
      const tx = zns.treasury.connect(user).setPriceOracle(randomAcc.address);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });

    it("Should revert when znsPriceOracle is address 0", async () => {
      const tx = zns.treasury.setPriceOracle(ethers.constants.AddressZero);
      await expect(tx).to.be.revertedWith("ZNSTreasury: znsPriceOracle_ passed as 0x0 address");
    });
  });

  describe("#setStakingToken() and ZnsStakingTokenSet event", () => {
    it("Should set the correct address of ZNS Staking Token", async () => {
      const currentStakingToken = await zns.treasury.stakingToken();
      expect(currentStakingToken).to.not.eq(randomAcc.address);

      const tx = await zns.treasury.setStakingToken(randomAcc.address);

      const newStakingToken = await zns.treasury.stakingToken();
      expect(newStakingToken).to.eq(randomAcc.address);

      await expect(tx).to.emit(zns.treasury, "StakingTokenSet").withArgs(randomAcc.address);
    });

    it("Should revert when called from any address without ADMIN_ROLE", async () => {
      const tx = zns.treasury.connect(user).setStakingToken(randomAcc.address);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });

    it("Should revert when stakingToken is address 0", async () => {
      const tx = zns.treasury.setStakingToken(ethers.constants.AddressZero);
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
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const treasuryFactory = new ZNSTreasuryMock__factory(deployer);
      const treasury = await treasuryFactory.deploy();
      await treasury.deployed();

      await expect(zns.treasury.connect(deployer).upgradeTo(treasury.address)).to.not.be.reverted;
    });

    it("Verifies that variable values are not changed in the upgrade process", async () => {
      // Confirm deployer has the correct role first
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const treasuryFactory = new ZNSTreasuryMock__factory(deployer);
      const treasury = await treasuryFactory.deploy();
      await treasury.deployed();

      const preUpgradeVars = [
        zns.treasury.priceOracle(),
        zns.treasury.stakingToken(),
        zns.treasury.zeroVault(),
      ];

      const [priceOracleBefore, stakingTokenBefore, vaultBefore] = await Promise.all(preUpgradeVars);

      // the upgrade was successful
      await expect(zns.treasury.connect(deployer).upgradeTo(treasury.address)).to.not.be.reverted;

      const postUpgradeVars = [
        zns.treasury.priceOracle(),
        zns.treasury.stakingToken(),
        zns.treasury.zeroVault(),
      ];

      const [priceOracleAfter, stakingTokenAfter, vaultAfter] = await Promise.all(postUpgradeVars);

      // The state variables weren't changed in the process
      expect(priceOracleBefore).to.eq(priceOracleAfter);
      expect(stakingTokenBefore).to.eq(stakingTokenAfter);
      expect(vaultBefore).to.eq(vaultAfter);
    });

    it("Disallows an unauthorized user from upgrade the contract", async () => {
      const accessTx = zns.accessController.checkGovernor(user.address);
      await expect(accessTx).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${GOVERNOR_ROLE}`
      );

      const treasuryFactory = new ZNSTreasuryMock__factory(deployer);
      const treasury = await treasuryFactory.deploy();
      await treasury.deployed();

      const deployTx = zns.treasury.connect(user).upgradeTo(treasury.address);
      await expect(deployTx).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${GOVERNOR_ROLE}`
      );
    });
  });
});
