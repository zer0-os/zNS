import {
  ADMIN_ROLE,
  deployFixedPricer,
  deployZNS,
  getAccessRevertMsg,
  GOVERNOR_ROLE,
  INITIALIZED_ERR,
  NOT_AUTHORIZED_REG_WIRED_ERR,
  PaymentType,
  PERCENTAGE_BASIS,
  priceConfigDefault,
  validateUpgrade,
} from "./helpers";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IZNSContracts } from "./helpers/types";
import * as ethers from "ethers";
import { registrationWithSetup } from "./helpers/register-setup";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ZNSFixedPricer__factory, ZNSFixedPricerUpgradeMock__factory } from "../typechain";
import { getProxyImplAddress } from "./helpers/utils";


describe("ZNSFixedPricer", () => {
  let deployer : SignerWithAddress;
  let admin : SignerWithAddress;
  let user : SignerWithAddress;
  let random : SignerWithAddress;
  let zeroVault : SignerWithAddress;

  let zns : IZNSContracts;
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
    });
  });

  it("should deploy with correct parameters", async () => {
    expect(await zns.fixedPricer.getAccessController()).to.equal(zns.accessController.address);
    expect(await zns.fixedPricer.registry()).to.equal(zns.registry.address);
  });

  it("should NOT initialize twice", async () => {
    await expect(zns.fixedPricer.initialize(
      zns.accessController.address,
      zns.registry.address,
    )).to.be.revertedWith(INITIALIZED_ERR);
  });

  it("Should NOT let initialize the implementation contract", async () => {
    const factory = new ZNSFixedPricer__factory(deployer);
    const impl = await getProxyImplAddress(zns.fixedPricer.address);
    const implContract = factory.attach(impl);

    await expect(
      implContract.initialize(
        deployer.address,
        random.address,
      )
    ).to.be.revertedWith(INITIALIZED_ERR);
  });

  it("should set config for 0x0 hash", async () => {
    const {
      price,
      feePercentage,
    } = await zns.fixedPricer.priceConfigs(ethers.constants.HashZero);

    expect(price).to.equal(0);
    expect(feePercentage).to.equal(0);

    const newPrice = ethers.utils.parseEther("9182263");
    const newFee = BigNumber.from(2359);

    // deployer owns 0x0 hash at initialization time
    await zns.fixedPricer.connect(deployer).setPriceConfig(
      ethers.constants.HashZero,
      {
        price: newPrice,
        feePercentage: newFee,
        isSet: true,
      }
    );

    const {
      price: newPriceAfter,
      feePercentage: newFeeAfter,
    } = await zns.fixedPricer.priceConfigs(ethers.constants.HashZero);

    expect(newPriceAfter).to.equal(newPrice);
    expect(newFeeAfter).to.equal(newFee);
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

  it("#getPriceAndFee() should return the correct price and fee", async () => {
    const newPrice = ethers.utils.parseEther("3213");
    const newFee = BigNumber.from(1234);
    await zns.fixedPricer.connect(user).setPrice(domainHash, newPrice);
    await zns.fixedPricer.connect(user).setFeePercentage(domainHash, newFee);

    const {
      price,
      fee,
    } = await zns.fixedPricer.getPriceAndFee(domainHash, "testname");

    expect(price).to.equal(newPrice);
    expect(fee).to.equal(newPrice.mul(newFee).div(PERCENTAGE_BASIS));
  });

  it("#setPrice() should revert if called by anyone other than domain owner", async () => {
    await expect(
      zns.fixedPricer.connect(random).setPrice(domainHash, ethers.utils.parseEther("1"))
    ).to.be.revertedWith(
      NOT_AUTHORIZED_REG_WIRED_ERR
    );
  });

  it("#setFeePercentage() should set the fee correctly and emit #FeePercentageSet event", async () => {
    const newFee = BigNumber.from(1234);
    const tx = zns.fixedPricer.connect(user).setFeePercentage(domainHash, newFee);

    await expect(tx).to.emit(zns.fixedPricer, "FeePercentageSet").withArgs(domainHash, newFee);

    const {
      feePercentage,
    } = await zns.fixedPricer.priceConfigs(domainHash);
    expect(feePercentage).to.equal(newFee);
  });

  it("#setFeePercentage() should revert if called by anyone other than domain owner", async () => {
    await expect(
      zns.fixedPricer.connect(random).setFeePercentage(domainHash, BigNumber.from(1))
    ).to.be.revertedWith(
      NOT_AUTHORIZED_REG_WIRED_ERR
    );
  });

  it("#setFeePercentage() should revert when trying to set feePercentage higher than PERCENTAGE_BASIS", async () => {
    await expect(
      zns.fixedPricer.connect(user).setFeePercentage(domainHash, PERCENTAGE_BASIS.add(1))
    ).to.be.revertedWith(
      "ZNSFixedPricer: feePercentage cannot be greater than PERCENTAGE_BASIS"
    );
  });

  // eslint-disable-next-line max-len
  it("#setPriceConfig() should set the price config correctly and emit #PriceSet and #FeePercentageSet events", async () => {
    const newPrice = ethers.utils.parseEther("1823");
    const newFee = BigNumber.from("12");
    const tx = zns.fixedPricer.connect(user).setPriceConfig(
      domainHash,
      {
        price: newPrice,
        feePercentage: newFee,
        isSet: true,
      }
    );

    await expect(tx).to.emit(zns.fixedPricer, "PriceSet").withArgs(domainHash, newPrice);
    await expect(tx).to.emit(zns.fixedPricer, "FeePercentageSet").withArgs(domainHash, newFee);

    const {
      price,
      feePercentage,
    } = await zns.fixedPricer.priceConfigs(domainHash);
    expect(price).to.equal(newPrice);
    expect(feePercentage).to.equal(newFee);
  });

  it("#setPriceConfig() should revert if called by anyone other than domain owner or operator", async () => {
    await expect(
      zns.fixedPricer.connect(random).setPriceConfig(
        domainHash,
        {
          price: BigNumber.from(1),
          feePercentage: BigNumber.from(1),
          isSet: true,
        }
      )
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

  describe("UUPS", () => {
    before(async () => {
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
      });
    });

    it("Allows an authorized user to upgrade the contract", async () => {
      // FixedPricer to upgrade to
      const factory = new ZNSFixedPricerUpgradeMock__factory(deployer);
      const newFixedPricer = await factory.deploy();
      await newFixedPricer.deployed();

      // Confirm the deployer is a governor, as set in `deployZNS` helper
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const tx = zns.fixedPricer.connect(deployer).upgradeTo(newFixedPricer.address);
      await expect(tx).to.not.be.reverted;

      await expect(
        zns.fixedPricer.connect(deployer).initialize(
          zns.accessController.address,
          zns.registry.address,
        )
      ).to.be.revertedWith(INITIALIZED_ERR);
    });

    it("Fails to upgrade if the caller is not authorized", async () => {
      // FixedPricer to upgrade to
      const factory = new ZNSFixedPricerUpgradeMock__factory(deployer);
      const newFixedPricer = await factory.deploy();
      await newFixedPricer.deployed();

      // Confirm the account is not a governor
      await expect(zns.accessController.checkGovernor(random.address)).to.be.reverted;

      const tx = zns.fixedPricer.connect(random).upgradeTo(newFixedPricer.address);

      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(random.address, GOVERNOR_ROLE)
      );
    });

    it("Verifies that variable values are not changed in the upgrade process", async () => {
      const factory = new ZNSFixedPricerUpgradeMock__factory(deployer);
      const newFixedPricer = await factory.deploy();
      await newFixedPricer.deployed();

      await zns.fixedPricer.connect(user).setPrice(domainHash, "7");
      await zns.fixedPricer.connect(user).setFeePercentage(
        domainHash,
        BigNumber.from(12)
      );

      const contractCalls = [
        zns.fixedPricer.registry(),
        zns.fixedPricer.getAccessController(),
        zns.fixedPricer.priceConfigs(domainHash),
        zns.fixedPricer.getPrice(domainHash, "wilder"),
      ];

      await validateUpgrade(deployer, zns.fixedPricer, newFixedPricer, factory, contractCalls);
    });
  });
});
