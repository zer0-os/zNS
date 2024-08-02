import { znsNames } from "../../deploy/missions/contracts/names.ts";
import { IZNSContracts } from "../../deploy/campaign/types.ts";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getContractFromDB, getZNSFromDB } from "./database.ts";

import * as hre from "hardhat";
import {
  ZNSAccessController,
  ZNSRegistry,
  ZNSDomainToken,
  MeowTokenMock,
  ZNSAddressResolver,
  ZNSCurvePricer,
  ZNSTreasury,
  ZNSRootRegistrar,
  ZNSFixedPricer,
  ZNSSubRegistrar,
  Initializable__factory
} from "../../../typechain/index.ts";

let znsCache : IZNSContracts | null = null;

export const getZNSMeowChain = async (
  signer : SignerWithAddress,
  dbVersion : string,
) => {

}

export const getZNS = async ({
  signer,
  action = "read" // Must be "read" or "write"
} : {
  signer ?: SignerWithAddress;
  action : string;
}) => {
  if (!znsCache || Object.values(znsCache).length < 10) {
    const zns = await getZNSFromDB();

    zns.forEach(async (contract) => { console.log(contract.name)});

    // zns.forEach(async (contract) => {
    //   const factory = await hre.ethers.getContractFactory(contract.name, signer)
    //   // const factory = await hre.ethers.getContractFactory(contract.name, signer);
    //   const instance = factory.attach(contract.address);
    //   console.log(instance);
    
    const acFromDb = zns.find((contract) => contract.name === znsNames.accessController.contract);
    const reg = zns.find((contract) => contract.name === znsNames.registry.contract);
    
    const acFactory : Initializable__factory = await hre.ethers.getContractFactory(acFromDb!.name, signer);
    const regFactory : Initializable__factory = await hre.ethers.getContractFactory(reg!.name, signer);

    // const regContract = regFactory.connect(reg!.address) as ZNSRegistry;
    // const acContract = acFactory.connect(acFromDb!.address) as ZNSAccessController;
    // });

    // console.log(`is acContract nukk? : ${Object.keys(acContract)}`);
    // console.log(`is acContract nukk? : ${Object.values(acContract)}`);

    znsCache = {
      accessController: zns.find((contract) => contract.name === znsNames.accessController.contract) as unknown as ZNSAccessController,
      registry: zns.find((contract) => contract.name === znsNames.registry.contract) as unknown as ZNSRegistry,
      domainToken: zns.find((contract) => contract.name === znsNames.domainToken.contract) as unknown as ZNSDomainToken,
      meowToken: zns.find((contract) => contract.name === znsNames.meowToken.contract) as unknown as MeowTokenMock,
      addressResolver: zns.find((contract) => contract.name === znsNames.addressResolver.contract) as unknown as ZNSAddressResolver,
      curvePricer: zns.find((contract) => contract.name === znsNames.curvePricer.contract) as unknown as ZNSCurvePricer,
      treasury: zns.find((contract) => contract.name === znsNames.treasury.contract) as unknown as ZNSTreasury,
      rootRegistrar: zns.find((contract) => contract.name === znsNames.rootRegistrar.contract) as unknown as ZNSRootRegistrar,
      fixedPricer: zns.find((contract) => contract.name === znsNames.fixedPricer.contract) as unknown as ZNSFixedPricer,
      subRegistrar: zns.find((contract) => contract.name === znsNames.subRegistrar.contract) as unknown as ZNSSubRegistrar,
    }
    
    // console.log(znsCache.accessController.add);
    // const znsCache = await Object.entries(znsNames).reduce(
    // znsCache = await Object.entries(znsNames).reduce(
    //   async (acc : Promise<IZNSContracts>, [key, { contract, instance }]) => {
    //     const newAcc = await acc;

    //     // TODO ignore meow token for now, not in DB if not mainnet
    //     // && !== "meowToken" or "meowTokenMock"
    //     if (key !== "erc1967Proxy") {
    //       // newAcc[instance] = await getContractFromDB({
    //       //   name: contract,
    //       //   signer,
    //       //   action
    //       // });
    //     }

    //     return newAcc;
    //   }, Promise.resolve({} as IZNSContracts)
    // );
  }

  return znsCache;
};

// TODO mig: below is test logic to make sure we pull correct data from DB.
//  REMOVE THIS WHEN DONE !!!
//  Currently the `initialize()` method on DB adapter is called always, creating a new `version` object!
//  So be careful running this with the prod URI! We need a read-only access for this case and ONLY connect that way!
//  Otherwise we can mess up the current Prod Mainnet Database!
// const getContracts = async () => {
//   const contracts = await getZNS({
//     dbVersion: process.env.MONGO_DB_VERSION ?? "1703976278937", // current Mainnet DEPLOYED version we need to read from
//   });

//   console.log(contracts);
// };

// getContracts()
//   .then(() => process.exit(0))
//   .catch(err => {
//     console.error(err);
//     process.exit(1);
//   });
