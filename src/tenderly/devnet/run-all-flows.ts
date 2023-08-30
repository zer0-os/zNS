import * as hre from "hardhat";
import * as ethers from "ethers";
import { BigNumber } from "ethers";
import {
  deployZNS,
  hashDomainLabel, priceConfigDefault,
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

  const fullRootConfig = {
    distrConfig: {
      pricingContract: zns.fixedPricing.address,
      paymentContract: zns.directPayment.address,
      accessType: 1,
    },
    priceConfig: rootPrice,
    paymentConfig: {
      paymentToken: zns.zeroToken.address,
      beneficiary: governor.address,
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
      paymentContract: zns.stakePayment.address,
      accessType: 1,
    },
    priceConfig: priceConfigDefault,
    paymentConfig: {
      paymentToken: zns.zeroToken.address,
      beneficiary: user.address,
    },
  };

  await zns.zeroToken.transfer(user.address, ethers.utils.parseEther("10000"));
  await zns.zeroToken.connect(user).approve(fullRootConfig.distrConfig.paymentContract, ethers.constants.MaxUint256);

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
  // - current root reg: 409,429 gas (with config set) - 339,235 gas (without config)
  // - current sub reg: 339,377 gas

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
