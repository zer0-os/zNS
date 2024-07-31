import * as hre from "hardhat";

import { createClient, getDomains } from "./subgraph/client";
import { Domain, SubgraphError } from "./types";
import { validateDomain } from "./validate";

import { registerRootDomain } from "./registration";
import * as fs from "fs";

const main = async () => {
  const url = process.env.SUBGRAPH_URL;

  if (!url) {
    throw new Error("Missing subgraph url");
  }

  const client = createClient(url);
  // For pagination
  let skip = 0;
  const first = 1; // TODO just for debugging, make 1000 when code is ready

  let domains : Array<Domain>;

  const validDomains = Array<Domain>();
  const invalidDomains = Array<SubgraphError>();
  let count = 0;

  const [admin] = await hre.ethers.getSigners();

  const start = Date.now();

  do {
    domains = await getDomains(client, first, skip);

    console.log(`Validating ${domains.length} domains`);

    for (const domain of domains) {

      // We only return a value when errors occur
      const invalidDomain = await validateDomain(domain, admin);

      validDomains.push(domain);
      if (invalidDomain) {
        invalidDomains.push(invalidDomain);
      }

      count++;
      if (count % 100 === 0) {
        console.log(`Validated ${count} domains`);
      }
    }

    skip += first;
  } while (false); // domains.length === first);, just to make it run once while testing

  const end = Date.now();
  console.log(`Validated ${count} domains in ${end - start}ms`);

  // If there are errors, log them to a file for triage
  if (invalidDomains.length > 0) {
    fs.writeFileSync("invalid-domains.json", JSON.stringify(invalidDomains, null, 2));
  }


  // Output validated domain data to a readable JSON file
  // fs.writeFileSync("valid-domains.json", JSON.stringify(validDomains, null, 2));
  // const testDomain = validDomains[0];
  const testDomain = validDomains[0];

  const registerParams = {
    regAdmin: admin,
    domainData: {
      parentHash: testDomain.parentHash,
      label: testDomain.label,
      domainAddress: testDomain.address,
      tokenUri: testDomain.tokenURI,
      distrConfig: {
        accessType: BigInt(testDomain.accessType ?? 0),
        paymentType: BigInt(testDomain.paymentType ?? 0),
        pricerContract: testDomain.pricerContract ?? hre.ethers.ZeroAddress,
      },
      paymentConfig: {
        token: testDomain.paymentToken.id ?? hre.ethers.ZeroAddress, // because not deployed contract vals, just strings?
        beneficiary: testDomain.treasury.beneficiaryAddress ?? hre.ethers.ZeroAddress,
      },
    }
  };

  // if not possible to change network during runtime,
  // then we write verified data to a file and use a second
  // script to read from that file and register the domains
  // using `--network meowchain` flag
  await registerRootDomain(registerParams);
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});