import { createClient, getDomains, simpleQuery } from "./subgraph"; // fails probably
import {
  REGISTRY_ADDR
} from "./constants";

import { ZNSRegistry, ZNSRegistry__factory } from "../../typechain/index";
import { Domain } from "./types";
import { validate } from "./validate";

import * as fs from "fs";
// import { simpleQuery } from "./queries";

// todo helper function(s) in other file

async function main() {
  const url = process.env.SUBGRAPH_URL_DEV;

  if (!url) {
    throw new Error("Missing subgraph url");
  }

  const client = createClient(url);
  const domains: Array<Domain> = await getDomains(client);

  // lower vs upper
  const domainLower = "0xef9635db14fb8c72740dfebb28ddcd22bdef9c49ef22a2311522dc33127c2182"
  const domainUppwer = "0xEF9635DB14FB8C72740DFEBB28DDCD22BDEF9C49EF22A2311522DC33127C2182"
  // const upperLower = await simpleQuery(client, domainUppwer);

  // console.log(upperLower)
  // TODO top level 0x0 domain has a subdomain count of -72?
  // TODO counter or progress on screen to track for bigger run
  // why is this happening, and does it matter?
  let validDomains = Array<Domain>();

  for (const domain of domains) {
    // console.log(`Validating world ${world.id}`);
    await validate(domain);
    validDomains.push(domain);
  }

  // write to json
  fs.writeFileSync("valid-domains.json", JSON.stringify(validDomains, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});