import { IDistributionConfig, ZNSContracts } from "../helpers/types";
import * as hre from "hardhat";
import { AccessType, deployZNS, PaymentType, priceConfigDefault } from "../helpers";
import * as ethers from "ethers";
import { registrationWithSetup } from "../helpers/register-setup";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import fs from "fs";


const gasCostFile = `${process.cwd()}/test/gas/gas-costs.json`;


// TODO sub: add more tests here for each tx with different configs
//  so we can track gas changes better when developing
describe.only("Transaction Gas Costs Test", () => {
  let deployer : SignerWithAddress;
  let rootOwner : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let lvl2SubOwner : SignerWithAddress;
  let zeroVault : SignerWithAddress;

  let zns : ZNSContracts;

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
      priceConfig: priceConfigDefault,
      zeroVaultAddress: zeroVault.address,
    });

    await zns.priceOracle.connect(deployer).setPriceConfig(ethers.constants.HashZero, priceConfigDefault);

    config = {
      pricingContract: zns.fixedPricing.address,
      paymentType: PaymentType.DIRECT,
      accessType: AccessType.OPEN,
    };

    // Give funds to users
    await Promise.all(
      [
        rootOwner,
        lvl2SubOwner,
      ].map(async ({ address }) =>
        zns.zeroToken.mint(address, ethers.utils.parseEther("1000000")))
    );
    await zns.zeroToken.connect(rootOwner).approve(zns.treasury.address, ethers.constants.MaxUint256);

    rootHashDirect = await registrationWithSetup({
      zns,
      user: rootOwner,
      domainLabel: "rootdirect",
      fullConfig: {
        distrConfig: {
          accessType: AccessType.OPEN,
          // TODO sub data: the original val was zns.asPricing.address
          pricingContract: zns.priceOracle.address,
          paymentType: PaymentType.DIRECT,
        },
        paymentConfig: {
          paymentToken: zns.zeroToken.address,
          beneficiary: rootOwner.address,
        },
        priceConfig: priceConfigDefault,
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
    //       pricingContract: zns.asPricing.address,
    //       paymentConfig: {
    //         paymentToken: zns.zeroToken.address,
    //         beneficiary: rootOwner.address,
    //         paymentType: PaymentType.STAKE,
    //       },
    //     },
    //     priceConfig: {
    //       price: BigNumber.from(ethers.utils.parseEther("1375.612")),
    //       feePercentage: BigNumber.from(0),
    //     },
    //   },
    // });

    fs.existsSync(gasCostFile) || fs.writeFileSync(gasCostFile, JSON.stringify({}));
  });

  it("Root Domain Price", async function () {
    // approve
    await zns.zeroToken.connect(rootOwner).approve(zns.treasury.address, ethers.constants.MaxUint256);
    // register root domain
    const tx = await zns.registrar.connect(rootOwner).registerDomain(
      "root",
      rootOwner.address,
      config
    );

    const { gasUsed } = await tx.wait();

    const previous = JSON.parse(
      fs.readFileSync(gasCostFile, "utf8")
    );

    const title = this.test ? this.test.title : "! Title Not Found - Check Test Context !";
    const prevGas = previous[title];

    let gasDiff = BigNumber.from(0);
    if (prevGas) {
      gasDiff = gasUsed.sub(BigNumber.from(prevGas));
    }

    console.log(`
      Root Domain Price:
        Gas Used: ${gasUsed.toString()}
        Gas Diff: ${gasDiff.toString()}
      `);

    if (gasDiff.gt(1000) || gasDiff.lt(-1000)) {
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
    await zns.zeroToken.connect(lvl2SubOwner).approve(zns.treasury.address, ethers.constants.MaxUint256);
    // register subdomain
    const tx = await zns.subdomainRegistrar.connect(lvl2SubOwner).registerSubdomain(
      rootHashDirect,
      "subdomain",
      lvl2SubOwner.address,
      config,
    );
    const { gasUsed } = await tx.wait();

    const previous = JSON.parse(
      fs.readFileSync(gasCostFile, "utf8")
    );

    const title = this.test ? this.test.title : "! Title Not Found - Check Test Context !";

    const prevGas = previous[title];
    let gasDiff = BigNumber.from(0);
    if (prevGas) {
      gasDiff = gasUsed.sub(BigNumber.from(prevGas));
    }

    console.log(`
      Subdomain Price:
        Gas Used: ${gasUsed.toString()}
        Gas Diff: ${gasDiff.toString()}
      `);

    if (gasDiff.gt(1000) || gasDiff.lt(-1000)) {
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
