import * as hre from "hardhat";
import { deployZNS, DeployZNSParams } from "../../../test/helpers";
import { ROOT_COLL_NAME, ROOT_DOMAIN_BULK_SELECTOR, SUB_COLL_NAME, SUBDOMAIN_BULK_SELECTOR } from "./constants";

import { Domain, IRootDomainRegistrationArgs, ISubdomainRegisterArgs } from "./types";
import { ZeroAddress, ZeroHash } from "ethers";

import { connectToDb, createBatches } from "./helpers";
import { ZNSRootRegistrar, ZNSRootRegistrar__factory } from "../../../typechain";

const main = async () => {
  const [ migrationAdmin ] = await hre.ethers.getSigners();

  const client = await connectToDb();
  
  const rootDomains = await client.collection(ROOT_COLL_NAME).find().toArray() as unknown as Domain[];
  const subdomains = await client.collection(SUB_COLL_NAME).find().sort({ depth: 1, _id: 1}).toArray() as unknown as Domain[];
  
  // TODO for testing, get from DB when zns is deployed on zchain
  // const params : DeployZNSParams = {
  //   deployer: migrationAdmin,
  //   governorAddresses: [migrationAdmin.address],
  //   adminAddresses: [migrationAdmin.address],
  // };

  // const zns = await deployZNS(params);

  const rootTxs = createBatches(rootDomains, ROOT_DOMAIN_BULK_SELECTOR) as IRootDomainRegistrationArgs[][];
  const subTxs = createBatches(subdomains, SUBDOMAIN_BULK_SELECTOR) as ISubdomainRegisterArgs[][];

  let count = 0;
  // Send each batch
  console.log("Sending root domain registrations...");
  
  const rootFactory = new ZNSRootRegistrar__factory(migrationAdmin);
  const rootReg = rootFactory.attach("0xbe15446794E0cEBEC370d00d301A72cb75068838") as ZNSRootRegistrar;

  const d = rootDomains[0];

  const registerTx =  rootReg.connect(migrationAdmin).registerRootDomainBulk(
    [
      {
        name: d.label,
        domainAddress: d.address,
        tokenOwner: d.owner.id,
        tokenURI: d.tokenURI,
        distrConfig: {
          pricerContract: ZeroAddress,
          paymentType: 0n,
          accessType: 0n,
        },
        paymentConfig: {
          token: ZeroAddress,
          beneficiary: ZeroAddress,
        },
      }
    ]
  );

  // await registerTx.wait(hre.network.name === "hardhat" ? 0 : 3);
  process.exit(0);
  for(let tx of rootTxs) {
    

    // Wait for network confirmations
    await registerTx.wait(hre.network.name === "hardhat" ? 0 : 3);
    count++;

    if (count % 10 === 0) {
      console.log(`Processed ${count} root domain batches...`);
    }
  }

  count = 0;
  console.log("Sending subdomain registrations...");
  for(let tx of subTxs) {
    const registerTx = await zns.subRegistrar.connect(migrationAdmin).registerSubdomainBulk(tx);

    // Wait for network confirmations
    await registerTx.wait(hre.network.name === "hardhat" ? 0 : 3);
    count++;
    if (count % 10 === 0) {
      console.log(`Processed ${count} subdomain batches...`);
    }
  }

  // Transfer all domains
  count = 0;
  console.log("Sending transfers...");
  for (let domain of [...rootDomains, ...subdomains]) {
    const transferTx = await zns.domainToken.connect(migrationAdmin).transferFrom(
      migrationAdmin.address,
      domain.owner.id,
      domain.tokenId,
    );

    // Wait for network confirmation to avoid overloading
    await transferTx.wait(hre.network.name === "hardhat" ? 0 : 3);

    count++;
    if (count % 10 === 0) {
      console.log(`Processed ${count} domain transfers...`);
    }
  }

  console.log("Done!");

  process.exit(0);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

// const createBatches = ( // TODO helper? different internal workings based on logic though
//   domains : Array<Domain>,
//   sliceSize : number = 50
// ) : Array<Array<IRootDomainRegistrationArgs | ISubdomainRegisterArgs>> => {
//   let txArgs : Array<IRootDomainRegistrationArgs | ISubdomainRegisterArgs> = [];
//   const batchTxs : Array<Array<IRootDomainRegistrationArgs | ISubdomainRegisterArgs>> = [];

//   // Create batch txs for root domains
//   let count = 0;
//   for (const domain of domains) {
//     let domainArg : Partial<IRootDomainRegistrationArgs | ISubdomainRegisterArgs> = {
//       domainAddress: domain.address,
//       tokenOwner: domain.owner.id,
//       tokenURI: domain.tokenURI,
//       distrConfig: {
//         pricerContract: ZeroAddress,
//         paymentType: 0n,
//         accessType: 0n,
//       },
//       paymentConfig: {
//         token: ZeroAddress,
//         beneficiary: ZeroAddress,
//       }
//     }

//     // "label" is parameter name for subdomain registration, "name" for root domains
//     // but "label" is used for both in the subgraph
//     if (domain.parentHash !== ZeroHash) {
//       domainArg = { parentHash: domain.parentHash, label: domain.label, ...domainArg };
//       txArgs.push(domainArg as ISubdomainRegisterArgs);
//     } else {
//       domainArg = { name: domain.label, ...domainArg };
//       txArgs.push(domainArg as IRootDomainRegistrationArgs);
//     }

//     if (txArgs.length % sliceSize === 0) {
//       batchTxs.push(txArgs);
//       txArgs = [];
//     }

//     count++;
//   }

//   return batchTxs;
// }