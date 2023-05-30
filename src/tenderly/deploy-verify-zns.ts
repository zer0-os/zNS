import { deployZNS } from "../../test/helpers";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";


export const deployVerifyZNS = async ({
  governor,
  governorAddresses = [ governor.address ],
  adminAddresses = [ governor.address ],
} : {
  governor : SignerWithAddress;
  governorAddresses ?: Array<string>;
  adminAddresses ?: Array<string>;
}) => {
  const zns = await deployZNS({
    deployer: governor,
    governorAddresses,
    adminAddresses,
  });

  // TODO: find a way to get these names from the object
  const names = [
    "ZNSAccessController",
    "ZNSRegistry",
    "ZNSDomainToken",
    "ZeroTokenMock",
    "ZNSAddressResolver",
    "ZNSPriceOracle",
    "ZNSTreasury",
    "ZNSEthRegistrar",
  ];

  // Verify and add source code to Tenderly
  // for easy debugging
  await Object.values(zns).reduce(
    async (acc, contract, idx) => {
      await hre.tenderly.verify({
        name: names[idx],
        address: contract.address,
      });

      await hre.tenderly.persistArtifacts({
        name: names[idx],
        address: contract.address,
      });
    }, Promise.resolve({})
  );

  return zns;
};
