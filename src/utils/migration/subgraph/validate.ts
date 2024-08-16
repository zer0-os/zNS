
import { expect } from "chai";
import { ZeroAddress, ZeroHash } from "ethers";
import { Domain, SubgraphError } from "../types";
import { getZNS } from "../zns-contract-data";

import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZNSContracts } from "../../../deploy/campaign/types";
import { IZNSContractsLocal } from "../../../../test/helpers/types";

export const validateDomain = async (
  domain : Domain, 
  deployer : SignerWithAddress,
  zns : IZNSContracts | IZNSContractsLocal
) => {

  try {
    // Because we no longer delete from the store in the subgraph when a domain is revoked
    // we have to first check `isRevoked` before checking the registry
    if (!domain.isRevoked) {
      expect(await zns.registry.exists(domain.id)).to.be.true;
      expect(
        (await zns.registry.getDomainOwner(domain.id)).toLowerCase())
        .to.equal(domain.owner.id.toLowerCase());
      expect(
        (await zns.domainToken.ownerOf(domain.tokenId)).toLowerCase())
        .to.equal(domain.domainToken.owner.id.toLowerCase());
      expect(
        (await zns.addressResolver.resolveDomainAddress(domain.id)).toLowerCase())
        .to.equal(domain.address.toLowerCase());
    }

    const distrConfig = await zns.subRegistrar.distrConfigs(domain.id);

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
      // TODO update to check for parent entity when we can update the subgraph
      expect(domain.parentHash).to.not.equal(ZeroHash);
      expect(domain.depth > 0);
    }
  } catch (e) {
    console.log((e as Error).message)
    return {
      label: domain.label,
      hash: domain.id,
      parentHash: domain.parentHash,
      parent: domain.parent,
      error: e,
    } as SubgraphError;
  }
};
