import {
  ADMIN_ROLE,
  deployFixedPricer,
  deployZNS,
  GOVERNOR_ROLE,
  INITIALIZED_ERR, INVALID_LABEL_ERR,
  NOT_AUTHORIZED_ERR,
  PaymentType,
  DEFAULT_PERCENTAGE_BASIS,
  DEFAULT_PRICE_CONFIG,
  validateUpgrade, AccessType, AC_UNAUTHORIZED_ERR, FEE_TOO_LARGE_ERR,
} from "./helpers";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import * as ethers from "ethers";
import { registrationWithSetup } from "./helpers/register-setup";
import { expect } from "chai";
import { ZNSFixedPricer__factory, ZNSFixedPricer, ZNSFixedPricerUpgradeMock__factory } from "../typechain";
import { getProxyImplAddress } from "./helpers/utils";
import { IZNSContractsLocal } from "./helpers/types";


describe("ZNSFixedPricer", () => {
  let deployer : SignerWithAddress;
  let admin : SignerWithAddress;
  let user : SignerWithAddress;
  let random : SignerWithAddress;
  let zeroVault : SignerWithAddress;

  let zns : IZNSContractsLocal;
  let domainHash : string;
  let parentPrice : bigint;
  let parentFeePercentage : bigint;

  before(async () => {
    [deployer, admin, user, zeroVault, random] = await hre.ethers.getSigners();
    parentPrice = ethers.parseEther("2223");
    parentFeePercentage = BigInt(2310);

    zns = await deployZNS({
      deployer,
      governorAddresses: [deployer.address, deployer.address],
      adminAddresses: [admin.address],
      priceConfig: DEFAULT_PRICE_CONFIG,
      zeroVaultAddress: zeroVault.address,
    });

    await zns.meowToken.connect(user).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
    await zns.meowToken.mint(user.address, ethers.parseEther("10000000000000"));

    const fullConfig = {
      distrConfig: {
        paymentType: PaymentType.DIRECT,
        pricerContract: await zns.fixedPricer.getAddress(),
        accessType: AccessType.OPEN,
      },
      paymentConfig: {
        token: await zns.meowToken.getAddress(),
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
    expect(await zns.fixedPricer.getAccessController()).to.equal(await zns.accessController.getAddress());
    expect(await zns.fixedPricer.registry()).to.equal(await zns.registry.getAddress());
  });

  it("should NOT initialize twice", async () => {
    await expect(zns.fixedPricer.initialize(
      await zns.accessController.getAddress(),
      await zns.registry.getAddress(),
    )).to.be.revertedWithCustomError(zns.fixedPricer, INITIALIZED_ERR);
  });

  it("Should NOT let initialize the implementation contract", async () => {
    const factory = new ZNSFixedPricer__factory(deployer);
    const impl = await getProxyImplAddress(await zns.fixedPricer.getAddress());
    const implContract = factory.attach(impl) as ZNSFixedPricer;

    await expect(
      implContract.initialize(
        deployer.address,
        random.address,
      )
    ).to.be.revertedWithCustomError(implContract, INITIALIZED_ERR);
  });

  it("should set config for 0x0 hash", async () => {
    const {
      price,
      feePercentage,
    } = await zns.fixedPricer.priceConfigs(ethers.ZeroHash);

    expect(price).to.equal(0);
    expect(feePercentage).to.equal(0);

    const newPrice = ethers.parseEther("9182263");
    const newFee = BigInt(2359);

    // deployer owns 0x0 hash at initialization time
    await zns.fixedPricer.connect(deployer).setPriceConfig(
      ethers.ZeroHash,
      {
        price: newPrice,
        feePercentage: newFee,
        isSet: true,
      }
    );

    const {
      price: newPriceAfter,
      feePercentage: newFeeAfter,
    } = await zns.fixedPricer.priceConfigs(ethers.ZeroHash);

    expect(newPriceAfter).to.equal(newPrice);
    expect(newFeeAfter).to.equal(newFee);
  });

  it("should not allow to be deployed by anyone other than ADMIN_ROLE", async () => {
    await expect(
      deployFixedPricer({
        deployer: random,
        acAddress: await zns.accessController.getAddress(),
        regAddress: await zns.registry.getAddress(),
      }),
    ).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
      .withArgs(random.address, ADMIN_ROLE);
  });

  it("#setPrice() should work correctly and emit #PriceSet event", async () => {
    const newPrice = ethers.parseEther("1823");
    const tx = zns.fixedPricer.connect(user).setPrice(domainHash, newPrice);

    await expect(tx).to.emit(zns.fixedPricer, "PriceSet").withArgs(domainHash, newPrice);

    expect(
      await zns.fixedPricer.getPrice(domainHash, "testname", true)
    ).to.equal(newPrice);
  });

  it("#getPrice should return the correct price", async () => {
    const newPrice = ethers.parseEther("3213");
    await zns.fixedPricer.connect(user).setPrice(domainHash, newPrice);

    expect(
      await zns.fixedPricer.getPrice(domainHash, "testname", false)
    ).to.equal(newPrice);
  });

  it("#getPrice() should revert for invalid label when not skipping the label validation", async () => {
    await expect(
      zns.fixedPricer.getPrice(domainHash, "tEstname", false)
    ).to.be.revertedWithCustomError(zns.fixedPricer, INVALID_LABEL_ERR);
  });

  it("#getPriceAndFee() should return the correct price and fee", async () => {
    const newPrice = ethers.parseEther("3213");
    const newFee = BigInt(1234);
    await zns.fixedPricer.connect(user).setPrice(domainHash, newPrice);
    await zns.fixedPricer.connect(user).setFeePercentage(domainHash, newFee);

    const {
      price,
      fee,
    } = await zns.fixedPricer.getPriceAndFee(domainHash, "testname", false);

    expect(price).to.equal(newPrice);
    expect(fee).to.equal(newPrice * newFee / DEFAULT_PERCENTAGE_BASIS);
  });

  it("#setPrice() should revert if called by anyone other than domain owner", async () => {
    await expect(
      zns.fixedPricer.connect(random).setPrice(domainHash, ethers.parseEther("1"))
    ).to.be.revertedWithCustomError(
      zns.fixedPricer,
      NOT_AUTHORIZED_ERR
    );
  });

  it("#setFeePercentage() should set the fee correctly and emit #FeePercentageSet event", async () => {
    const newFee = BigInt(1234);
    const tx = zns.fixedPricer.connect(user).setFeePercentage(domainHash, newFee);

    await expect(tx).to.emit(zns.fixedPricer, "FeePercentageSet").withArgs(domainHash, newFee);

    const {
      feePercentage,
    } = await zns.fixedPricer.priceConfigs(domainHash);
    expect(feePercentage).to.equal(newFee);
  });

  it("#setFeePercentage() should revert if called by anyone other than domain owner", async () => {
    await expect(
      zns.fixedPricer.connect(random).setFeePercentage(domainHash, BigInt(1))
    ).to.be.revertedWithCustomError(
      zns.fixedPricer,
      NOT_AUTHORIZED_ERR
    );
  });

  it("#setFeePercentage() should revert when trying to set feePercentage higher than PERCENTAGE_BASIS", async () => {
    await expect(
      zns.fixedPricer.connect(user).setFeePercentage(domainHash, DEFAULT_PERCENTAGE_BASIS + 1n)
    ).to.be.revertedWithCustomError(
      zns.fixedPricer,
      FEE_TOO_LARGE_ERR
    );
  });

  // eslint-disable-next-line max-len
  it("#setPriceConfig() should set the price config correctly and emit #PriceSet and #FeePercentageSet events", async () => {
    const newPrice = ethers.parseEther("1823");
    const newFee = BigInt("12");
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
      zns.fixedPricer.connect(random).setPriceConfig(domainHash, {
        price: BigInt(1),
        feePercentage: BigInt(1),
        isSet: true,
      })
    ).to.be.revertedWithCustomError(
      zns.fixedPricer,
      NOT_AUTHORIZED_ERR
    );
  });

  it("#setRegistry() should set the correct address", async () => {
    await zns.fixedPricer.connect(admin).setRegistry(random.address);

    expect(
      await zns.fixedPricer.registry()
    ).to.equal(random.address);

    // set back for other tests
    await zns.fixedPricer.connect(admin).setRegistry(await zns.registry.getAddress());
  });

  it("#setRegistry() should revert if called by anyone other than ADMIN_ROLE", async () => {
    await expect(
      zns.fixedPricer.connect(random).setRegistry(random.address)
    ).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
      .withArgs(random.address, ADMIN_ROLE);
  });

  it("#setAccessController() should revert if called by anyone other than ADMIN_ROLE", async () => {
    await expect(
      zns.fixedPricer.connect(random).setAccessController(random.address)
    ).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
      .withArgs(random.address, ADMIN_ROLE);
  });

  it("Should revert when NON-admin tries to set #PAUSE", async () => {
    await expect(
      zns.fixedPricer.connect(user).pause()
    ).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR);
  });

  it("Should revert on every suspendable function call when the contract is PAUSED", async () => {
    await zns.fixedPricer.connect(admin).pause();

    const functionsToTest = [
      async () => zns.fixedPricer.connect(user).setPrice(domainHash, ethers.parseEther("1")),
      async () => zns.fixedPricer.connect(user).setFeePercentage(domainHash, 100n),
      async () => zns.fixedPricer.connect(user).setPriceConfig(
        domainHash,
        {
          price: ethers.parseEther("1"),
          feePercentage: 100n,
          isSet: true,
        }
      ),
    ];

    for (const call of functionsToTest) {
      await expect(
        call()
      ).to.be.revertedWithCustomError(
        zns.fixedPricer,
        "EnforcedPause"
      );
    }
  });

  it("#setAccessController() should revert with `WrongAccessControlAddress(SIGNER.address)`", async () => {
    await expect(
      zns.fixedPricer.setAccessController(random.address)
    ).to.revertedWithCustomError(
      zns.fixedPricer,
      "WrongAccessControlAddress"
    ).withArgs(random.address);

    // set back for other tests.
    await zns.fixedPricer.connect(admin).setAccessController(
      zns.accessController.target
    );
  });

  it("#setAccessController() should change current Access Control to another propper one", async () => {
    await zns.fixedPricer.connect(admin).setAccessController(zns.accessController.target);

    expect(
      await zns.fixedPricer.getAccessController()
    ).to.equal(zns.accessController.target);
  });

  it("#setAccessController() should revert with `WrongAccessControlAddress(CONTRACT.target)`", async () => {
    await expect(
      zns.fixedPricer.setAccessController(zns.domainToken.target)
    ).to.revertedWithCustomError(
      zns.fixedPricer,
      "WrongAccessControlAddress"
    ).withArgs(zns.domainToken.target);

    // set back for other tests.
    await zns.fixedPricer.connect(admin).setAccessController(
      zns.accessController.target
    );
  });

  describe("UUPS", () => {
    before(async () => {
      zns = await deployZNS({
        deployer,
        governorAddresses: [deployer.address, deployer.address],
        adminAddresses: [admin.address],
        priceConfig: DEFAULT_PRICE_CONFIG,
        zeroVaultAddress: zeroVault.address,
      });

      await zns.meowToken.connect(user).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
      await zns.meowToken.mint(user.address, ethers.parseEther("10000000000000"));

      const fullConfig = {
        distrConfig: {
          paymentType: PaymentType.DIRECT,
          pricerContract: await zns.fixedPricer.getAddress(),
          accessType: AccessType.OPEN,
        },
        paymentConfig: {
          token: await zns.meowToken.getAddress(),
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
      await newFixedPricer.waitForDeployment();

      // Confirm the deployer is a governor, as set in `deployZNS` helper
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const tx = zns.fixedPricer.connect(deployer).upgradeToAndCall(
        await newFixedPricer.getAddress(),
        "0x"
      );
      await expect(tx).to.not.be.reverted;

      await expect(
        zns.fixedPricer.connect(deployer).initialize(
          await zns.accessController.getAddress(),
          await zns.registry.getAddress(),
        )
      ).to.be.revertedWithCustomError(zns.fixedPricer, INITIALIZED_ERR);
    });

    it("Fails to upgrade if the caller is not authorized", async () => {
      // FixedPricer to upgrade to
      const factory = new ZNSFixedPricerUpgradeMock__factory(deployer);
      const newFixedPricer = await factory.deploy();
      await newFixedPricer.waitForDeployment();

      // Confirm the account is not a governor
      await expect(zns.accessController.checkGovernor(random.address)).to.be.reverted;

      const tx = zns.fixedPricer.connect(random).upgradeToAndCall(
        await newFixedPricer.getAddress(),
        "0x"
      );

      await expect(tx).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
        .withArgs(random.address, GOVERNOR_ROLE);
    });

    it("Verifies that variable values are not changed in the upgrade process", async () => {
      const factory = new ZNSFixedPricerUpgradeMock__factory(deployer);
      const newFixedPricer = await factory.deploy();
      await newFixedPricer.waitForDeployment();

      await zns.fixedPricer.connect(user).setPrice(domainHash, "7");
      await zns.fixedPricer.connect(user).setFeePercentage(
        domainHash,
        BigInt(12)
      );

      const contractCalls = [
        zns.fixedPricer.registry(),
        zns.fixedPricer.getAccessController(),
        zns.fixedPricer.priceConfigs(domainHash),
        zns.fixedPricer.getPrice(domainHash, "wilder", false),
      ];

      await validateUpgrade(deployer, zns.fixedPricer, newFixedPricer, factory, contractCalls);
    });
  });
});
