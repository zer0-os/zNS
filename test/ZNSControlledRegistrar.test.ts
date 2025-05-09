import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getConfig } from "../src/deploy/campaign/get-config";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { MongoDBAdapter } from "@zero-tech/zdc";
import { IZNSContracts } from "../src/deploy/campaign/types";
import { ZNSControlledRegistrar } from "../typechain";
import { registrationWithSetup } from "./helpers/register-setup";
import { expect } from "chai";
import {
  AccessType,
  DOMAIN_EXISTS_ERR,
  INVALID_LABEL_ERR,
  NONEXISTENT_TOKEN_ERC_ERR,
  NOT_AUTHORIZED_ERR, NOT_FULL_OWNER_ERR, REGISTRAR_ROLE,
} from "./helpers";
import { getDomainHashFromEvent } from "./helpers/events";


describe.only("Controlled Domains Test", () => {
  let deployer : SignerWithAddress;
  let parentOwner : SignerWithAddress;
  let user : SignerWithAddress;

  let zns : IZNSContracts;
  let mongoAdapter : MongoDBAdapter;
  let controlledRegistrar : ZNSControlledRegistrar;

  let rootDomainHash : string;
  let subdomainHash : string;

  const mainSubLabel = "controlled-subdomain";

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
    await zns.meowToken.connect(parentOwner).approve(await zns.treasury.getAddress(), hre.ethers.MaxUint256);
    await zns.meowToken.mint(parentOwner.address, hre.ethers.parseEther("1000000000000000000"));

    await zns.meowToken.connect(parentOwner).approve(
      await zns.treasury.getAddress(),
      hre.ethers.MaxUint256
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

    // TODO 15: remove this if we don't need the extra Registrar !
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
    subdomainHash = await getDomainHashFromEvent({
      zns,
      user,
    });

    // TODO 15: rework this into Registrar logic to specify who gets the token and possibly registry owner !
    //  and remove from here !!!
    await zns.registry.connect(user).updateDomainOwner(subdomainHash, parentOwner.address);

    // make sure hash is calced correctly
    const subHashRef = await zns.subRegistrar.hashWithParent(
      rootDomainHash,
      mainSubLabel,
    );
    expect(subdomainHash).to.equal(subHashRef);

    const record = await zns.registry.getDomainRecord(subdomainHash);
    const { owner, resolver } = record;
    expect(resolver).to.equal(zns.addressResolver.target);
    expect(owner).to.equal(user.address);

    const subTokenOwner = await zns.domainToken.ownerOf(subdomainHash);
    expect(subTokenOwner).to.equal(user.address);
    const tokenUriFromContract = await zns.domainToken.tokenURI(subdomainHash);
    expect(tokenUriFromContract).to.equal(subTokenURI);

    const domainResolution = await zns.addressResolver.resolveDomainAddress(subdomainHash);
    expect(domainResolution).to.equal(user.address);
  });

  it.skip("should NOT let subdomain user access domain management functions", async () => {
    await expect(
      zns.subRegistrar.connect(user).setPricerContractForDomain(
        subdomainHash,
        zns.fixedPricer.target,
      )
    ).to.be.revertedWithCustomError(
      zns.subRegistrar,
      NOT_AUTHORIZED_ERR,
    );
  });

  it.skip("should NOT allow subdomain owner to revoke his domain", async () => {
    await expect(
      zns.rootRegistrar.connect(user).revokeDomain(subdomainHash)
    ).to.be.revertedWithCustomError(
      zns.rootRegistrar,
      NOT_AUTHORIZED_ERR,
    );
  });

  it("should revert when trying to register a subdomain as anyone other than owner or operator of parent", async () => {
    await expect(
      controlledRegistrar.connect(user).registerSubdomain(
        "controlled-subdomain-2",
        user.address,
        user.address,
        "dummy-token-uri",
        controlledRegistrar,
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
        controlledRegistrar,
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

  it.skip("should allow parent domain owner to revoke subdomain", async () => {
    await zns.rootRegistrar.connect(parentOwner).revokeDomain(subdomainHash);

    // check that the subdomain is revoked
    const record = await zns.registry.getDomainRecord(subdomainHash);
    const { owner, resolver } = record;
    expect(owner).to.equal(hre.ethers.ZeroAddress);
    expect(resolver).to.equal(hre.ethers.ZeroAddress);

    // check that the token is burned
    await expect(zns.domainToken.ownerOf(subdomainHash)).to.be.revertedWithCustomError(
      zns.domainToken,
      NONEXISTENT_TOKEN_ERC_ERR,
    );
  });

  it("should NOT allow controlled subdomain owner (token owner only) to transfer the token", async () => {
    const tokenOwner = await zns.domainToken.ownerOf(subdomainHash);
    const registryOwner = await zns.registry.getDomainOwner(subdomainHash);
    expect(registryOwner).to.not.equal(tokenOwner);

    await expect(
      zns.domainToken.connect(user).transferFrom(
        user.address,
        deployer.address,
        subdomainHash,
      )
    ).to.be.revertedWithCustomError(
      zns.domainToken,
      NOT_FULL_OWNER_ERR,
    );

    // check both safeTransferFrom versions
    await expect(
      zns.domainToken.connect(user)["safeTransferFrom(address,address,uint256)"](
        user.address,
        deployer.address,
        subdomainHash,
      )
    ).to.be.revertedWithCustomError(
      zns.domainToken,
      NOT_FULL_OWNER_ERR,
    );

    await expect(
      zns.domainToken.connect(user)["safeTransferFrom(address,address,uint256,bytes)"](
        user.address,
        deployer.address,
        subdomainHash,
        "0x",
      )
    ).to.be.revertedWithCustomError(
      zns.domainToken,
      NOT_FULL_OWNER_ERR,
    );
  });

  it("should NOT allow approved spender to transfer the controlled subdomain token", async () => {
    await zns.domainToken.connect(user).approve(deployer.address, subdomainHash);

    await expect(
      zns.domainToken.connect(deployer).transferFrom(
        user.address,
        deployer.address,
        subdomainHash,
      )
    ).to.be.revertedWithCustomError(
      zns.domainToken,
      NOT_FULL_OWNER_ERR,
    );
  });

  it("should allow registry owner to reclaim ownership of the controlled subdomain token", async () => {
    const tokenOwner = await zns.domainToken.ownerOf(subdomainHash);
    const registryOwner = await zns.registry.getDomainOwner(subdomainHash);
    expect(registryOwner).to.not.equal(tokenOwner);

    await zns.rootRegistrar.connect(parentOwner).reclaimDomainToken(subdomainHash);

    // validate
    const newTokenOwner = await zns.domainToken.ownerOf(subdomainHash);
    const newRegistryOwner = await zns.registry.getDomainOwner(subdomainHash);
    expect(newTokenOwner).to.equal(parentOwner.address);
    expect(newRegistryOwner).to.equal(parentOwner.address);
  });

  it("should allow approved spender to transfer the subdomain token", async () => {});

  // TODO 15: add tests:
  //  1. registering/revoking sub as operator + all setters (probably to their respective test files per contract)
  //  2. changing control for parent domain from ControlledRegistrar to a regular one
  //  3. test that control works the same with root domains
  //  4. unskip and fix other tests
  //  5. figure out which tests to add to DomainToken and other contracts since their logic changed
  //  6. ...
});
