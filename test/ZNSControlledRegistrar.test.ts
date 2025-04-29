import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getConfig } from "../src/deploy/campaign/get-config";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { MongoDBAdapter } from "@zero-tech/zdc";
import { IZNSContracts } from "../src/deploy/campaign/types";
import { ZNSControlledRegistrar } from "../typechain";
import { registrationWithSetup } from "./helpers/register-setup";
import { expect } from "chai";
import { AccessType, DOMAIN_EXISTS_ERR, INVALID_LABEL_ERR, NOT_AUTHORIZED_ERR, REGISTRAR_ROLE } from "./helpers";
import { getDomainHashFromEvent } from "./helpers/events";


describe.only("ZNSControlledRegistrar Test", () => {
  let deployer : SignerWithAddress;
  let parentOwner : SignerWithAddress;
  let user : SignerWithAddress;

  let zns : IZNSContracts;
  let mongoAdapter : MongoDBAdapter;
  let controlledRegistrar : ZNSControlledRegistrar;

  let rootDomainHash : string;

  let mainSubLabel : string;

  before(async () => {
    [deployer, parentOwner, user] = await hre.ethers.getSigners();

    const config = await getConfig({
      deployer,
    });

    const campaign = await runZnsCampaign({
      config,
    });

    zns = campaign.state.contracts;
    mongoAdapter = campaign.dbAdapter;

    // Give funds and approve
    await zns.meowToken.connect(parentOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
    await zns.meowToken.mint(parentOwner.address, ethers.parseEther("1000000000000000000"));

    await zns.meowToken.connect(parentOwner).approve(
      await zns.treasury.getAddress(),
      ethers.MaxUint256
    );

    // Register the root domain for the Registrar
    rootDomainHash = await registrationWithSetup({
      zns,
      user: parentOwner,
      domainLabel: "controlling-root",
    });

    // TODO 15: move it to the campaign ?!?!?
    // deploy ControlledRegistrar
    const fact = await hre.ethers.getContractFactory("ZNSControlledRegistrar");
    controlledRegistrar = await fact.deploy(
      zns.rootRegistrar.target,
      zns.registry.target,
      rootDomainHash,
    );

    // TODO 15: remove this when AC reworked for Registrars
    // give REGISTRAR_ROLE to ControlledRegistrar
    await zns.accessController.connect(deployer).grantRole(REGISTRAR_ROLE, controlledRegistrar.target);
  });

  after(async () => {
    await mongoAdapter.dropDB();
  });

  it("should set all state vars correctly at deploy", async () => {
    const rootRegistrar = await controlledRegistrar.rootRegistrar();
    const registry = await controlledRegistrar.registry();
    const rootDomain = await controlledRegistrar.parentDomainHash();

    expect(rootRegistrar).to.equal(zns.rootRegistrar.target);
    expect(registry).to.equal(zns.registry.target);
    expect(rootDomain).to.equal(rootDomainHash);
  });

  it("should register a subdomain as an owner of parent domain", async () => {
    mainSubLabel = "controlled-subdomain";

    // make sure parent domain is LOCKED in SubRegistrar
    const { accessType } = await zns.subRegistrar.distrConfigs(rootDomainHash);
    expect(accessType).to.equal(AccessType.LOCKED);

    // register subdomain for user
    const subTokenURI = "https://example.com/subdomain";
    await controlledRegistrar.connect(parentOwner).registerSubdomain(
      mainSubLabel,
      user.address,
      user.address,
      subTokenURI,
    );

    // check that the subdomain is registered
    const subdomainHash = await getDomainHashFromEvent({
      zns,
      user,
    });

    // make sure hash is calced correctly
    const subHashRef = await zns.subRegistrar.hashWithParent(
      rootDomainHash,
      mainSubLabel,
    );
    expect(subdomainHash).to.equal(subHashRef);

    const { owner, resolver } = await zns.registry.getDomainRecord(subdomainHash);
    expect(resolver).to.equal(zns.addressResolver.target);
    expect(owner).to.equal(user.address);

    const subTokenOwner = await zns.domainToken.ownerOf(subdomainHash);
    expect(subTokenOwner).to.equal(user.address);
    const tokenUriFromContract = await zns.domainToken.tokenURI(subdomainHash);
    expect(tokenUriFromContract).to.equal(subTokenURI);

    const domainResolution = await zns.addressResolver.resolveDomainAddress(subdomainHash);
    expect(domainResolution).to.equal(user.address);
  });

  it("should revert when trying to register a subdomain as anyone other than owner or operator", async () => {
    await expect(
      controlledRegistrar.connect(user).registerSubdomain(
        "controlled-subdomain-2",
        user.address,
        user.address,
        "dummy-token-uri",
      ),
    ).to.be.revertedWithCustomError(
      zns.registry,
      NOT_AUTHORIZED_ERR,
    );
  });

  it("should revert when trying to register a subdomain with invalid characters", async () => {
    await expect(
      controlledRegistrar.connect(parentOwner).registerSubdomain(
        "invalid-subdomain-!",
        user.address,
        user.address,
        "dummy-token-uri",
      )
    ).to.be.revertedWithCustomError(
      zns.rootRegistrar,
      INVALID_LABEL_ERR,
    );
  });

  it("should revert when registering a duplicate domain", async () => {
    await expect(
      controlledRegistrar.connect(parentOwner).registerSubdomain(
        mainSubLabel,
        user.address,
        user.address,
        "dummy-token-uri",
      )
    ).to.be.revertedWithCustomError(
      zns.rootRegistrar,
      DOMAIN_EXISTS_ERR,
    );
  });

  // TODO 15: add tests:
  //  1. registering sub as operator
});
