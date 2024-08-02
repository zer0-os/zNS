
import { expect } from "chai";
import { ZeroAddress, ZeroHash } from "ethers";
import { Domain, SubgraphError } from "../types.ts";
import { getZNS } from "../zns-contract-data.ts";

import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

export const validateDomain = async (
  domain : Domain, deployer : SignerWithAddress) => {

  const {
    registry,
    domainToken,
    addressResolver,
    subRegistrar,
  } = await getZNS({
    signer: deployer,
    action: "read"
  });

  try {
    if (domain.id === "0xe12a787be240346e45d09eaa9359fd7a7962820c2ded8f05a5a859bcdd303579") {
      console.log("special case here");
      console.log(`domain: ${Object.values(domain)}`);
    }
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
