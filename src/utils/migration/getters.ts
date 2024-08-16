import { IZNSContractsLocal } from "../../../test/helpers/types";
import { IZNSContracts } from "../../deploy/campaign/types";

export const getEventDomainHash = async ({
  registrantAddress,
  zns,
} : {
  registrantAddress : string;
  zns : IZNSContractsLocal | IZNSContracts;
}) => {
  const filter = zns.rootRegistrar.filters.DomainRegistered(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    registrantAddress,
    undefined,
  );

  const events = await zns.rootRegistrar.queryFilter(filter);
  const { args: { domainHash } } = events[events.length - 1];

  return domainHash;
};