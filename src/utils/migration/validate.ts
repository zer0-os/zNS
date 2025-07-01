import { ZeroAddress, ZeroHash } from "ethers";
import { Domain } from "./types";
import { IDistributionConfig, IZNSContracts } from "../../../test/helpers/types";
import assert from "assert";


export const validateDomain = async (
  domain : Domain,
  zns : IZNSContracts,
) => {
  // For speed in processing we group promises together
  // need to know factually it was a revoked parent for certain subdomains
  // check phash for existence, if domain was revoked, add to appropriate coll with 0x0 owner
  // in transfer script check if owner is 0 then dont transfer
  let resolvedParentHash;

  if (domain.parent && domain.parent.id) {
    resolvedParentHash = domain.parent.id;
  } else if (domain.parentHash) {
    resolvedParentHash = domain.parentHash;
  }

  assert.ok(
    resolvedParentHash || domain.depth === 0,
    `Subdomain with no parent information found
    Label: ${domain.label},
    DomainHash: ${domain.id},
    TokenId: ${domain.tokenId},
    Owner: ${domain.owner.id}`
  )

  // this check gives type safety downstream
  if (!resolvedParentHash) throw Error("shouldnt ever hit this error")

  const promises = [
    zns.registry.getDomainOwner(domain.id),
    zns.domainToken.ownerOf(domain.tokenId),
    zns.addressResolver.resolveDomainAddress(domain.id),
    zns.subRegistrar.distrConfigs(domain.id),
  ];

  const [
    domainOwner,
    domainTokenOwner,
    domainAddress,
    distrConfig,
  ] = await Promise.all(promises) as unknown as [string, string, string, IDistributionConfig];

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

  if (domain.isWorld) {
    assert.equal(resolvedParentHash, ZeroHash, `Domain ${domain.id} 'isWorld' is true, but has parent hash ${resolvedParentHash}`);
    assert.ok(!(!!domain.parent), `Domain ${domain.id} 'isWorld' is true, but 'hasParent' is true`);
    assert.ok(domain.depth === 0, `Domain ${domain.id} 'isWorld' is true, but 'depth' is not 0`);
  } else {
    // Because we do not delete from the subgraph store on revoke, the domain is always present
    // even if `isRevoked` is true
    // Not important. Could be a bug in the subgraph
    assert.notEqual(resolvedParentHash, ZeroHash,`Domain ${domain.id} 'isWorld' is false, but 'resolvedParentHash' is 0x0`);
    assert.ok(domain.depth > 0,`Domain ${domain.id} 'isWorld' is false, but 'depth' is 0`);
  }
};
