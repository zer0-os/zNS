import {
  ADMIN_ROLE,
  deployFixedPricer,
  deployZNS, getAccessRevertMsg, NOT_AUTHORIZED_REG_WIRED_ERR, PaymentType,
  priceConfigDefault, REGISTRAR_ROLE,
} from "./helpers";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSContracts } from "./helpers/types";
import * as ethers from "ethers";
import { registrationWithSetup } from "./helpers/register-setup";
import { expect } from "chai";
import { BigNumber } from "ethers";


describe("ZNSFixedPricer", () => {
  let deployer : SignerWithAddress;
  let admin : SignerWithAddress;
  let user : SignerWithAddress;
  let random : SignerWithAddress;
  let zeroVault : SignerWithAddress;

  let zns : ZNSContracts;
  let domainHash : string;
  let parentPrice : BigNumber;
  let parentFeePercentage : BigNumber;

  before(async () => {
    [deployer, admin, user, zeroVault, random] = await hre.ethers.getSigners();
    parentPrice = ethers.utils.parseEther("2223");
    parentFeePercentage = BigNumber.from(2310);

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
        paymentType: PaymentType.DIRECT,
        pricerContract: zns.fixedPricer.address,
        accessType: 1,
      },
      paymentConfig: {
        token: zns.zeroToken.address,
        beneficiary: user.address,
      },
      priceConfig: {
        price: parentPrice,
        feePercentage: parentFeePercentage,
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
    expect(await zns.fixedPricer.getAccessController()).to.equal(zns.accessController.address);
    expect(await zns.fixedPricer.registry()).to.equal(zns.registry.address);
  });

  it("should not allow to be deployed by anyone other than ADMIN_ROLE", async () => {
    await expect(
      deployFixedPricer({
        deployer: random,
        acAddress: zns.accessController.address,
        regAddress: zns.registry.address,
      }),
    ).to.be.revertedWith(
      getAccessRevertMsg(random.address, ADMIN_ROLE)
    );
  });

  it("#setPrice() should work correctly and emit #PriceSet event", async () => {
    const newPrice = ethers.utils.parseEther("1823");
    const tx = zns.fixedPricer.connect(user).setPrice(domainHash, newPrice);

    await expect(tx).to.emit(zns.fixedPricer, "PriceSet").withArgs(domainHash, newPrice);

    expect(
      await zns.fixedPricer.getPrice(domainHash, "testname")
    ).to.equal(newPrice);
  });

  it("#getPrice should return the correct price", async () => {
    const newPrice = ethers.utils.parseEther("3213");
    await zns.fixedPricer.connect(user).setPrice(domainHash, newPrice);

    expect(
      await zns.fixedPricer.getPrice(domainHash, "testname")
    ).to.equal(newPrice);
  });

  it("#setPrice() should revert if called by anyone other than domain owner", async () => {
    await expect(
      zns.fixedPricer.connect(random).setPrice(domainHash, ethers.utils.parseEther("1"))
    ).to.be.revertedWith(
      NOT_AUTHORIZED_REG_WIRED_ERR
    );
  });

  it("#setRegistry() should set the correct address", async () => {
    await zns.fixedPricer.connect(admin).setRegistry(random.address);

    expect(
      await zns.fixedPricer.registry()
    ).to.equal(random.address);

    // set back for other tests
    await zns.fixedPricer.connect(admin).setRegistry(zns.registry.address);
  });

  it("#setRegistry() should revert if called by anyone other than ADMIN_ROLE", async () => {
    await expect(
      zns.fixedPricer.connect(random).setRegistry(random.address)
    ).to.be.revertedWith(
      getAccessRevertMsg(random.address, ADMIN_ROLE)
    );
  });

  it("#setAccessController() should revert if called by anyone other than ADMIN_ROLE", async () => {
    await expect(
      zns.fixedPricer.connect(random).setAccessController(random.address)
    ).to.be.revertedWith(
      getAccessRevertMsg(random.address, ADMIN_ROLE)
    );
  });

  // keep this as the last test
  it("#setAccessController() should set the correct address", async () => {
    await zns.fixedPricer.connect(admin).setAccessController(random.address);

    expect(
      await zns.fixedPricer.getAccessController()
    ).to.equal(random.address);
  });
});
