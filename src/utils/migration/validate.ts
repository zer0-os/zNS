
import { expect } from "chai";
import { ZeroAddress, ZeroHash } from "ethers";
import { Domain } from "./types";
import { IZNSContracts } from "../../../test/helpers/types";
import {
  AccessType,
  PaymentType,
} from "../../../test/helpers";

// TODO change to asserts

export const validateDomain = async (
  domain : Domain, 
  zns : IZNSContracts,
  postMigration : boolean = false
) => {
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

  if (postMigration) {
    expect(distrConfig.accessType).to.equal(AccessType.OPEN);
    expect(distrConfig.paymentType).to.equal(PaymentType.DIRECT);
    expect(distrConfig.pricerContract.toLowerCase()).to.equal(ZeroAddress);  
  } else {
    expect(distrConfig.accessType).to.equal(domain.accessType ?? 0n);
    expect(distrConfig.paymentType).to.equal(domain.paymentType ?? 0n);
    expect(distrConfig.pricerContract.toLowerCase()).to.equal(domain.pricerContract?.toLowerCase() ?? ZeroAddress);  
  }

  if (domain.isWorld) {
    expect(domain.parentHash).to.equal(ZeroHash);
    expect(!!domain.parent).to.be.false;
    expect(domain.depth === 0);
  } else {
    // Because we no longer delete from the subgraph store on revoke, the domain is always present
    // even if `isRevoked` is true
    expect(!!domain.parent).to.be.true;
    expect(domain.parentHash).to.not.equal(ZeroHash);
    expect(domain.depth > 0);
  }
}