import { SafeKit } from "./safeKit";
import { CreateBatchesResponse, Domain } from "./types";
import { createBatches } from "./helpers";


export const proposeRegistrations = async (
  to : string,
  safeKit : SafeKit,
  domains : Array<Domain>,
  selector : string
) => {
  const [ registrations, transfers ] = createBatches(
    domains,
    selector,
  ) as CreateBatchesResponse;

  // Create proposals for registering domains
  await safeKit.createProposeSignedTxs(
    to,
    registrations
  );

  // To avoid iterating domains multiple times, we get transfers as well
  // and store them for later use
  return transfers;
};
