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
  PaymentType,
} from "./helpers";
import { IDistributionConfig } from "./helpers/types";
import { expect } from "chai";
import { ZeroAddress } from "ethers";
import { getDomainHashFromEvent } from "./helpers/events";


describe("Domain Migration Flow Test", () => {
  let deployer : SignerWithAddress;
  let user : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let randomUser : SignerWithAddress;

  let zns : IZNSContracts;
  let zeroVault : SignerWithAddress;
  let userBalanceInitial : bigint;

  let mongoAdapter : MongoDBAdapter;

  const tokenURI = "https://example.com/817c64af";
  let rootDistrConfig : IDistributionConfig;

  const defaultDomain = normalizeName("wilder");
  let rootDomainHash : string;

  before(async () => {
    // zeroVault address is used to hold the fee charged to the user when registering
    [deployer, zeroVault, user, governor, admin, randomUser] = await hre.ethers.getSigners();

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

  // eslint-disable-next-line max-len
  it("Should upgrade RootRegistrar to the previous version with unlocked access to root domain registration", async () => {
    // get some OG state values
    const stateReads = [
      zns.rootRegistrar.registry(),
      zns.rootRegistrar.getAccessController(),
      zns.rootRegistrar.rootPricer(),
      zns.rootRegistrar.treasury(),
      zns.rootRegistrar.domainToken(),
      zns.rootRegistrar.subRegistrar(),
    ];

    const statePreUpgrade = await Promise.all(stateReads);

    // Confirm deployer has the correct role first
    expect(await zns.accessController.isGovernor(deployer.address)).to.equal(true);

    // upgrade to the contract that simalates the previous version of the RootRegistrar
    // (the one that we will change to when ready)

    // deploy impl first
    const factory = await hre.ethers.getContractFactory("ZNSRootRegistrarPostMigrationMock");
    const newRegistrar = await factory.deploy();
    await newRegistrar.waitForDeployment();

    // upgrade to the new impl
    await zns.rootRegistrar.connect(deployer).upgradeToAndCall(await newRegistrar.getAddress(), "0x");

    // validate the upgrade
    const statePostUpgrade = await Promise.all(stateReads);

    statePostUpgrade.forEach(
      (value, index) => {
        expect(value).to.be.equal(statePreUpgrade[index]);
      }
    );
  });

  it("Should let anyone register ROOT domains after the upgrade", async () => {
    const newDomain = normalizeName("newdomain");

    await zns.rootRegistrar.connect(user).registerRootDomain(
      newDomain,
      ZeroAddress,
      tokenURI,
      rootDistrConfig,
      {
        token: await zns.meowToken.getAddress(),
        beneficiary: user.address,
      }
    );

    const newDomainHash = hashDomainLabel(newDomain);
    const owner = await zns.registry.getDomainOwner(newDomainHash);
    expect(owner).to.be.equal(user.address);

    // try from another user

    // Give funds to user
    await zns.meowToken.connect(randomUser).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
    await zns.meowToken.mint(randomUser.address, userBalanceInitial);

    const newNewDomain = normalizeName("newnewdomain");
    await zns.rootRegistrar.connect(randomUser).registerRootDomain(
      newNewDomain,
      ZeroAddress,
      tokenURI,
      rootDistrConfig,
      {
        token: await zns.meowToken.getAddress(),
        beneficiary: randomUser.address,
      }
    );

    const newNewDomainHash = hashDomainLabel(newNewDomain);
    const owner2 = await zns.registry.getDomainOwner(newNewDomainHash);
    expect(owner2).to.be.equal(randomUser.address);
  });

  it("Should send user the token and let user reclaim", async () => {
    // send user the domain token
    await zns.domainToken.connect(admin).transferFrom(admin.address, user.address, rootDomainHash);

    // check that user has the domain token, but Name is still owned by admin
    const tokenOwner = await zns.domainToken.ownerOf(rootDomainHash);
    const nameOwner = await zns.registry.getDomainOwner(rootDomainHash);
    expect(tokenOwner).to.be.equal(user.address);
    expect(nameOwner).to.be.equal(admin.address);

    // try to reclaim the domain
    await zns.rootRegistrar.connect(user).reclaimDomain(rootDomainHash);
    const nameOwnerAfterReclaim = await zns.registry.getDomainOwner(rootDomainHash);
    expect(nameOwnerAfterReclaim).to.be.equal(user.address);
  });

  // eslint-disable-next-line max-len
  it("Should give the user full domain access when they reclaim the domain upon receiving it from Zero Admin", async () => {
    // user can change distribution config for the domain
    const newDistrConfig = {
      pricerContract: await zns.fixedPricer.getAddress(),
      paymentType: PaymentType.DIRECT,
      accessType: AccessType.OPEN,
    };

    await zns.subRegistrar.connect(user).setDistributionConfigForDomain(rootDomainHash, newDistrConfig);
    const configFromContract = await zns.subRegistrar.distrConfigs(rootDomainHash);
    expect(configFromContract.pricerContract).to.be.equal(newDistrConfig.pricerContract);
    expect(configFromContract.paymentType).to.be.equal(newDistrConfig.paymentType);
    expect(configFromContract.accessType).to.be.equal(newDistrConfig.accessType);

    // user can change pricing for subdomains
    const priceConfig = {
      price: ethers.parseEther("7985"),
      feePercentage: 13,
      isSet: true,
    };
    await zns.fixedPricer.connect(user).setPriceConfig(rootDomainHash, priceConfig);

    const priceConfigFromContract = await zns.fixedPricer.priceConfigs(rootDomainHash);
    expect(priceConfigFromContract.price).to.be.equal(priceConfig.price);
    expect(priceConfigFromContract.feePercentage).to.be.equal(priceConfig.feePercentage);
    expect(priceConfigFromContract.isSet).to.be.equal(priceConfig.isSet);
  });

  it("Should let users register SUBdomains under the user reclaimed domain sent by Zero Admin", async () => {
    const subdomainLabel = normalizeName("subby");

    // try registering from user address
    await zns.subRegistrar.connect(randomUser).registerSubdomain(
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
    const subDomainHash = await getDomainHashFromEvent({ zns, user: randomUser });
    const owner = await zns.registry.getDomainOwner(subDomainHash);
    expect(owner).to.be.equal(randomUser.address);
  });

  // TODO mig: test cases:
  // 2. Send domain token to user
  // 4. User reclaims the full domain and can manage distribution and sell subs
});
