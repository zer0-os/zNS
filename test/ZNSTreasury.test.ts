import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { checkBalance, deployZNS } from "./helpers";
import { ZNSContracts } from "./helpers/types";
import * as ethers from "ethers";
import { priceConfigDefault } from "./helpers/constants";
import { hashDomainLabel } from "./helpers/hashing";
import { ADMIN_ROLE, getAccessRevertMsg, REGISTRAR_ROLE } from "./helpers/access";

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

    zns = await deployZNS({
      deployer,
      governorAddresses: [governor.address],
      adminAddresses: [admin.address],
      zeroVaultAddress: zeroVault.address,
    });

    // give REGISTRAR_ROLE to a wallet address to be calling guarded functions
    await zns.accessController.connect(admin).grantRole(REGISTRAR_ROLE, mockRegistrar.address);

    // Give funds to user
    await zns.zeroToken.connect(user).approve(zns.treasury.address, ethers.constants.MaxUint256);
    await zns.zeroToken.transfer(user.address, ethers.utils.parseEther("15"));
  });

  it("Confirms deployment", async () => {
    const registrar = await zns.treasury.znsRegistrar();
    const priceOracle = await zns.treasury.znsPriceOracle();
    const token = await zns.treasury.zeroToken();
    const accessController = await zns.treasury.getAccessController();

    expect(registrar).to.eq(zns.registrar.address);
    expect(priceOracle).to.eq(zns.priceOracle.address);
    expect(token).to.eq(zns.zeroToken.address);
    expect(accessController).to.eq(zns.accessController.address);
  });

  describe("stakeForDomain", () => {
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

  describe("unstakeForDomain", () => {
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

  describe("setZeroVaultAddress() and ZeroVaultAddressSet event", () => {
    it("Should set the correct address of Zero Vault", async () => {
      const currentZeroVault = await zns.treasury.zeroVault();
      expect(currentZeroVault).to.not.eq(mockRegistrar.address);

      const tx = await zns.treasury.setZeroVaultAddress(mockRegistrar.address);

      const newZeroVault = await zns.treasury.zeroVault();
      expect(newZeroVault).to.eq(mockRegistrar.address);

      await expect(tx).to.emit(zns.treasury, "ZeroVaultAddressSet").withArgs(newZeroVault);
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

  describe("setZNSRegistrar", () => {
    it("Should set znsRegistrar in storage", async () => {
      await zns.treasury.setZNSRegistrar(randomAcc.address);

      const registrarFromSC = await zns.treasury.znsRegistrar();
      expect(registrarFromSC).to.be.eq(randomAcc.address);
    });

    it("Should revert when called from any address without ADMIN_ROLE", async () => {
      const tx = zns.treasury.connect(user).setZNSRegistrar(randomAcc.address);
      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(user.address, ADMIN_ROLE)
      );
    });

    it("Should revert if Registrar is address 0", async () => {
      const tx = zns.treasury.setZNSRegistrar(ethers.constants.AddressZero);
      await expect(tx).to.be.revertedWith("ZNSTreasury: Zero address passed as znsRegistrar");
    });
  });
});
