import { ZNSAddressResolver, ZNSAddressResolver__factory, ZNSDomainToken, ZNSDomainToken__factory, ZNSRegistry, ZNSRegistry__factory, ZNSRootRegistrar, ZNSRootRegistrar__factory } from "../../typechain";
import { Domain } from "./types";
import {
  REGISTRY_ADDR,
  ROOT_REGISTRAR_ADDR,
  DOMAIN_TOKEN_ADDR,
  ZERO_HASH,
  ADDRESS_RESOLVER_ADDR,
  SUBREGISTRAR_ADDR
} from "./constants";
import { expect } from "chai";

import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

export const validate = async (domain: Domain) => { 

  const [ deployer ] = await hre.ethers.getSigners();

  const {
    registry,
    rootRegistrar,
    domainToken,
    addressResolver
  } = getZNS(deployer);

  expect(await registry.exists(domain.id)).to.be.true;
  expect((await domainToken.ownerOf(domain.tokenId)).toLowerCase()).to.equal(domain.owner.id.toLowerCase());
  expect((await addressResolver.resolveDomainAddress(domain.id)).toLowerCase()).to.equal(domain.address.toLowerCase());


  if (domain.isWorld) {
    expect(domain.parentHash).to.equal(ZERO_HASH);
    expect(!!domain.parent).to.be.false;
  } else {
    expect(domain.parentHash).to.not.equal(ZERO_HASH);
    expect(!!domain.parent).to.be.true;
  }
  // 0x235Af0759Ff046A231a60ec4d5df19Ea97815282
  // 0x235af0759ff046a231a60ec4d5df19ea97815282
  // TODO would it be worth doing some validation in the subgraph?

  // TODO list of things per subdomain
  // TODO list of things to check per world
    /**
     * exists (id), exists (label), exists (tokenId)
     * owner
     * minter
     * accessType
     * address
     * curvePriceConfig
     * fixedPriceConfig
     * depth
     * isWorld (check that parentHash is/is not 0x0)
     * paymentToken
     * paymentType
     * pricerContract
     * reclaimableAddress
     * tokenUri
     * treasury
     * zna
     * 
     * creationBlock and creationTimestamp?
     */

}

export const getZNS = (signer: SignerWithAddress) => {
  return {
    registry: ZNSRegistry__factory.connect(REGISTRY_ADDR, signer) as unknown as ZNSRegistry,
    rootRegistrar: ZNSRootRegistrar__factory.connect(ROOT_REGISTRAR_ADDR, signer) as unknown as ZNSRootRegistrar,
    domainToken: ZNSDomainToken__factory.connect(DOMAIN_TOKEN_ADDR, signer) as unknown as ZNSDomainToken,
    addressResolver: ZNSAddressResolver__factory.connect(ADDRESS_RESOLVER_ADDR, signer) as unknown as ZNSAddressResolver
  }
}