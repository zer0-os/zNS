
import { ZeroAddress, ZeroHash } from "ethers";
import { Domain } from "./types";
import { IZNSContracts } from "../../../test/helpers/types";
import assert from "assert";

export const validateDomain = async (
  domain : Domain, 
  zns : IZNSContracts,
) => {
  // For speed in processing we group promises together
  const promises = [
    zns.registry.getDomainOwner(domain.id),
    zns.domainToken.ownerOf(domain.tokenId),
    zns.addressResolver.resolveDomainAddress(domain.id)
  ]

  const [
    domainOwner,
    domainTokenOwner,
    domainAddress
  ] = await Promise.all(promises) as unknown as [string, string, string];

  // Domain is in reclaimable state
  assert.equal(
    domain.owner.id.toLowerCase(),
    domain.domainToken.owner.id.toLowerCase(),
    `Domain ${domain.id} has split ownership.
    Token owner: ${domain.domainToken.owner.id.toLowerCase()},
    Domain owner: ${domain.owner.id.toLowerCase()}`
  );

  assert.equal(
    domainOwner.toLowerCase(),
    domain.owner.id.toLowerCase(),
    `Owner for domain ${domain.id} does not match.
    Contract: ${domainOwner.toLowerCase()},
    Subgraph: ${domain.owner.id.toLowerCase()}`
  );

  assert.equal(
    domainTokenOwner.toLowerCase(),
    domain.domainToken.owner.id.toLowerCase(),
    `Owner of domainToken for domain ${domain.id} does not match.
    Contract: ${domainTokenOwner.toLowerCase()},
    Subgraph: ${domain.domainToken.owner.id.toLowerCase()}`
  );

  assert.equal(
    domainAddress.toLowerCase(),
    domain.address.toLowerCase(),
    `Domain ${domain.id} has differing domain addresses:
    Contract: ${domainAddress.toLowerCase()}
    Subgraph: ${domain.address.toLowerCase()}`
  );

  const distrConfig = await zns.subRegistrar.distrConfigs(domain.id);

  assert.equal(distrConfig.accessType, domain.accessType ?? 0n,
    `Domain ${domain.id} has different access types.
    Contract: ${distrConfig.accessType}
    Subgraph: ${domain.accessType ?? 0n}
    `
  );
  assert.equal(distrConfig.paymentType, domain.paymentType ?? 0n,
    `Domain ${domain.id} has different payment types.
    Contract: ${distrConfig.paymentType}
    Subgraph: ${domain.paymentType ?? 0n}
    `
  );
  assert.equal(distrConfig.pricerContract.toLowerCase(), domain.pricerContract?.toLowerCase() ?? ZeroAddress,
    `Domain ${domain.id} has different pricer contracts.
    Contract: ${distrConfig.pricerContract.toLowerCase()}
    Subgraph: ${domain.pricerContract?.toLowerCase() ?? ZeroAddress}
    `
  );  

  if (domain.isWorld) {
    assert.equal(domain.parentHash, ZeroHash), `Domain ${domain.id} 'isWorld' is true, but has parent hash`;
    assert.ok(!!domain.parent === false, `Domain ${domain.id} 'isWorld' is true, but 'hasParent' is true`)
    assert.ok(domain.depth === 0, `Domain ${domain.id} 'isWorld' is true, but 'depth' is not 0`);
  } else {
    // Because we do not delete from the subgraph store on revoke, the domain is always present
    // even if `isRevoked` is true
    assert.ok(!!domain.parent, `Domain ${domain.id} 'isWorld' is false, but 'parent' is undefined`);
    assert.notEqual(domain.parentHash, ZeroHash,`Domain ${domain.id} 'isWorld' is false, but 'parentHash' is 0x0`);
    assert.ok(domain.depth > 0,`Domain ${domain.id} 'isWorld' is false, but 'depth' is 0`);
  }
}