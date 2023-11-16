import * as hre from "hardhat";
import * as ethers from "ethers";
import { BigNumber } from "ethers";
import {
  deployZNS,
  hashDomainLabel, PaymentType,
  DEFAULT_PRICE_CONFIG,
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
      pricerContract: zns.fixedPricer.address,
      paymentType: PaymentType.STAKE,
      accessType: 1,
    },
    paymentConfig: {
      token: zns.meowToken.address,
      beneficiary: governor.address,
    },
    priceConfig: {
      price: rootPrice,
      feePercentage: rootFeePercentage,
    },
  };

  // get some funds and approve funds for treasury
  await zns.meowToken.connect(governor).approve(zns.treasury.address, ethers.constants.MaxUint256);

  const rootHash = await registrationWithSetup({
    zns,
    user: governor,
    domainLabel: domainName,
    fullConfig: fullRootConfig,
  });

  const subdomainLabel = "subdomain";
  const fullSubConfig = {
    distrConfig: {
      pricerContract: zns.curvePricer.address,
      paymentType: PaymentType.DIRECT,
      accessType: 1,
    },
    paymentConfig: {
      token: zns.meowToken.address,
      beneficiary: user.address,
    },
    priceConfig: DEFAULT_PRICE_CONFIG,
  };

  await zns.meowToken.transfer(user.address, ethers.utils.parseEther("10000"));
  await zns.meowToken.connect(user).approve(zns.treasury.address, ethers.constants.MaxUint256);

  await registrationWithSetup({
    zns,
    user,
    parentHash: rootHash,
    domainLabel: subdomainLabel,
    fullConfig: fullSubConfig,
  });

  // Transfer Domain
  await zns.domainToken.connect(governor).transferFrom(governor.address, user.address, tokenId);

  // Reclaim Domain
  await zns.rootRegistrar.connect(user).reclaimDomain(domainHash);

  // Revoke Domain
  await zns.rootRegistrar.connect(user).revokeDomain(domainHash);
};


runAllFlows()
  .then(() => process.exit(0))
  .catch(error => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
