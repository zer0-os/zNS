import {
  accessControllerName, addressResolverName,
  deployZNS, domainTokenName, priceOracleName, registrarName, registryName, treasuryName, zeroTokenMockName,
} from "../../test/helpers";
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


  const names = [
    accessControllerName,
    registryName,
    domainTokenName,
    zeroTokenMockName,
    addressResolverName,
    priceOracleName,
    treasuryName,
    registrarName,
  ];

  // // Verify and add source code to Tenderly
  // // for easy debugging
  await Object.entries(zns).reduce(
    async (acc, [key, contract]) : Promise<object> => {
      const name = names.find(
        el => el.toLowerCase()
          .includes(key.toLowerCase())
      ) as string;

      await hre.tenderly.verify({
        name,
        address: contract.address,
      });

      await hre.tenderly.persistArtifacts({
        name,
        address: contract.address,
      });

      return acc;
    }, Promise.resolve({})
  );

  return zns;
};
