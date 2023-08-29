import * as hre from "hardhat";
import * as ethers from "ethers";
import { BigNumber } from "ethers";
import {
  deployZNS,
  hashDomainLabel, PaymentType,
  priceConfigDefault,
} from "../../../test/helpers";
import { registrationWithSetup } from "../../../test/helpers/register-setup";


const domainName = "wilder";
const domainHash = hashDomainLabel(domainName);
const tokenId = BigNumber.from(domainHash);


export const runAllFlows = async () => {
  const [
    governor,
    user,
  ] = await hre.ethers.getSigners();

  const zns = await deployZNS({
    deployer: governor,
    governorAddresses: [governor.address],
    adminAddresses: [governor.address],
    isTenderlyRun: true,
  });

  const rootPrice = BigNumber.from(ethers.utils.parseEther("200"));
  const rootFeePercentage = BigNumber.from(250);

  const fullRootConfig = {
    distrConfig: {
      pricingContract: zns.fixedPricing.address,
      paymentConfig: {
        paymentType: PaymentType.STAKE,
        paymentToken: zns.zeroToken.address,
        beneficiary: governor.address,
      },
      accessType: 1,
    },
    priceConfig: {
      price: rootPrice,
      feePercentage: rootFeePercentage,
    },
  };

  // get some funds and approve funds for treasury
  await zns.zeroToken.connect(governor).approve(zns.treasury.address, ethers.constants.MaxUint256);

  const rootHash = await registrationWithSetup({
    zns,
    user: governor,
    domainLabel: domainName,
    fullConfig: fullRootConfig,
    isRootDomain: true,
  });

  const subdomainLabel = "subdomain";
  const fullSubConfig = {
    distrConfig: {
      pricingContract: zns.asPricing.address,
      paymentConfig: {
        paymentType: PaymentType.DIRECT,
        paymentToken: zns.zeroToken.address,
        beneficiary: user.address,
      },
      accessType: 1,
    },
    priceConfig: priceConfigDefault,
  };

  await zns.zeroToken.transfer(user.address, ethers.utils.parseEther("10000"));
  await zns.zeroToken.connect(user).approve(zns.treasury.address, ethers.constants.MaxUint256);

  await registrationWithSetup({
    zns,
    user,
    parentHash: rootHash,
    domainLabel: subdomainLabel,
    fullConfig: fullSubConfig,
    isRootDomain: false,
  });

  // TODO sub:
  // - original root reg: 339,104 gas
  // - current root reg: 405,831 gas (with config set) - 408,489 (with new payment logic) - 339,235 gas (without config)
  // - current sub reg: 341,144 gas (with config) - 412,897 gas (with new payment logic)

  // Transfer Domain
  await zns.domainToken.connect(governor).transferFrom(governor.address, user.address, tokenId);

  // Reclaim Domain
  await zns.registrar.connect(user).reclaimDomain(domainHash);

  // Revoke Domain
  await zns.registrar.connect(user).revokeDomain(domainHash);
};


runAllFlows()
  .then(() => process.exit(0))
  .catch(error => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
