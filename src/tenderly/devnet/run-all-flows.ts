import * as hre from "hardhat";
import * as ethers from "ethers";
import {
  deployZNS,
  hashDomainLabel, PaymentType,
  AccessType,
  IFullDistributionConfig,
  encodePriceConfig,
  DEFAULT_CURVE_PRICE_CONFIG_BYTES,
  IRegisterWithSetupArgs,
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

  const fullRootConfig : IFullDistributionConfig = {
    distrConfig: {
      pricerContract: await zns.fixedPricer.getAddress(),
      priceConfig: encodePriceConfig({ price: rootPrice, feePercentage: rootFeePercentage }),
      paymentType: PaymentType.STAKE,
      accessType: AccessType.OPEN,
    },
    paymentConfig: {
      token: await zns.meowToken.getAddress(),
      beneficiary: governor.address,
    },
  };

  // get some funds and approve funds for treasury
  await zns.meowToken.connect(governor).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

  const rootHash = await registrationWithSetup({
    zns,
    tokenOwner: governor.address,
    user: governor,
    domainLabel: domainName,
    fullConfig: fullRootConfig,
  });

  const subdomainLabel = "subdomain";
  const fullSubConfig : IFullDistributionConfig = {
    distrConfig: {
      pricerContract: await zns.curvePricer.getAddress(),
      priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
      paymentType: PaymentType.DIRECT,
      accessType: AccessType.OPEN,
    },
    paymentConfig: {
      token: await zns.meowToken.getAddress(),
      beneficiary: user.address,
    },
  };

  await zns.meowToken.transfer(user.address, ethers.parseEther("10000"));
  await zns.meowToken.connect(user).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

  await registrationWithSetup({
    zns,
    user,
    tokenOwner: user.address,
    parentHash: rootHash,
    domainLabel: subdomainLabel,
    fullConfig: fullSubConfig,
  } as IRegisterWithSetupArgs);

  // Transfer Domain
  await zns.domainToken.connect(governor).transferFrom(governor.address, user.address, tokenId);

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
