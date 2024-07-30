
import * as hre from "hardhat";
import { expect } from "chai";
import { ZeroAddress, ZeroHash } from "ethers";
import { Domain, SubgraphError } from "./subgraph/types";
import { getZNS } from "./zns-contract-data.ts";


export const validate = async (domain : Domain) => {

  const [deployer] = await hre.ethers.getSigners();

  const {
    registry,
    domainToken,
    addressResolver,
    subRegistrar,
  } = await getZNS({
    signer: deployer,
    dbVersion: process.env.MONGO_DB_VERSION,
  });

  try {
    expect(await registry.exists(domain.id)).to.be.true;

    expect(
      (await registry.getDomainOwner(domain.id)).toLowerCase())
      .to.equal(domain.owner.id.toLowerCase());
    expect(
      (await domainToken.ownerOf(domain.tokenId)).toLowerCase())
      .to.equal(domain.domainToken.owner.id.toLowerCase());
    expect(
      (await addressResolver.resolveDomainAddress(domain.id)).toLowerCase())
      .to.equal(domain.address.toLowerCase());

    const distrConfig = await subRegistrar.distrConfigs(domain.id);

    // Props not yet set in the subgraph return null, but in the contract it will
    // be 0 value, so we must mediate here
    expect(distrConfig.accessType).to.equal(domain.accessType ?? 0n);
    expect(distrConfig.paymentType).to.equal(domain.paymentType ?? 0n);
    expect(distrConfig.pricerContract.toLowerCase()).to.equal(domain.pricerContract?.toLowerCase() ?? ZeroAddress);

    if (domain.isWorld) {
      expect(domain.parentHash).to.equal(ZeroHash);
      expect(!!domain.parent).to.be.false;
      expect(domain.depth === 0);
    } else {
      // When a domain is revoked, it's children will all still have the `parentHash` value
      // for that domain, even if the `parent` domain entity for each child is now null
      // so we can't expect `!!domain.parent == true` here
      expect(domain.parentHash).to.not.equal(ZeroHash);
      expect(domain.depth > 0);
    }
  } catch (e) {
    return {
      label: domain.label,
      hash: domain.id,
      parentHash: domain.parentHash,
      parent: domain.parent,
      error: e,
    } as SubgraphError;
  }
};
