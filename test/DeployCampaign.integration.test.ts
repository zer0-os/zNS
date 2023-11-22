import * as hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { getConfig } from "../src/deploy/campaign/environments";
import { getLogger } from "../src/deploy/logger/create-logger";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { IDeployCampaignConfig, TZNSContractState } from "../src/deploy/campaign/types";
import { ethers } from "ethers";
import { IDistributionConfig } from "./helpers/types";
import { expect } from "chai";
import { hashDomainLabel } from "./helpers";
import {
  approveBulk,
  getPriceBulk,
  mintBulk,
  registerRootDomainBulk,
  registerSubdomainBulk,
} from "./helpers/deploy-helpers";

describe("DeployCampaign - Integration", () => {
  let deployer : SignerWithAddress;
  let zeroVault : SignerWithAddress;
  let domainAddressMock : SignerWithAddress;

  // Minters
  let userA : SignerWithAddress;
  let userB : SignerWithAddress;
  let userC : SignerWithAddress;

  let zns : TZNSContractState;

  let config : IDeployCampaignConfig;

  const logger = getLogger();

  before(async () => {
    [deployer, zeroVault, domainAddressMock, userA, userB, userC] = await hre.ethers.getSigners();

    // Reads `ENV_LEVEL` environment variable to determine rules to be enforced
    config = getConfig(deployer, zeroVault);

    config.mockMeowToken = hre.network.name === "hardhat";
    const campaign = await runZnsCampaign({ config, dbVersion: "1.0.0" });

    zns = campaign.state.contracts;

    const users = [
      userA,
      userB,
      userC,
    ];

    await approveBulk(users, zns);

    // Give the user funds
    if (config.mockMeowToken) {
      await mintBulk(
        users,
        ethers.utils.parseEther("10000000"),
        zns
      );
    }
  });

  it("Runs crucial flows", async () => {
    // Default baselength is 4, maxLength is 50
    const shortDomain = "wild"; // Length 4
    const mediumDomain = "wilder"; // Length 6
    const longDomain = "wilderwilderwilderwilderwilderwilderwilderwilderwil"; // Length 51

    const domains = [shortDomain, mediumDomain, longDomain];
    const users = [userA, userB, userC];

    const shortHash = hashDomainLabel(shortDomain);
    const mediumHash = hashDomainLabel(mediumDomain);
    const longHash = hashDomainLabel(longDomain);

    expect(await zns.registry.exists(shortHash)).to.be.false;
    expect(await zns.registry.exists(mediumHash)).to.be.false;
    expect(await zns.registry.exists(longHash)).to.be.false;

    // Get domain prices
    const [priceShort, priceMedium, priceLong] = await getPriceBulk(domains, zns);

    logger.log("info", `Price of ${shortDomain} is ${priceShort.toString()}`);
    logger.log("info", `Price of ${mediumDomain} is ${priceMedium.toString()}`);
    logger.log("info", `Price of ${longDomain} is ${priceLong.toString()}`);

    const distConfig : IDistributionConfig = {
      pricerContract: zns.curvePricer.address,
      paymentType: 1,
      accessType: 1,
    };

    // 1. Register root domains
    await registerRootDomainBulk(
      users,
      domains,
      domainAddressMock.address,
      "https://zns.domains/", // tokenUri
      distConfig,
      config.rootPriceConfig,
      zns
    );

    logger.log("info", `Domain ${shortHash} registered for user ${userA.address}`);
    logger.log("info", `Domain ${mediumHash} registered for user ${userB.address}`);
    logger.log("info", `Domain ${longHash} registered for user ${userC.address}`);

    // Get price of subdomains
    const shortSubdomain = "subd"; // Length 4
    const mediumSubdomain = "subder"; // Length 6
    const longSubdomain = "subderwilderwilderwilderwilderwilderwilderwilderwil"; // Length 51

    const parents = [shortHash, mediumHash, longHash];
    const subdomains = [shortSubdomain, mediumSubdomain, longSubdomain];

    const [priceSubShort, priceSubMedium, priceSubLong] = await getPriceBulk(domains, zns, parents);

    logger.log("info", `Price of ${shortSubdomain} is ${priceSubShort.toString()}`);
    logger.log("info", `Price of ${mediumSubdomain} is ${priceSubMedium.toString()}`);
    logger.log("info", `Price of ${longSubdomain} is ${priceSubLong.toString()}`);

    const shortSubHash = await zns.subRegistrar.hashWithParent(shortHash, shortSubdomain);
    const mediumSubHash = await zns.subRegistrar.hashWithParent(mediumHash, mediumSubdomain);
    const longSubHash = await zns.subRegistrar.hashWithParent(longHash, longSubdomain);

    expect(await zns.registry.exists(shortSubHash)).to.be.false;
    expect(await zns.registry.exists(mediumSubHash)).to.be.false;
    expect(await zns.registry.exists(longSubHash)).to.be.false;

    // 2. Register subdomains
    await registerSubdomainBulk(
      users,
      parents,
      subdomains,
      domainAddressMock.address,
      "https://zns.domains/",
      distConfig,
      zns
    );

    logger.log("info", `Subdomain ${shortSubHash} registered for user ${userA.address}`);
    logger.log("info", `Subdomain ${mediumSubHash} registered for user ${userB.address}`);
    logger.log("info", `Subdomain ${longSubHash} registered for user ${userC.address}`);

    // 3. Revoke domain
    const tx = zns.rootRegistrar.connect(userA).revokeDomain(shortSubHash);
    await expect(tx).to.emit(zns.rootRegistrar, "DomainRevoked").withArgs(shortSubHash, userA.address, false);
    logger.log(
      "info",
      `Subdomain ${shortSubHash} revoked by user ${userA.address}`
    );


    // 4. Reclaim domain
    await zns.registry.connect(userB).updateDomainOwner(mediumSubHash, userA.address);
    logger.log(
      "info",
      `Subdomain ${mediumSubHash} ownership given to user ${userA.address} from user ${userB.address}`
    );

    const tx1 = zns.rootRegistrar.connect(userB).reclaimDomain(mediumSubHash);
    await expect(tx1).to.emit(zns.rootRegistrar, "DomainReclaimed").withArgs(mediumSubHash, userB.address);
    expect(await zns.registry.getDomainOwner(mediumSubHash)).to.equal(userB.address);
    logger.log("info", `Subdomain ${mediumSubHash} reclaimed by user ${userB.address} from user ${userA.address}`);


    // 5. Reclaim and revoke domain
    await zns.registry.connect(userC).updateDomainOwner(longSubHash, userA.address);
    logger.log("info", `Subdomain ${longSubHash} ownership given to user ${userA.address} from user ${userC.address}`);

    const tx2 = await zns.rootRegistrar.connect(userC).reclaimDomain(longSubHash);
    logger.log("info", `Subdomain ${longSubHash} reclaimed by user ${userC.address} from user ${userA.address}`);

    await expect(tx2).to.emit(zns.rootRegistrar, "DomainReclaimed").withArgs(longSubHash, userC.address);
    expect(await zns.registry.getDomainOwner(longSubHash)).to.equal(userC.address);

    const tx3 = zns.rootRegistrar.connect(userC).revokeDomain(longSubHash);
    await expect(tx3).to.emit(zns.rootRegistrar, "DomainRevoked").withArgs(longSubHash, userC.address, false);
    logger.log("info", `Subdomain ${longSubHash} revoked by user ${userC.address}`);
  });
});
