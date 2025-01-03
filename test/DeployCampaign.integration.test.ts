import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getConfig } from "../src/deploy/campaign/environments";
import { getLogger } from "../src/deploy/logger/create-logger";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { IDeployCampaignConfig, TZNSContractState } from "../src/deploy/campaign/types";
import { ethers } from "ethers";
import { IDistributionConfig } from "./helpers/types";
import { expect } from "chai";
import { hashDomainLabel, PaymentType, AccessType } from "./helpers";
import {
  approveBulk,
  getPriceBulk,
  mintBulk,
  registerRootDomainBulk,
  registerSubdomainBulk,
} from "./helpers/deploy-helpers";
import { Defender } from "@openzeppelin/defender-sdk";

describe("DeployCampaign - Integration", () => {
  // Minters
  let deployAdmin : SignerWithAddress;
  let zeroVault : SignerWithAddress;
  let userA : SignerWithAddress;
  let userB : SignerWithAddress;
  let userC : SignerWithAddress;
  let userD : SignerWithAddress;
  let userE : SignerWithAddress;
  let userF : SignerWithAddress;

  let config : IDeployCampaignConfig;

  let zns : TZNSContractState;
  // let mongoAdapter : MongoDBAdapter;

  let users : Array<SignerWithAddress>;
  let distConfig : IDistributionConfig;

  const logger = getLogger();

  // Default baselength is 4, maxLength is 50
  const shortDomain = "mazz"; // Length 4
  const mediumDomain = "mesder"; // Length 6
  const longDomain = "mesderwilderwilderwilderwilderwilderwilderwilderwil"; // Length 51
  const shortHash = hashDomainLabel(shortDomain);
  const mediumHash = hashDomainLabel(mediumDomain);
  const longHash = hashDomainLabel(longDomain);

  const freeShortSubdomain = "pubj"; // Length 4
  const freeMediumSubdomain = "pubjer"; // Length 6
  const freeLongSubdomain = "pubjerwilderwilderwilderwilderwilderwilderwilderwil"; // Length 51

  const paidShortSubdomain = "purf"; // Length 4
  const paidMediumSubdomain = "purfer"; // Length 6
  const paidLongSubdomain = "purferwilderwilderwilderwilderwilderwilderwilderwil"; // Length 51

  // Resolve subdomain hashes through async call `hashWithParent` in `before` hook
  let freeShortSubHash : string;
  let freeMediumSubHash : string;
  let freeLongSubHash : string;
  let paidShortSubHash : string;
  let paidMediumSubHash : string;
  let paidLongSubHash : string;

  const mintAmount = ethers.parseEther("10000000");

  const domains = [shortDomain, mediumDomain, longDomain];

  before(async () => {
    [ deployAdmin, zeroVault, userA, userB, userC, userD, userE, userF ] = await hre.ethers.getSigners();

    // let deployer;
    // let provider;

    // if (hre.network.name === "hardhat") {
    //   deployer = deployAdmin;
    //   provider = new hre.ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    // } else {
    //   const credentials = {
    //     apiKey: process.env.DEFENDER_KEY,
    //     apiSecret: process.env.DEFENDER_SECRET,
    //     relayerApiKey: process.env.RELAYER_KEY,
    //     relayerApiSecret: process.env.RELAYER_SECRET,
    //   };
    //
    //   const client = new Defender(credentials);
    //   provider = client.relaySigner.getProvider();
    //   deployer = client.relaySigner.getSigner(provider, { speed: "fast" });
    // }


    config = await getConfig({
      deployer: deployAdmin,
      zeroVaultAddress: zeroVault.address,
    });

    // config.mockMeowToken = hre.network.name === "hardhat";

    // First run the `run-campaign` script, then modify the `MONGO_DB_VERSION` environment variable
    // Then run this test. The campaign won't be run, but those addresses will be picked up from the DB
    const campaign = await runZnsCampaign({ config });

    // TODO the zns.zeroVaultAddress is not set internally by the treasury, fix this
    // because not new deployment?
    // Using config.zeroVaultAddress in funcs for now, which is set properly
    zns = campaign.state.contracts;

    // Surprised this typing works for signer of tx
    // await zns.treasury.connect(deployer as unknown as Signer)
    // .setBeneficiary(ethers.ZeroHash, config.zeroVaultAddress);

    //  CurvePricer, stake, open
    distConfig = {
      pricerContract: await zns.curvePricer.getAddress(),
      paymentType: PaymentType.STAKE,
      accessType: AccessType.OPEN,
    };

    users = [
      userA,
      userB,
      userC,
      userD,
      userE,
      userF,
    ];

    freeShortSubHash = await zns.subRegistrar.hashWithParent(shortHash, freeShortSubdomain);
    freeMediumSubHash = await zns.subRegistrar.hashWithParent(mediumHash, freeMediumSubdomain);
    freeLongSubHash = await zns.subRegistrar.hashWithParent(longHash, freeLongSubdomain);
    console.log(`HASH HASH HASH: ${freeLongSubHash}`);
    paidShortSubHash = await zns.subRegistrar.hashWithParent(shortHash, paidShortSubdomain);
    paidMediumSubHash = await zns.subRegistrar.hashWithParent(mediumHash, paidMediumSubdomain);
    paidLongSubHash = await zns.subRegistrar.hashWithParent(longHash, paidLongSubdomain);

    // Give the user funds
    if (config.mockMeowToken) {
      await mintBulk(
        users,
        mintAmount,
        zns
      );
    }

    await approveBulk(users, zns);
  });

  it("Successfully mints TLDs with varying length", async () => {
    // Confirm the domains are available
    expect(await zns.registry.exists(shortHash)).to.be.false;
    expect(await zns.registry.exists(mediumHash)).to.be.false;
    expect(await zns.registry.exists(longHash)).to.be.false;

    // Get domain prices, including stake and protocol fee
    const [priceShort, priceMedium, priceLong] = await getPriceBulk(domains, zns);

    logger.info(`Price of ${shortDomain} is ${priceShort.toString()}`);
    logger.info(`Price of ${mediumDomain} is ${priceMedium.toString()}`);
    logger.info(`Price of ${longDomain} is ${priceLong.toString()}`);

    // 1. Register root domains
    // Note that this calls `setPriceConfig` internally for each TLD minted so we can also mint subdomains
    await registerRootDomainBulk(
      users,
      domains,
      config, // domainAddress
      "https://zns.domains/", // tokenUri
      distConfig,
      config.rootPriceConfig,
      zns,
      logger
    );

    logger.info(`Domain ${shortHash} registered for user ${userA.address}`);
    logger.info(`Domain ${mediumHash} registered for user ${userB.address}`);
    logger.info(`Domain ${longHash} registered for user ${userC.address}`);
  });

  it("Mints subdomains with varying length for free as the owner of parent domain", async () => {
    // Get price of subdomains
    const parents = [shortHash, mediumHash, longHash];
    const subdomains = [freeShortSubdomain, freeMediumSubdomain, freeLongSubdomain];

    expect(await zns.registry.exists(freeShortSubHash)).to.be.false;
    expect(await zns.registry.exists(freeMediumSubHash)).to.be.false;
    expect(await zns.registry.exists(freeLongSubHash)).to.be.false;

    const subdomainHashes = [
      freeShortSubHash,
      freeMediumSubHash,
      freeLongSubHash,
    ];

    // 2. Register subdomains
    await registerSubdomainBulk(
      users,
      parents,
      subdomains,
      subdomainHashes,
      config.zeroVaultAddress,
      "https://zns.domains/",
      distConfig,
      zns,
      logger
    );

    logger.info(`Subdomain ${freeShortSubHash} registered for user ${userA.address}`);
    logger.info(`Subdomain ${freeMediumSubHash} registered for user ${userB.address}`);
    logger.info(`Subdomain ${freeLongSubHash} registered for user ${userC.address}`);
  });

  it("Mints subdomains with varying length for a cost", async () => {
    // Get price of subdomains
    const parents = [shortHash, mediumHash, longHash];
    const subdomains = [paidShortSubdomain, paidMediumSubdomain, paidLongSubdomain];

    const balancePromises =  [
      zns.meowToken.balanceOf(userD.address),
      zns.meowToken.balanceOf(userE.address),
      zns.meowToken.balanceOf(userF.address),
    ];

    const [
      balanceBeforeD,
      balanceBeforeE,
      balanceBeforeF,
    ]= await Promise.all(balancePromises);

    const [
      priceShort,
      priceMedium,
      priceLong,
    ] = await getPriceBulk(subdomains, zns, parents);

    const subdomainHashes = [
      paidShortSubHash,
      paidMediumSubHash,
      paidLongSubHash,
    ];

    expect(await zns.registry.exists(paidShortSubHash)).to.be.false;
    expect(await zns.registry.exists(paidMediumSubHash)).to.be.false;
    expect(await zns.registry.exists(paidLongSubHash)).to.be.false;

    // 2. Register subdomains
    await registerSubdomainBulk(
      [userD, userE, userF],
      parents,
      subdomains,
      subdomainHashes,
      config.zeroVaultAddress,
      "https://zns.domains/",
      distConfig,
      zns,
      logger
    );

    const balanceAfterPromises =  [
      zns.meowToken.balanceOf(userD.address),
      zns.meowToken.balanceOf(userE.address),
      zns.meowToken.balanceOf(userF.address),
    ];

    const [
      balanceAfterD,
      balanceAfterE,
      balanceAfterF,
    ]= await Promise.all(balanceAfterPromises);

    // Owners of parent domains can mint subdomains for free
    expect(balanceAfterD).to.eq(balanceBeforeD - priceShort);
    expect(balanceAfterE).to.eq(balanceBeforeE - priceMedium);
    expect(balanceAfterF).to.eq(balanceBeforeF - priceLong);

    logger.info(`Subdomain ${freeShortSubHash} registered for user ${userA.address}`);
    logger.info(`Subdomain ${freeMediumSubHash} registered for user ${userB.address}`);
    logger.info(`Subdomain ${freeLongSubHash} registered for user ${userC.address}`);
  });

  // Checkpoint here, ran other three consecutively and it was successful
  it("Revokes a domain correctly", async () => {
    // 3. Revoke domain
    // internal promise error somewhere? issue reading 'any'?
    const tx = await zns.rootRegistrar.connect(userA).revokeDomain(freeShortSubHash);

    if (hre.network.name !== "hardhat") await tx.wait(1);

    await expect(tx).to.emit(zns.rootRegistrar, "DomainRevoked").withArgs(freeShortSubHash, userA.address, false);
    logger.info(
      "info",
      `Subdomain ${freeShortSubHash} revoked by user ${userA.address}`
    );
  });

  it("Reclaims a domain correctly", async () => {
    // 4. Reclaim domain
    const tx = await zns.registry.connect(userB).updateDomainOwner(freeMediumSubHash, userA.address);
    logger.info(
      `Subdomain ${freeMediumSubHash} ownership given to user ${userA.address} from user ${userB.address}`
    );

    if (hre.network.name !== "hardhat") await tx.wait(1);

    const tx1 = await zns.rootRegistrar.connect(userB).reclaimDomain(freeMediumSubHash);

    if (hre.network.name !== "hardhat") await tx1.wait(1);

    await expect(tx1).to.emit(zns.rootRegistrar, "DomainReclaimed").withArgs(freeMediumSubHash, userB.address);
    expect(await zns.registry.getDomainOwner(freeMediumSubHash)).to.equal(userB.address);

    logger.info(`Subdomain ${freeMediumSubHash} reclaimed by user ${userB.address} from user ${userA.address}`);
  });

  it.only("Reclaims then revokes correctly", async () => {
    // 5. Reclaim and revoke domain
    // let tx = await zns.registry.connect(userC).updateDomainOwner(freeLongSubHash, userA.address);
    // if (hre.network.name !== "hardhat") tx = await tx.wait(2);
    // await expect(tx).to.emit(zns.registry, "DomainOwnerSet").withArgs(freeLongSubHash, userA.address);
    // logger.info(`Subdomain ${freeLongSubHash} ownership given to user ${userA.address} from user ${userC.address}`);
    //
    // if (hre.network.name !== "hardhat") await tx.wait(1);

    // let tx1 = await zns.rootRegistrar.connect(userC).reclaimDomain(freeLongSubHash);
    // if (hre.network.name !== "hardhat") tx1 = await tx1.wait(1);
    // await expect(tx1).to.emit(zns.rootRegistrar, "DomainReclaimed").withArgs(freeLongSubHash, userC.address);
    // if (hre.network.name !== "hardhat") await tx1.wait(1);

    // logger.info(`Subdomain ${freeLongSubHash} reclaimed by user ${userC.address}`);
    expect(await zns.registry.getDomainOwner(freeLongSubHash)).to.equal(userC.address);

    const tx2 = await zns.rootRegistrar.connect(userC).revokeDomain(freeLongSubHash);
    if (hre.network.name !== "hardhat") await tx2.wait(1);

    await expect(tx2).to.emit(zns.rootRegistrar, "DomainRevoked").withArgs(freeLongSubHash, userC.address, false);
    logger.info(`Subdomain ${freeLongSubHash} revoked by user ${userC.address}`);
  });
});
