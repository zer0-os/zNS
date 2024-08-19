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

  const events = await zns.rootRegistrar.queryFilter(filter, 6532288);
  console.log("eventsLength ", events.length);

  const mostRecentEvent = events[events.length - 1];
  console.log("most recent event ", mostRecentEvent);

  if (mostRecentEvent.args) {
    return mostRecentEvent.args.domainHash;
  } else {
    throw new Error("no event data?")
  }
};