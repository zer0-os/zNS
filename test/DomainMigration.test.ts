import * as hre from "hardhat";
import { getConfig } from "../src/deploy/campaign/get-config";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { DOMAIN_TOKEN_ROLE } from "../src/deploy/constants";
import { Domain } from "../src/utils/migration/types";
import { ROOT_COLL_NAME, SUB_COLL_NAME } from "../src/utils/migration/constants";
import { distrConfigEmpty, IZNSContractsLocal, paymentConfigEmpty } from "./helpers";
import { main } from "../src/utils/migration/02_registration";
import { connectToDb } from "../src/utils/migration/helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { MongoDBAdapter } from "@zero-tech/zdc";


let deployer : SignerWithAddress;
let zeroVault : SignerWithAddress;
let user : SignerWithAddress;
let governor : SignerWithAddress;
let admin : SignerWithAddress;

let userBalanceInitial : bigint;

let zns : IZNSContractsLocal;
let mongoAdapter : MongoDBAdapter;

let domains : Array<Domain>;
let rootsToRevoke;
let subsToRevoke;

describe.only("Domain Migration", () => {
  before(async () => {
    // set it up because it needs to be passed manually,
    //  since we use two different MongoDB clusters and one of them is on chain
    // process.env.MONGO_DB_VERSION = Date.now().toString();

    [deployer, zeroVault, user, governor, admin] = await hre.ethers.getSigners();

    const config = await getConfig({
      deployer,
      zeroVaultAddress: zeroVault.address,
      governors: [deployer.address, governor.address],
      admins: [deployer.address, admin.address],
    });

    const campaign = await runZnsCampaign({
      config,
    });

    zns = campaign.state.contracts;

    await zns.accessController.connect(deployer).grantRole(DOMAIN_TOKEN_ROLE, await zns.domainToken.getAddress());

    mongoAdapter = campaign.dbAdapter;

    await zns.meowToken.connect(deployer).approve(
      await zns.treasury.getAddress(),
      hre.ethers.MaxUint256
    );

    userBalanceInitial = hre.ethers.MaxInt256;

    // Give funds to user
    await zns.meowToken.connect(deployer).approve(await zns.treasury.getAddress(), hre.ethers.MaxUint256);
    await zns.meowToken.mint(deployer.address, userBalanceInitial);

    const domainsDbClient = await connectToDb();

    rootsToRevoke = await domainsDbClient.collection(ROOT_COLL_NAME).find(
      {
        isRevoked: true,
        // "owner.id": safeAddress,
      }
    ).toArray();

    subsToRevoke = await domainsDbClient.collection(SUB_COLL_NAME).find(
      {
        isRevoked: true,
        // "owner.id": safeAddress,
      }
    ).toArray();

    domains = [ ...rootsToRevoke, ...subsToRevoke ] as unknown as Array<Domain>;

    for (const domain of rootsToRevoke) {
      await zns.rootRegistrar.connect(deployer).registerRootDomain({
        name: domain.label,
        domainAddress: domain.address,
        tokenOwner: domain.owner.id,
        tokenURI: domain.tokenURI,
        distrConfig: distrConfigEmpty,
        paymentConfig: paymentConfigEmpty,
      });
    }

    // for (const domain of subsToRevoke) {
    //   await zns.subRegistrar.connect(deployer).registerSubdomain({
    //     parentHash: domain.parentHash,
    //     label: domain.label,
    //     domainAddress: domain.address,
    //     tokenOwner: domain.owner.id,
    //     tokenURI: domain.tokenURI,
    //     distrConfig: distrConfigEmpty,
    //     paymentConfig: paymentConfigEmpty,
    //   });
    // }
  });

  it("run", async () => {
    const {
      revokeBatches,
      failedRevokes,
    } = await main();

    const tx = await deployer.sendTransaction({
      to: zns.rootRegistrar.getAddress(),
      data: hre.ethers.concat(
        revokeBatches.map(tx => tx.data)
      ),
    });

    console.log("Transaction sent:", tx.hash);
  });
});