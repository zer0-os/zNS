import * as hre from "hardhat";
import * as ethers from "ethers";
import {
  deployZNS,
  hashDomainLabel, PaymentType,
  DEFAULT_CURVE_PRICE_CONFIG,
  AccessType,
} from "../../../test/helpers";
import { registrationWithSetup } from "../../../test/helpers/register-setup";


const domainName = "wilder";
const domainHash = hashDomainLabel(domainName);
const tokenId = BigInt(domainHash);


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

  const rootPrice = BigInt(ethers.parseEther("200"));
  const rootFeePercentage = BigInt(250);

  const fullRootConfig = {
    distrConfig: {
      pricerContract: await zns.fixedPricer.getAddress(),
      paymentType: PaymentType.STAKE,
      accessType: AccessType.OPEN,
    },
    paymentConfig: {
      token: await zns.meowToken.getAddress(),
      beneficiary: governor.address,
    },
    priceConfig: {
      price: rootPrice,
      feePercentage: rootFeePercentage,
    },
  };

  // get some funds and approve funds for treasury
  await zns.meowToken.connect(governor).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

  const rootHash = await registrationWithSetup({
    zns,
    user: governor,
    domainLabel: domainName,
    fullConfig: fullRootConfig,
  });

  const subdomainLabel = "subdomain";
  const fullSubConfig = {
    distrConfig: {
      pricerContract: await zns.curvePricer.getAddress(),
      paymentType: PaymentType.DIRECT,
      accessType: AccessType.OPEN,
    },
    paymentConfig: {
      token: await zns.meowToken.getAddress(),
      beneficiary: user.address,
    },
    priceConfig: DEFAULT_CURVE_PRICE_CONFIG,
  };

  await zns.meowToken.transfer(user.address, ethers.parseEther("10000"));
  await zns.meowToken.connect(user).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

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
