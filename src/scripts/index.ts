
import { createClient, getWorlds } from "./subgraph"; // fails probably
import {
  QUERY_URL_DEV,
  REGISTRY_ADDR
} from "./constants";

import { ZNSRegistry, ZNSRegistry__factory } from "../../typechain/index";
import { Domain } from "./types";
import { validate } from "./validate";

// todo helper function(s) in other file

async function main() {
  const client = createClient(QUERY_URL_DEV);
  const worlds: Array<Domain> = await getWorlds(client);

  // TODO top level 0x0 domain has a subdomain count of -72?
  // TODO counter or progress on screen to track for bigger run
  // why is this happening, and does it matter?
  for (const world of worlds) {
    // console.log(`Validating world ${world.id}`);
    await validate(world);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});