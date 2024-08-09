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
  Initializable__factory,
  ZNSAccessController__factory,
  ZNSRegistry__factory,
  MeowTokenMock__factory,
  ZNSAddressResolver__factory,
  ZNSCurvePricer__factory,
  ZNSDomainToken__factory,
  ZNSFixedPricer__factory,
  ZNSRootRegistrar__factory,
  ZNSSubRegistrar__factory,
  ZNSTreasury__factory
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

    // Tried using a smart method with `getContractFactory(znsNames)` but results in a type 
    // of contract factory that cannot be connected properly to an existing contract.
    const acAddress = zns.find((contract) => contract.name === znsNames.accessController.contract);
    const regAddress = zns.find((contract) => contract.name === znsNames.registry.contract);
    const domainTokenAddress = zns.find((contract) => contract.name === znsNames.domainToken.contract);
    const meowTokenAddress = zns.find((contract) => contract.name === znsNames.meowToken.contract); // fails
    const addressResolverAddress = zns.find((contract) => contract.name === znsNames.addressResolver.contract);
    const curvePricerAddress = zns.find((contract) => contract.name === znsNames.curvePricer.contract);
    const treasuryAddress = zns.find((contract) => contract.name === znsNames.treasury.contract);
    const rootRegistrarAddress = zns.find((contract) => contract.name === znsNames.rootRegistrar.contract);
    const fixedPricerAddress = zns.find((contract) => contract.name === znsNames.fixedPricer.contract);
    const subRegistrarAddress = zns.find((contract) => contract.name === znsNames.subRegistrar.contract);

    znsCache = {
      accessController: ZNSAccessController__factory.connect(acAddress!.address, signer),
      registry: ZNSRegistry__factory.connect(regAddress!.address, signer),
      domainToken: ZNSDomainToken__factory.connect(domainTokenAddress!.address, signer),
      meowToken: MeowTokenMock__factory.connect(meowTokenAddress!.address, signer),
      addressResolver: ZNSAddressResolver__factory.connect(addressResolverAddress!.address, signer),
      curvePricer: ZNSCurvePricer__factory.connect(curvePricerAddress!.address, signer),
      treasury: ZNSTreasury__factory.connect(treasuryAddress!.address, signer),
      rootRegistrar: ZNSRootRegistrar__factory.connect(rootRegistrarAddress!.address, signer),
      fixedPricer: ZNSFixedPricer__factory.connect(fixedPricerAddress!.address, signer),
      subRegistrar: ZNSSubRegistrar__factory.connect(subRegistrarAddress!.address, signer),
    }
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
