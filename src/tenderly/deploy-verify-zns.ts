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

  // const contractsArr = await Object.entries(zns).reduce(
  //   async (acc, [key, contract]) : Promise<Array<asdasd>> => {
  //     const newAcc = await acc;
  //     const name = names.find(
  //       el => el.toLowerCase()
  //         .includes(key.toLowerCase())
  //     ) as string;
  //
  //     const impl = await contract.implementation();
  //
  //     const curObj = {
  //       proxy: contract.address,
  //       impl: impl.address,
  //       name,
  //     };
  //
  //     return [...newAcc, curObj];
  //   } , Promise.resolve([])
  // );

  // const names = [
  //   accessControllerName,
  //   registryName,
  //   domainTokenName,
  //   zeroTokenMockName,
  //   addressResolverName,
  //   priceOracleName,
  //   treasuryName,
  //   registrarName,
  // ];


  // testing manually one contract at a time
  // here is a try for proxy - no errors, but nothing is pushed
  await hre.tenderly.verify({
    name: "ERC1967Proxy",
    address: zns.domainToken.address,
  });

  await hre.tenderly.persistArtifacts({
    name: "ERC1967Proxy",
    address: zns.domainToken.address,
  });

  // get "Error: Contract at <address> doesn't look like an ERC 1967 proxy with a logic contract address"
  // Why??
  const implAddress = await hre.upgrades.erc1967.getImplementationAddress(zns.domainToken.address);

  await hre.tenderly.verify({
    name: domainTokenName,
    address: implAddress,
  });

  await hre.tenderly.persistArtifacts({
    name: domainTokenName,
    address: implAddress,
  });

  // // Verify and add source code to Tenderly
  // // for easy debugging
  // await Object.entries(zns).reduce(
  //   async (acc, [key, contract]) : Promise<object> => {
  //     await hre.tenderly.verify({
  //       name,
  //       address: contract.address,
  //     });
  //
  //     await hre.tenderly.persistArtifacts({
  //       name,
  //       address: contract.address,
  //     });
  //
  //     return acc;
  //   }, Promise.resolve({})
  // );

  return zns;
};
