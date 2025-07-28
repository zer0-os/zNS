import { znsNames } from "../../deploy/missions/contracts/names";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getZNSFromDB } from "./database";
import {
  ZNSAccessController__factory,
  ZNSRegistry__factory,
  ZNSAddressResolver__factory,
  ZNSCurvePricer__factory,
  ZNSDomainToken__factory,
  ZNSFixedPricer__factory,
  ZNSRootRegistrar__factory,
  ZNSSubRegistrar__factory,
  ZNSTreasury__factory,
  ERC20Mock__factory,
  ZNSStringResolver__factory,
} from "../../../typechain/index";
import { IZNSContracts } from "../../deploy/campaign/types";

let znsCache : IZNSContracts | null = null;

export const getZNS = async (
  signer : SignerWithAddress,
) : Promise<IZNSContracts> => {
  if (!znsCache || Object.values(znsCache).length < 10) {
    const zns = await getZNSFromDB();

    // Get each contract and manually connect to a factory.
    // Using `getContractFactory()` returns an incorrect type of factory here
    const acAddress = zns.find(contract => contract.name === znsNames.accessController.contract);
    const regAddress = zns.find(contract => contract.name === znsNames.registry.contract);
    const domainTokenAddress = zns.find(contract => contract.name === znsNames.domainToken.contract);
    const addressResolverAddress = zns.find(contract => contract.name === znsNames.addressResolver.contract);
    const stringResolverAddress = zns.find(contract => contract.name === znsNames.stringResolver.contract);
    const curvePricerAddress = zns.find(contract => contract.name === znsNames.curvePricer.contract);
    const treasuryAddress = zns.find(contract => contract.name === znsNames.treasury.contract);
    const rootRegistrarAddress = zns.find(contract => contract.name === znsNames.rootRegistrar.contract);
    const fixedPricerAddress = zns.find(contract => contract.name === znsNames.fixedPricer.contract);
    const subRegistrarAddress = zns.find(contract => contract.name === znsNames.subRegistrar.contract);
    const meowTokenAddress = zns.find(contract => contract.name === znsNames.meowToken.contractMock);

    znsCache = {
      accessController: ZNSAccessController__factory.connect(acAddress?.address, signer),
      registry: ZNSRegistry__factory.connect(regAddress?.address, signer),
      domainToken: ZNSDomainToken__factory.connect(domainTokenAddress?.address, signer),
      meowToken: ERC20Mock__factory.connect(meowTokenAddress?.address, signer),
      addressResolver: ZNSAddressResolver__factory.connect(addressResolverAddress?.address, signer),
      stringResolver: ZNSStringResolver__factory.connect(stringResolverAddress?.address, signer),
      curvePricer: ZNSCurvePricer__factory.connect(curvePricerAddress?.address, signer),
      treasury: ZNSTreasury__factory.connect(treasuryAddress?.address, signer),
      rootRegistrar: ZNSRootRegistrar__factory.connect(rootRegistrarAddress?.address, signer),
      fixedPricer: ZNSFixedPricer__factory.connect(fixedPricerAddress?.address, signer),
      subRegistrar: ZNSSubRegistrar__factory.connect(subRegistrarAddress?.address, signer),
    };
  }

  return znsCache;
};