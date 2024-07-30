import { znsNames } from "../../deploy/missions/contracts/names";
import {
  ZNSCurvePricer,
  ZNSFixedPricer,
} from "../../../typechain";
import * as hre from "hardhat";
import { getZNS } from "./zns-contract-data.ts";
import { dbVersion } from "./database.ts";


export const getDomainRecord = async (
  domainHash : string,
) => {
  // TODO mig: rework all these calls to cache the contracts if needed!
  const { registry } = await getZNS({
    dbVersion,
  });

  return registry.getDomainRecord(domainHash);
};

export const getDistributionConfig = async (
  domainHash : string
) => {
  const { subRegistrar } = await getZNS({
    dbVersion,
  });

  return subRegistrar.distrConfigs(domainHash);
};

export const getPaymentConfig = async (
  domainHash : string
) => {
  const { treasury } = await getZNS({
    dbVersion,
  });

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
  const { resolver } = await getZNS({
    dbVersion,
  });

  return resolver.resolveDomainAddress(domainHash);
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
  const { rootRegistrar } = await getZNS({
    dbVersion,
  });

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