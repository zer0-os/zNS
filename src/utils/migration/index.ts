import * as hre from "hardhat";
import { createProvider } from "hardhat/internal/core/providers/construction";
import { createClient, getDomains } from "./subgraph/client";
import { Domain, SubgraphError } from "./types";
import { validateDomain } from "./subgraph/validate";

import { registerRootDomain } from "./registration";
import * as fs from "fs";
import { validateDomains } from "./subgraph";
import { getConfig } from "../../deploy/campaign/environments";
import { runZnsCampaign } from "../../deploy/zns-campaign";
import { deployZNS } from "../../../test/helpers";

const main = async () => {
  const [admin] = await hre.ethers.getSigners();

  // First, validate domain data from subgraph against mainnet
  const { validDomains, invalidDomains } = await validateDomains(admin, 1, 0);

  // If there are errors, log them to a file for triage
  if (invalidDomains.length > 0) {
    fs.writeFileSync("invalid-domains.json", JSON.stringify(invalidDomains, null, 2));
    // exit?
  }
  
  let action; // TODO have set by migration level
  let zns; // TODO figure out where to put this flow
  let mongoAdapter;
  if (process.env.MIGRATION_LEVEL === "local") {

    // Reset the network to stop forking from mainnet
    // Use the `runZnsCampaign` function to deploy locally
    // then call to register rootdomain / subdomain from here
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [],
    });

    const [migrationAdmin, zeroVault, governor, admin ] = await hre.ethers.getSigners();

    const params = {
      deployer: migrationAdmin,
      governorAddresses: [migrationAdmin.address, governor.address],
      adminAddresses: [migrationAdmin.address, admin.address],
    };
    zns = await deployZNS(params);

    // "Bad data" errors from ZDC ?
    // const campaign = await runZnsCampaign({
    //   config,
    // });

    await zns.meowToken.connect(migrationAdmin).approve(
      await zns.treasury.getAddress(),
      hre.ethers.MaxUint256
    );

    // migration admin should get balance for being deployer
    console.log(`balanceOf: ${await zns.meowToken.balanceOf(migrationAdmin.address)}`);

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
    // could use "runZnsCampaign" from tests to deploy?

  } else if (process.env.MIGRATION_LEVEL === "dev") {
    // TODO implement and verify
    // Modify network dynamically to use sepolia things
    // We have several ZNS instances on sepolia already
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

  // await registerRootDomain(registerParams);
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});