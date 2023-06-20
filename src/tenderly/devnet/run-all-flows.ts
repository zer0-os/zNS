import * as hre from "hardhat";
import * as ethers from "ethers";
import { deployZNS, hashDomainLabel } from "../../../test/helpers";
import { BigNumber } from "ethers";


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
    logAddresses: true,
  });

  // get some funds for the user
  await zns.zeroToken.connect(user).approve(zns.treasury.address, ethers.constants.MaxUint256);
  await zns.zeroToken.transfer(user.address, ethers.utils.parseEther("15"));

  // Register Domain
  await zns.registrar.connect(governor).registerDomain(
    domainName,
    user.address,
  );

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
