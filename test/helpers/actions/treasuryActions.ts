import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSTreasury } from "../../../typechain";
import { hashDomainName } from "../hashing";

export const treasuryActions = async (
  treasury : ZNSTreasury,
  domainName : string,
  accounts : Array<SignerWithAddress>
) => {
  const [deployer, mockRegistrar] = [...accounts.values()];

  const domainHash = hashDomainName(domainName);

  await treasury.connect(mockRegistrar).stakeForDomain(
    domainHash,
    domainName,
    deployer.address,
    true
  );

  return treasuryPromises(treasury, domainHash);
};

export const treasuryPromises = async (
  treasury : ZNSTreasury,
  domainName : string,
) => {
  const domainHash = hashDomainName(domainName);

  const calls = [
    treasury.priceOracle(),
    treasury.stakingToken(),
    treasury.zeroVault(),
    treasury.stakedForDomain(domainHash),
  ];

  return Promise.all(calls);
};