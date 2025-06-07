import { expect } from "chai";
import { describe, it } from "mocha";
import { ethers } from "hardhat";
import Domain from "./domain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { DeployZNSParams } from "../types";
import { deployZNS } from "../deploy/deploy-zns";
import { hashSubdomainName } from "../hashing";
import { DEFAULT_RESOLVER_TYPE } from "../constants";
import { REGISTRAR_ROLE } from "../../../src/deploy/constants";
import { IZNSContracts } from "../../../src/deploy/campaign/types";


describe.only("Sample Test", () => {
  let deployer : SignerWithAddress;
  let mockRegistrar : SignerWithAddress;
  let user : SignerWithAddress;
  let operator : SignerWithAddress;
  let wilderDomainHash : string;

  let zns : IZNSContracts;

  beforeEach (async () => {
    [
      deployer,
      operator,
      user,
      mockRegistrar,
    ] = await ethers.getSigners();

    const params : DeployZNSParams = {
      deployer,
      governorAddresses: [deployer.address],
      adminAddresses: [deployer.address],
    };

    zns = await deployZNS(params);

    // Have to get this value for every test, but can be fixed
    wilderDomainHash = hashSubdomainName("wilder");

    await zns.accessController.connect(deployer).grantRole(REGISTRAR_ROLE, mockRegistrar.address);

    await zns.registry.connect(deployer).addResolverType(
      DEFAULT_RESOLVER_TYPE, await zns.addressResolver.getAddress()
    );

    await zns.registry.connect(mockRegistrar)
      .createDomainRecord(
        wilderDomainHash,
        deployer.address,
        DEFAULT_RESOLVER_TYPE
      );
  });

  it("should register and revoke a domain", async () => {
    const domain = new Domain({
      zns,
      domainConfig: {
        label: "test",
        parentHash: ethers.ZeroHash,
        owner: user,
      },
    });

    const hash = await domain.register();
    expect(await zns.registry.getDomainOwner(hash)).to.equal(user.address);
    expect(await zns.registry.getDomainRecord(hash)).to.exist;

    await domain.revoke();
    expect(await zns.registry.getDomainOwner(hash)).to.equal(ethers.ZeroAddress);
    expect(await zns.registry.getDomainRecord(hash)).to.deep.equal(
      [ethers.ZeroAddress, ethers.ZeroAddress]
    );
  });

  it("should #assignDomainToken to another address", async () => {
    const domain = new Domain({
      zns,
      domainConfig: {
        label: "test2",
        parentHash: ethers.ZeroHash,
        owner: user,
      },
    });

    const hash = await domain.register();
    expect(await zns.domainToken.ownerOf(hash)).to.equal(user.address);

    await zns.rootRegistrar.connect(user).assignDomainToken(
      hash,
      operator.address
    );

    expect(await zns.domainToken.ownerOf(hash)).to.equal(operator.address);
  });
});