import { SafeKit } from "./safeKit"
import { Domain } from "./types";
import { createBatches } from "./helpers";

// TODO WHEN RETURN
// break apart subs by depth, ensure proposals
// for depth 2 or 3 are not sent until depth 1 is executed
// track how many batches are 1,2,3
export const proposeRegisterDomains = async (
  to : string,
  safeKit : SafeKit,
  domains : Array<Domain>,
  selector : string
) => {
  console.log("Creating domain registration batches...");
  const [ batches, transfers ] = createBatches(
    domains,
    selector,
  ) as [ string[], [ string[] ] ];

  // Create proposals for registering domains
  await safeKit.createProposeSignedTxs(
    to,
    batches
  );

  // To avoid iterating domains multiple times, we get transfers as well
  // and store them for later use
  return transfers;
}
