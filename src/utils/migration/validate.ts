
import { ZeroAddress, ZeroHash } from "ethers";
import { Domain } from "./types";
import { IZNSContracts } from "../../../test/helpers/types";
import {
  AccessType,
  PaymentType,
} from "../../../test/helpers";
import assert from "assert";

export const validateDomain = async (
  domain : Domain, 
  zns : IZNSContracts,
  postMigration : boolean = false
) => {
  // Because we no longer delete from the store in the subgraph when a domain is revoked
  // we have to first check `isRevoked` before checking the registry
  if (!domain.isRevoked) {

    // For speed in processing we group promises together
    const promises = [
      zns.registry.exists(domain.id),
      zns.registry.getDomainOwner(domain.id),
      zns.domainToken.ownerOf(domain.tokenId),
      zns.addressResolver.resolveDomainAddress(domain.id)
    ]

    const [
      exists,
      domainOwner,
      domainTokenOwner,
      domainAddress
    ] = await Promise.all(promises) as unknown as [boolean, string, string, string];

    assert.ok(!!exists);

    assert.equal(
      domainOwner.toLowerCase(),
      domain.owner.id.toLowerCase()
    );

    assert.equal(
      domainTokenOwner.toLowerCase(),
      domain.domainToken.owner.id.toLowerCase()
    );

    assert.equal(
      domainAddress.toLowerCase(),
      domain.address.toLowerCase()
    );
  }

  const distrConfig = await zns.subRegistrar.distrConfigs(domain.id);

  // Props not yet set in the subgraph return null, but in the contract it will
  // be 0 value, so we must mediate here
  if (postMigration) {
    assert.equal(distrConfig.accessType, AccessType.OPEN);
    assert.equal(distrConfig.paymentType, PaymentType.DIRECT);
    assert.equal(distrConfig.pricerContract.toLowerCase(), ZeroAddress);  
  } else {
    assert.equal(distrConfig.accessType, domain.accessType ?? 0n);
    assert.equal(distrConfig.paymentType, domain.paymentType ?? 0n);
    assert.equal(distrConfig.pricerContract.toLowerCase(), domain.pricerContract?.toLowerCase() ?? ZeroAddress);  
  }

  if (domain.isWorld) {
    assert.equal(domain.parentHash, ZeroHash);
    assert.ok(!!domain.parent === false)
    assert.ok(domain.depth === 0);
  } else {
    // Because we do not delete from the subgraph store on revoke, the domain is always present
    // even if `isRevoked` is true
    assert.ok(!!domain.parent);
    assert.notEqual(domain.parentHash, ZeroHash);
    assert.ok(domain.depth > 0);
  }
}