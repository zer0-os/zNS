import { IDistributionConfig, IZNSContractsLocal } from "../helpers/types";
import * as hre from "hardhat";
import { AccessType, DEFAULT_TOKEN_URI, deployZNS, PaymentType, DEFAULT_PRICE_CONFIG } from "../helpers";
import * as ethers from "ethers";
import { registrationWithSetup } from "../helpers/register-setup";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import fs from "fs";


const gasCostFile = `${process.cwd()}/test/gas/gas-costs.json`;


describe("Transaction Gas Costs Test", () => {
  let deployer : SignerWithAddress;
  let rootOwner : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let lvl2SubOwner : SignerWithAddress;
  let zeroVault : SignerWithAddress;

  let zns : IZNSContractsLocal;

  let rootHashDirect : string;
  // let rootHashStake : string;
  let config : IDistributionConfig;

  before(async () => {
    [
      deployer,
      zeroVault,
      governor,
      admin,
      rootOwner,
      lvl2SubOwner,
    ] = await hre.ethers.getSigners();
    // zeroVault address is used to hold the fee charged to the user when registering
    zns = await deployZNS({
      deployer,
      governorAddresses: [deployer.address, governor.address],
      adminAddresses: [admin.address],
      priceConfig: DEFAULT_PRICE_CONFIG,
      zeroVaultAddress: zeroVault.address,
    });

    await zns.curvePricer.connect(deployer).setPriceConfig(ethers.ZeroHash, DEFAULT_PRICE_CONFIG);

    config = {
      pricerContract: await zns.fixedPricer.getAddress(),
      paymentType: PaymentType.DIRECT,
      accessType: AccessType.OPEN,
    };

    // Give funds to users
    await Promise.all(
      [
        rootOwner,
        lvl2SubOwner,
      ].map(async ({ address }) =>
        zns.meowToken.mint(address, ethers.parseEther("1000000")))
    );
    await zns.meowToken.connect(rootOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

    rootHashDirect = await registrationWithSetup({
      zns,
      user: rootOwner,
      domainLabel: "rootdirect",
      fullConfig: {
        distrConfig: {
          accessType: AccessType.OPEN,
          pricerContract: await zns.curvePricer.getAddress(),
          paymentType: PaymentType.DIRECT,
        },
        paymentConfig: {
          token: await zns.meowToken.getAddress(),
          beneficiary: rootOwner.address,
        },
        priceConfig: DEFAULT_PRICE_CONFIG,
      },
    });

    fs.existsSync(gasCostFile) || fs.writeFileSync(gasCostFile, JSON.stringify({}));
  });

  it("Root Domain Price", async function () {
    // approve
    await zns.meowToken.connect(rootOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
    // register root domain
    const paymentConfig = {
      token: await zns.meowToken.getAddress(),
      beneficiary: rootOwner.address,
    };

    const tx = await zns.rootRegistrar.connect(rootOwner).registerRootDomain({
      name: "root",
      domainAddress: rootOwner.address,
      tokenOwner: hre.ethers.ZeroAddress,
      tokenURI: DEFAULT_TOKEN_URI,
      distributionConfig: config,
      paymentConfig,
    });

    const receipt = await tx.wait();
    const gasUsed = receipt?.gasUsed as bigint;

    const previous = JSON.parse(
      fs.readFileSync(gasCostFile, "utf8")
    );

    const title = this.test ? this.test.title : "! Title Not Found - Check Test Context !";
    const prevGas = previous[title];

    let gasDiff = BigInt(0);
    if (prevGas) {
      gasDiff = gasUsed - BigInt(prevGas);
    }

    console.log(`
      Root Domain Price:
        Gas Used: ${gasUsed.toString()}
        Gas Diff: ${gasDiff.toString()}
      `);

    if (gasDiff > 1000 || gasDiff < -1000) {
      fs.writeFileSync(
        gasCostFile,
        JSON.stringify({
          ...previous,
          // eslint-disable-next-line no-invalid-this
          [title]: gasUsed.toString(),
        })
      );
    }
  });

  it("Subdomain Price", async function () {
    // approve
    await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
    // register subdomain
    const paymentConfig = {
      token: await zns.meowToken.getAddress(),
      beneficiary: rootOwner.address,
    };

    const tx = await zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain({
      parentHash: rootHashDirect,
      label: "subdomain",
      domainAddress: lvl2SubOwner.address,
      tokenOwner: hre.ethers.ZeroAddress,
      tokenURI: DEFAULT_TOKEN_URI,
      distrConfig: config,
      paymentConfig,
    });

    const receipt = await tx.wait();
    const gasUsed = receipt?.gasUsed as bigint;

    const previous = JSON.parse(
      fs.readFileSync(gasCostFile, "utf8")
    );

    const title = this.test ? this.test.title : "! Title Not Found - Check Test Context !";

    const prevGas = previous[title];
    let gasDiff = BigInt(0);
    if (prevGas) {
      gasDiff = gasUsed - BigInt(prevGas);
    }

    console.log(`
      Subdomain Price:
        Gas Used: ${gasUsed.toString()}
        Gas Diff: ${gasDiff.toString()}
      `);

    if (gasDiff > 1000 || gasDiff < -1000) {
      fs.writeFileSync(
        gasCostFile,
        JSON.stringify({
          ...previous,
          // eslint-disable-next-line no-invalid-this
          [title]: gasUsed.toString(),
        },
        null,
        "\t")
      );
    }
  });
});
