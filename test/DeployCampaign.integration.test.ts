import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getConfig } from "../src/deploy/campaign/get-config";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { ethers } from "ethers";
import { IDistributionConfig } from "./helpers/types";
import { expect } from "chai";
import { hashDomainLabel, PaymentType, AccessType, DEFAULT_CURVE_PRICE_CONFIG_BYTES } from "./helpers";
import {
  approveBulk,
  getPriceBulk,
  mintBulk,
  registerRootDomainBulk,
  registerSubdomainBulk,
} from "./helpers/deploy-helpers";
import { IZNSCampaignConfig, IZNSContracts } from "../src/deploy/campaign/types";
import { getZnsLogger } from "../src/deploy/get-logger";


describe("zNS + zDC Single Integration Test", () => {
  // Minters
  let deployAdmin : SignerWithAddress;
  let zeroVault : SignerWithAddress;
  let userA : SignerWithAddress;
  let userB : SignerWithAddress;
  let userC : SignerWithAddress;
  let userD : SignerWithAddress;
  let userE : SignerWithAddress;
  let userF : SignerWithAddress;

  let config : IZNSCampaignConfig;

  let zns : IZNSContracts;
  // let mongoAdapter : MongoDBAdapter;

  let users : Array<SignerWithAddress>;
  let distConfig : IDistributionConfig;

  const logger = getZnsLogger();

  // Default baselength is 4, maxLength is 50
  const shortDomain = "mazzz"; // Length 4
  const mediumDomain = "messder"; // Length 6
  const longDomain = "mesderwilderwilderwilderwilderwilderwilderwilderwill"; // Length 51
  const shortHash = hashDomainLabel(shortDomain);
  const mediumHash = hashDomainLabel(mediumDomain);
  const longHash = hashDomainLabel(longDomain);

  const freeShortSubdomain = "pubjj"; // Length 4
  const freeMediumSubdomain = "pubjjer"; // Length 6
  const freeLongSubdomain = "pubjerwilderwilderwilderwilderwilderwilderwilderwilj"; // Length 51

  const paidShortSubdomain = "purff"; // Length 4
  const paidMediumSubdomain = "purffer"; // Length 6
  const paidLongSubdomain = "purferwilderwilderwilderwilderwilderwilderwilderwilf"; // Length 51

  // Resolve subdomain hashes through async call `hashWithParent` in `before` hook
  let freeShortSubHash : string;
  let freeMediumSubHash : string;
  let freeLongSubHash : string;
  let paidShortSubHash : string;
  let paidMediumSubHash : string;
  let paidLongSubHash : string;

  const mintAmount = ethers.parseEther("10000000");

  const domains = [shortDomain, mediumDomain, longDomain];

  const confirmationsN = Number(process.env.CONFIRMATION_N);

  before(async () => {
    [ deployAdmin, zeroVault, userA, userB, userC, userD, userE, userF ] = await hre.ethers.getSigners();

    // Reads `ENV_LEVEL` environment variable to determine rules to be enforced

    config = await getConfig({
      deployer: deployAdmin,
      zeroVaultAddress: zeroVault.address,
    });

    // First run the `run-campaign` script, then modify the `MONGO_DB_VERSION` environment variable
    // Then run this test. The campaign won't be run, but those addresses will be picked up from the DB
    const campaign = await runZnsCampaign({ config });

    // Using config.zeroVaultAddress in funcs for now, which is set properly
    zns = campaign.state.contracts;

    //  CurvePricer, stake, open
    distConfig = {
      pricerContract: await zns.curvePricer.getAddress(),
      priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
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
    paidShortSubHash = await zns.subRegistrar.hashWithParent(shortHash, paidShortSubdomain);
    paidMediumSubHash = await zns.subRegistrar.hashWithParent(mediumHash, paidMediumSubdomain);
    paidLongSubHash = await zns.subRegistrar.hashWithParent(longHash, paidLongSubdomain);

    await approveBulk(users, zns);

    // Give the user funds
    if (config.mockMeowToken) {
      await mintBulk(
        users,
        mintAmount,
        zns
      );
    }
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
      zns,
      logger,
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

    if (hre.network.name !== "hardhat") await tx.wait(confirmationsN);

    await expect(tx).to.emit(zns.rootRegistrar, "DomainRevoked").withArgs(freeShortSubHash, userA.address, false);
    logger.info(
      "info",
      `Subdomain ${freeShortSubHash} revoked by user ${userA.address}`
    );
  });

  it("Reclaims a domain correctly by assigning token back to hash owner", async () => {
    // 4. Reclaim domain
    const tx = await zns.registry.connect(userB).updateDomainOwner(freeMediumSubHash, userA.address);
    logger.info(
      `Subdomain ${freeMediumSubHash} ownership given to user ${userA.address} from user ${userB.address}`
    );

    if (hre.network.name !== "hardhat") await tx.wait(confirmationsN);

    const tx1 = await zns.rootRegistrar.connect(userA).assignDomainToken(freeMediumSubHash, userA.address);

    if (hre.network.name !== "hardhat") await tx1.wait(confirmationsN);

    await expect(tx1).to.emit(zns.rootRegistrar, "DomainTokenReassigned").withArgs(freeMediumSubHash, userA.address);
    expect(await zns.domainToken.ownerOf(freeMediumSubHash)).to.equal(userA.address);

    logger.info(`Subdomain token ${freeMediumSubHash} reclaimed by user ${userA.address} from user ${userB.address}`);
  });

  it("Revokes the domain correctly", async () => {
    // 5. Reclaim and revoke domain
    const tx = await zns.registry.connect(userC).updateDomainOwner(freeLongSubHash, userA.address);
    await expect(tx).to.emit(zns.registry, "DomainOwnerSet").withArgs(freeLongSubHash, userA.address);
    logger.info(`Subdomain ${freeLongSubHash} ownership given to user ${userA.address} from user ${userC.address}`);

    if (hre.network.name !== "hardhat") await tx.wait(confirmationsN);

    const tx2 = await zns.rootRegistrar.connect(userA).revokeDomain(freeLongSubHash);
    if (hre.network.name !== "hardhat") await tx2.wait(confirmationsN);

    expect(await zns.registry.exists(freeLongSubHash)).to.be.false;

    await expect(tx2).to.emit(zns.rootRegistrar, "DomainRevoked").withArgs(freeLongSubHash, userA.address, false);
    logger.info(`Subdomain ${freeLongSubHash} revoked by user ${userA.address}`);
  });
});
