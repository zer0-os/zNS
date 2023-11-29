import { IDistributionConfig, IZNSContracts } from "../helpers/types";
import * as hre from "hardhat";
import { AccessType, DEFAULT_TOKEN_URI, deployZNS, PaymentType, DEFAULT_PRICE_CONFIG } from "../helpers";
import * as ethers from "ethers";
import { registrationWithSetup } from "../helpers/register-setup";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import fs from "fs";


const gasCostFile = `${process.cwd()}/test/gas/gas-costs.json`;


// TODO sub: add more tests here for each tx with different configs
//  so we can track gas changes better when developing
//  OR just use hardhat gas profiler and remove these tests
describe("Transaction Gas Costs Test", () => {
  let deployer : SignerWithAddress;
  let rootOwner : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let lvl2SubOwner : SignerWithAddress;
  let zeroVault : SignerWithAddress;

  let zns : IZNSContracts;

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
      pricerContract: zns.fixedPricer.address,
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
    await zns.meowToken.connect(rootOwner).approve(zns.treasury.address, ethers.constants.MaxUint256);

    rootHashDirect = await registrationWithSetup({
      zns,
      user: rootOwner,
      domainLabel: "rootdirect",
      fullConfig: {
        distrConfig: {
          accessType: AccessType.OPEN,
          pricerContract: zns.curvePricer.address,
          paymentType: PaymentType.DIRECT,
        },
        paymentConfig: {
          token: zns.meowToken.address,
          beneficiary: rootOwner.address,
        },
        priceConfig: DEFAULT_PRICE_CONFIG,
      },
    });

    // TODO sub fee: add cases for subs under this !
    // rootHashStake = await registrationWithSetup({
    //   zns,
    //   user: rootOwner,
    //   domainLabel: "rootstake",
    //   fullConfig: {
    //     distrConfig: {
    //       accessType: AccessType.OPEN,
    //       pricerContract: zns.curvePricer.address,
    //       paymentConfig: {
    //         token: zns.zeroToken.address,
    //         beneficiary: rootOwner.address,
    //         paymentType: PaymentType.STAKE,
    //       },
    //     },
    //     priceConfig: {
    //       price: BigInt(ethers.parseEther("1375.612")),
    //       feePercentage: BigInt(0),
    //     },
    //   },
    // });

    fs.existsSync(gasCostFile) || fs.writeFileSync(gasCostFile, JSON.stringify({}));
  });

  it("Root Domain Price", async function () {
    // approve
    await zns.meowToken.connect(rootOwner).approve(zns.treasury.address, ethers.constants.MaxUint256);
    // register root domain
    const tx = await zns.rootRegistrar.connect(rootOwner).registerRootDomain(
      "root",
      rootOwner.address,
      DEFAULT_TOKEN_URI,
      config
    );

    const { gasUsed } = await tx.wait();

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
    await zns.meowToken.connect(lvl2SubOwner).approve(zns.treasury.address, ethers.constants.MaxUint256);
    // register subdomain
    const tx = await zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
      rootHashDirect,
      "subdomain",
      lvl2SubOwner.address,
      DEFAULT_TOKEN_URI,
      config,
    );
    const { gasUsed } = await tx.wait();

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
