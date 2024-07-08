import * as hre from "hardhat";
import { getConfig } from "../src/deploy/campaign/environments";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import * as ethers from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSContracts } from "../src/deploy/campaign/types";
import { MongoDBAdapter } from "@zero-tech/zdc";
import {
  AC_UNAUTHORIZED_ERR,
  AccessType,
  ADMIN_ROLE, PARENT_LOCKED_NOT_EXIST_ERR,
  hashDomainLabel,
  normalizeName,
  NOT_AUTHORIZED_ERR,
  PaymentType,
} from "./helpers";
import { IDistributionConfig } from "./helpers/types";
import { expect } from "chai";
import { ZeroAddress } from "ethers";
import { getDomainHashFromEvent } from "./helpers/events";


describe.only("Domain Migration Test", () => {
  let deployer : SignerWithAddress;
  let user : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let randomUser : SignerWithAddress;

  let zns : IZNSContracts;
  let zeroVault : SignerWithAddress;
  let operator : SignerWithAddress;
  let userBalanceInitial : bigint;

  let mongoAdapter : MongoDBAdapter;

  const tokenURI = "https://example.com/817c64af";
  let rootDistrConfig : IDistributionConfig;

  const defaultDomain = normalizeName("wilder");
  let rootDomainHash : string;

  before(async () => {
    // zeroVault address is used to hold the fee charged to the user when registering
    [deployer, zeroVault, user, operator, governor, admin, randomUser] = await hre.ethers.getSigners();

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

    mongoAdapter = campaign.dbAdapter;

    await zns.meowToken.connect(deployer).approve(
      await zns.treasury.getAddress(),
      ethers.MaxUint256
    );

    userBalanceInitial = ethers.parseEther("1000000000000000000");
    // Give funds to user
    await zns.meowToken.connect(user).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
    await zns.meowToken.mint(user.address, userBalanceInitial);
    // Give funds to admin
    await zns.meowToken.connect(admin).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
    await zns.meowToken.mint(admin.address, userBalanceInitial);

    rootDistrConfig = {
      pricerContract: await zns.curvePricer.getAddress(),
      paymentType: PaymentType.STAKE,
      accessType: AccessType.LOCKED,
    };
  });

  after(async () => {
    await mongoAdapter.dropDB();
  });

  it("Should NOT let non Zero Admin account to register ROOT domains", async () => {
    // try registering from user address
    await expect(
      zns.rootRegistrar.connect(user).registerRootDomain(
        defaultDomain,
        ZeroAddress,
        tokenURI,
        rootDistrConfig,
        {
          token: await zns.meowToken.getAddress(),
          beneficiary: user.address,
        }
      )
    ).to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
      .withArgs(user.address, ADMIN_ROLE);
  });

  it("Should let Zero Admin to register root domain", async () => {
    rootDomainHash = hashDomainLabel(defaultDomain);

    // try registering from zero admin address
    await zns.rootRegistrar.connect(admin).registerRootDomain(
      defaultDomain,
      ZeroAddress,
      tokenURI,
      rootDistrConfig,
      {
        token: await zns.meowToken.getAddress(),
        beneficiary: user.address,
      }
    );

    // check domain existence
    const owner = await zns.registry.getDomainOwner(rootDomainHash);
    expect(owner).to.be.equal(admin.address);
  });

  it("Should NOT let non Zero Admin account to register SUB domains", async () => {
    const subdomainLabel = normalizeName("sub");

    // try registering from user address
    await expect(
      zns.subRegistrar.connect(user).registerSubdomain(
        rootDomainHash,
        subdomainLabel,
        ZeroAddress,
        `${tokenURI}/sub`,
        rootDistrConfig,
        {
          token: await zns.meowToken.getAddress(),
          beneficiary: user.address,
        }
      )
    ).to.be.revertedWithCustomError(zns.subRegistrar, PARENT_LOCKED_NOT_EXIST_ERR)
      .withArgs(rootDomainHash);
  });

  it("Should let register SUBdomain and subdomain of subdomain from Zero Admin as a root domain owner", async () => {
    const subdomainLabel = normalizeName("sub");

    const adminBalanceBefore = await zns.meowToken.balanceOf(admin.address);

    // try registering from zero admin address
    await zns.subRegistrar.connect(admin).registerSubdomain(
      rootDomainHash,
      subdomainLabel,
      ZeroAddress,
      `${tokenURI}/sub`,
      rootDistrConfig,
      {
        token: await zns.meowToken.getAddress(),
        beneficiary: user.address,
      }
    );

    // check domain existence
    const subDomainHash = await getDomainHashFromEvent({ zns, user: admin });
    const owner = await zns.registry.getDomainOwner(subDomainHash);
    expect(owner).to.be.equal(admin.address);

    // check that no tokens were spent
    const adminBalanceAfter = await zns.meowToken.balanceOf(admin.address);
    expect(adminBalanceAfter - adminBalanceBefore).to.be.equal(0n);

    // register subdomain of subdomain
    await zns.subRegistrar.connect(admin).registerSubdomain(
      subDomainHash,
      `${subdomainLabel}-subb`,
      ZeroAddress,
      `${tokenURI}/sub2`,
      rootDistrConfig,
      {
        token: await zns.meowToken.getAddress(),
        beneficiary: user.address,
      }
    );

    const subSubDomainHash = await getDomainHashFromEvent({ zns, user: admin });
    const subSubOwner = await zns.registry.getDomainOwner(subSubDomainHash);
    expect(subSubOwner).to.be.equal(admin.address);
  });

  // TODO mig: test cases:
  // 1. Register subdomain for free by the same owner
  // 2. Send domain token to user
  // 3. Upgrade back to the RootRegistrar that is unlocked
  // 4. User reclaims the full domain and can manage distribution and sell subs
  // 5. New users can register new domains of every level
});