import { znsNames } from "../../deploy/missions/contracts/names";
import {
  ZNSAddressResolver,
  ZNSCurvePricer,
  ZNSFixedPricer,
  ZNSRegistry,
  ZNSRootRegistrar,
  ZNSSubRegistrar,
  ZNSTreasury,
} from "../../../typechain";
import * as hre from "hardhat";
import { getMongoAdapter } from "@zero-tech/zdc";


export const getDomainRecord = async (
  domainHash : string,
) => {
  const registry = await getContract(znsNames.registry.contract) as ZNSRegistry;

  return registry.getDomainRecord(domainHash);
};

export const getDistributionConfig = async (
  domainHash : string
) => {
  const subRegistrar = await getContract(znsNames.subRegistrar.contract) as ZNSSubRegistrar;

  return subRegistrar.distrConfigs(domainHash);
};

export const getPaymentConfig = async (
  domainHash : string
) => {
  const treasury = await getContract(znsNames.treasury.contract) as ZNSTreasury;

  return treasury.paymentConfigs(domainHash);
};

export const getPriceConfig = async (
  domainHash : string
) => {
  const { pricerContract } = await getDistributionConfig(domainHash);

  const curveFactory = await hre.ethers.getContractFactory(znsNames.curvePricer.contract);
  const fixedFactory = await hre.ethers.getContractFactory(znsNames.fixedPricer.contract);

  try {
    const curvePricer = curveFactory.attach(pricerContract) as ZNSCurvePricer;
    return curvePricer.priceConfigs(domainHash);
  } catch (e) {
    const fixedPricer = fixedFactory.attach(pricerContract) as ZNSFixedPricer;
    return fixedPricer.priceConfigs(domainHash);
  }
};

export const getDomainAddress = async (domainHash : string) => {
  const resolver = await getContract(znsNames.addressResolver.contract) as ZNSAddressResolver;

  return resolver.resolveDomainAddress(domainHash);
};

export const getContract = async (name : string, version ?: string) => {
  const dbAdapter = await getMongoAdapter();

  const contract = await dbAdapter.getContract(
    name,
    version,
  );
  if (!contract) throw new Error("Contract not found in DB. Check name or version passed.");

  const factory = await hre.ethers.getContractFactory(name);
  if (!factory) throw new Error("Invalid contract name or db name is different than contract name");

  return factory.attach(contract.address);
};

export const getEventDomainHash = async ({
  label,
  tokenUri,
  registrantAddress,
} : {
  label : string;
  tokenUri : string;
  registrantAddress : string;
}) => {
  const rootRegistrar = await getContract(znsNames.rootRegistrar.contract) as ZNSRootRegistrar;

  const filter = rootRegistrar.filters.DomainRegistered(
    hre.ethers.ZeroHash,
    undefined,
    label,
    undefined,
    tokenUri,
    registrantAddress,
    undefined,
  );

  const events = await rootRegistrar.queryFilter(filter);
  const { args: { domainHash } } = events[events.length - 1];

  return domainHash;
};