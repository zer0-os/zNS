import {
  ADMIN_ROLE,
  deployFixedPricing,
  deployZNS, getAccessRevertMsg, NOT_AUTHORIZED_REG_WIRED_ERR,
  priceConfigDefault, REGISTRAR_ROLE,
} from "../../helpers";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSContracts } from "../../helpers/types";
import * as ethers from "ethers";
import { registrationWithSetup } from "../../helpers/register-setup";
import { expect } from "chai";
import { BigNumber } from "ethers";


describe("ZNSFixedPricing", () => {
  let deployer : SignerWithAddress;
  let admin : SignerWithAddress;
  let user : SignerWithAddress;
  let random : SignerWithAddress;
  let zeroVault : SignerWithAddress;
  let mockRegistrar : SignerWithAddress;

  let zns : ZNSContracts;
  let domainHash : string;
  let parentPrice : BigNumber;

  before(async () => {
    [deployer, admin, user, zeroVault, random, mockRegistrar] = await hre.ethers.getSigners();
    parentPrice = ethers.utils.parseEther("2223");

    zns = await deployZNS({
      deployer,
      governorAddresses: [deployer.address, deployer.address],
      adminAddresses: [admin.address],
      priceConfig: priceConfigDefault,
      zeroVaultAddress: zeroVault.address,
    });

    await zns.zeroToken.connect(user).approve(zns.treasury.address, ethers.constants.MaxUint256);
    await zns.zeroToken.mint(user.address, ethers.utils.parseEther("10000000000000"));

    const fullConfig = {
      distrConfig: {
        pricingContract: zns.fixedPricing.address,
        paymentContract: zns.directPayment.address,
        accessType: 1,
      },
      priceConfig: parentPrice,
      paymentConfig: {
        paymentToken: zns.zeroToken.address,
        beneficiary: user.address,
      },
    };

    domainHash = await registrationWithSetup({
      zns,
      user,
      domainLabel: "test",
      fullConfig,
      isRootDomain: true,
    });
  });

  it("should deploy with correct parameters", async () => {
    expect(await zns.fixedPricing.getAccessController()).to.equal(zns.accessController.address);
    expect(await zns.fixedPricing.registry()).to.equal(zns.registry.address);
  });

  it("should not allow to be deployed by anyone other than ADMIN_ROLE", async () => {
    await expect(
      deployFixedPricing({
        deployer: random,
        acAddress: zns.accessController.address,
        regAddress: zns.registry.address,
      }),
    ).to.be.revertedWith(
      getAccessRevertMsg(random.address, ADMIN_ROLE)
    );
  });

  it("#setPrice() should work correctly and emit #PriceChanged event", async () => {
    const newPrice = ethers.utils.parseEther("1823");
    const tx = zns.fixedPricing.connect(user).setPrice(domainHash, newPrice);

    await expect(tx).to.emit(zns.fixedPricing, "PriceChanged").withArgs(domainHash, newPrice);

    expect(
      await zns.fixedPricing.getPrice(domainHash, "testname")
    ).to.equal(newPrice);
  });

  it("#getPrice should return the correct price", async () => {
    const newPrice = ethers.utils.parseEther("3213");
    await zns.fixedPricing.connect(user).setPrice(domainHash, newPrice);

    expect(
      await zns.fixedPricing.getPrice(domainHash, "testname")
    ).to.equal(newPrice);
  });

  it("#setPrice() should revert if called by anyone other than domain owner", async () => {
    await expect(
      zns.fixedPricing.connect(random).setPrice(domainHash, ethers.utils.parseEther("1"))
    ).to.be.revertedWith(
      NOT_AUTHORIZED_REG_WIRED_ERR
    );
  });

  // eslint-disable-next-line max-len
  it("#revokePrice() should only be callable by REGISTRAR_ROLE, make price 0 and fire #PriceRevoked event", async () => {
    const priceBefore = await zns.fixedPricing.getPrice(domainHash, "testname");
    expect(priceBefore).to.not.equal(0);

    await zns.accessController.connect(admin).grantRole(REGISTRAR_ROLE, mockRegistrar.address);

    const tx = await zns.fixedPricing.connect(mockRegistrar).revokePrice(domainHash);
    // check event
    await expect(tx).to.emit(zns.fixedPricing, "PriceRevoked").withArgs(domainHash);

    const priceAfter = await zns.fixedPricing.getPrice(domainHash, "testname");
    expect(priceAfter).to.equal(0);

    await expect(
      zns.fixedPricing.connect(user).revokePrice(domainHash)
    ).to.be.revertedWith(
      getAccessRevertMsg(user.address, REGISTRAR_ROLE)
    );
  });

  it("#setRegistry() should set the correct address", async () => {
    await zns.fixedPricing.connect(admin).setRegistry(random.address);

    expect(
      await zns.fixedPricing.registry()
    ).to.equal(random.address);

    // set back for other tests
    await zns.fixedPricing.connect(admin).setRegistry(zns.registry.address);
  });

  it("#setRegistry() should revert if called by anyone other than ADMIN_ROLE", async () => {
    await expect(
      zns.fixedPricing.connect(random).setRegistry(random.address)
    ).to.be.revertedWith(
      getAccessRevertMsg(random.address, ADMIN_ROLE)
    );
  });

  it("#setAccessController() should revert if called by anyone other than ADMIN_ROLE", async () => {
    await expect(
      zns.fixedPricing.connect(random).setAccessController(random.address)
    ).to.be.revertedWith(
      getAccessRevertMsg(random.address, ADMIN_ROLE)
    );
  });

  // keep this as the last test
  it("#setAccessController() should set the correct address", async () => {
    await zns.fixedPricing.connect(admin).setAccessController(random.address);

    expect(
      await zns.fixedPricing.getAccessController()
    ).to.equal(random.address);
  });
});
