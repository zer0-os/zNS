import * as hre from "hardhat";
import { createProvider } from "hardhat/internal/core/providers/construction";
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
  
  let action; // TODO have set by migration level
  if (process.env.MIGRATION_LEVEL === "local") {
    // Reset the network to fork mainnet from before any registrations occured
    // await hre.network.provider.send("hardhat_reset")

    // TODO modify structure a bit to avoid two sets of DB calls
    // If we're testing locally, we can use the same DB connection we had
    // for validation step
    // TODO if we stop forking, we have to deploy ZNS locally before recreating the data
    // if we dont stop forking, we need to have a way to give an account tons of MEOW to
    // be able to register domains
    // impersonateAccountWithBalance?
    // deploy meowTokenMock after disabling, then give self amount?
    // could use "runZnsCampaign" from tests to deploy
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.MAINNET_RPC_URL,
            blockNumber: 18901652,
          },
        },
      ],
    });
  } else if (process.env.MIGRATION_LEVEL === "dev") {
    // Modify network dynamically to use sepolia things
    const networkName = "sepolia";
    const provider = await createProvider(
      hre.config,
      networkName,
    )
    hre.network.name = networkName;
    hre.network.config = hre.config.networks[networkName];
    hre.network.provider = provider;
  } else if (process.env.MIGRATION_LEVEL === "prod") {
    // TODO implement
    // Connect to meowchain for real recreation of domain tree
  } else {
    throw new Error("Invalid migration level");
  }

  // If we can't jointly do both "read" and "write" steps together, we will
  // output validated domain data to a readable JSON file for "write" step
  // fs.writeFileSync("valid-domains.json", JSON.stringify(validDomains, null, 2));

  const testDomain = validDomains[0];

  const registerParams = {
    regAdmin: admin,
    action: "read",
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

  // call reset on chain, change things, then can do new network
  // two in parallel? evm node starts HH chain but you can pass params to it
  // start a second node in the child process  
  // local => reset HH as is and don't access meowchain
  // testnet => change to sepolia, call to register there
  // meowchain => change to meowchain, call to register there

  await registerRootDomain(registerParams);
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});