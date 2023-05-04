import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployZNS } from "./helpers";
import { ZNSContracts } from "./helpers/types";
import * as ethers from "ethers";
import { priceConfigDefault } from "./helpers/constants";
import { hashDomainLabel } from "./helpers/hashing";

require("@nomicfoundation/hardhat-chai-matchers");

// TODO reg: test unstake
describe("ZNSTreasury", () => {
  let deployer : SignerWithAddress;
  let user : SignerWithAddress;
  let zeroVault : SignerWithAddress; // TODO fix when decided
  let mockRegistrar : SignerWithAddress;
  let zns : ZNSContracts;

  beforeEach(async () => {
    [deployer, zeroVault, user, mockRegistrar] = await hre.ethers.getSigners();
    zns = await deployZNS(deployer, priceConfigDefault, zeroVault.address);

    // Set the registrar as a mock so that we can call the functions
    await zns.treasury.connect(deployer).setZNSRegistrar(mockRegistrar.address);

    // Give funds to user
    await zns.zeroToken.connect(user).approve(zns.treasury.address, ethers.constants.MaxUint256);
    await zns.zeroToken.transfer(user.address, ethers.utils.parseEther("15"));
  });

  it("Confirms deployment", async () => {
    const registrar = await zns.treasury.znsRegistrar();
    const priceOracle = await zns.treasury.znsPriceOracle();
    const token = await zns.treasury.zeroToken();
    const isAdmin = await zns.treasury.isAdmin(deployer.address);

    expect(registrar).to.eq(mockRegistrar.address);
    expect(priceOracle).to.eq(zns.priceOracle.address);
    expect(token).to.eq(zns.zeroToken.address);
    expect(isAdmin).to.be.true;
  });

  describe("stakeForDomain", () => {
    it("Stakes the correct amount", async () => {
      const domain = "wilder";
      const domainHash = hashDomainLabel(domain);

      await zns.treasury.connect(mockRegistrar).stakeForDomain(
        domainHash,
        domain,
        user.address,
        true
      );

      const stake = await zns.treasury.stakedForDomain(domainHash);
      const { domainPrice: expectedStake } = await zns.priceOracle.getPrice(domain, true);
      expect(stake).to.eq(expectedStake);
    });

    it("Should revert if called from any address that is not ZNSRegistrar", async () => {
      const domain = "wilder";
      const domainHash = hashDomainLabel(domain);

      const tx = zns.treasury.connect(user).stakeForDomain(
        domainHash,
        domain,
        user.address,
        true
      );

      await expect(tx).to.be.revertedWith("ZNSTreasury: Only ZNSRegistrar is allowed to call");
    });
  });

  describe("setZeroVaultAddress() and ZeroVaultAddressSet event", () => {
    it("sets the correct address of Zero Vault", async () => {
      const currentZeroVault = await zns.treasury.zeroVault();
      expect(currentZeroVault).to.not.eq(mockRegistrar.address);

      const tx = await zns.treasury.setZeroVaultAddress(mockRegistrar.address);

      const newZeroVault = await zns.treasury.zeroVault();
      expect(newZeroVault).to.eq(mockRegistrar.address);

      await expect(tx).to.emit(zns.treasury, "ZeroVaultAddressSet").withArgs(newZeroVault);
    });
  });
});
