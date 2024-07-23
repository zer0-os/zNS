import { ZNSAccessController, ZNSAccessController__factory, ZNSAddressResolver, ZNSAddressResolver__factory, ZNSCurvePricer, ZNSCurvePricer__factory, ZNSDomainToken, ZNSDomainToken__factory, ZNSFixedPricer, ZNSFixedPricer__factory, ZNSRegistry, ZNSRegistry__factory, ZNSRootRegistrar, ZNSRootRegistrar__factory, ZNSSubRegistrar, ZNSSubRegistrar__factory, ZNSTreasury, ZNSTreasury__factory } from "../../typechain";
import { Domain } from "./types";
import {
  REGISTRY_ADDR,
  ROOT_REGISTRAR_ADDR,
  DOMAIN_TOKEN_ADDR,
  ZERO_HASH,
  ADDRESS_RESOLVER_ADDR,
  SUBREGISTRAR_ADDR,
  TREASURY_ADDR,
  FIXED_PRICER_ADDR,
  ACCESS_CONTROLLER_ADDR
} from "./constants";
import { expect } from "chai";

import * as fs from "fs";

import * as hre from "hardhat";
import { ZeroAddress, ZeroHash } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { exit } from "process";

export const validate = async (domain: Domain) => { 

  const [ deployer ] = await hre.ethers.getSigners();

  const {
    registry,
    rootRegistrar,
    domainToken,
    addressResolver,
    subRegistrar,
    treasury,
    fixedPricer,
    curvedPricer,
    accessController
  } = getZNS(deployer);

  // TODO after its all written out, combine all the awaits into one Promise.all

  try {
    expect(await registry.exists(domain.id)).to.be.true;
    
    // TODO If `domain.owner` is null, there was a transfer but a bug exists and its not recorded properly
    // checking 'owner' of any domain that's been transferred breaks
    // expect((await registry.getDomainOwner(domain.id)).toLowerCase()).to.equal(domain.owner.id.toLowerCase());
    // expect((await domainToken.ownerOf(domain.tokenId)).toLowerCase()).to.equal(tempOwner.id.toLowerCase());

    expect((await addressResolver.resolveDomainAddress(domain.id)).toLowerCase()).to.equal(domain.address.toLowerCase());

    // Props not yet set in the subgraph return null, but in the contract it will
    // be 0 value, so we must mediate here
    const distrConfig = await subRegistrar.distrConfigs(domain.id);
    expect(distrConfig.accessType).to.equal(domain.accessType);
    expect(distrConfig.paymentType).to.equal(domain.paymentType ?? 0n);
    expect(distrConfig.pricerContract.toLowerCase()).to.equal(domain.pricerContract?.toLowerCase() ?? ZeroAddress);

    // Doesn't matter if we're not setting these values anyways?
    // Bug with subgraph though where PaymentToken entity doesn't exist
    // const paymentConfig = await treasury.paymentConfigs(domain.id);
    // expect(paymentConfig.token.toLowerCase()).to.equal(domain.paymentToken ? domain.paymentToken.id.toLowerCase() : ZeroAddress);

    // currently a treasury entity is made even when no beneficiary is set
    // cannot use the existence of a treasury entity to confirm this value exists
    // const beneficiary = domain.treasury?.beneficiaryAddress.toLowerCase();
    // expect(paymentConfig.beneficiary.toLowerCase()).to.equal(beneficiary ?? ZeroAddress);

    // Some domains have both set
    // but we probably aren't setting these configs for users anyways
    // optionally we could set all to default MEOW token we know exists?
      // all? or only ones with pre-existing configs?

    if (domain.isWorld) {
      expect(domain.parentHash).to.equal(ZeroHash);
      expect(!!domain.parent).to.be.false;
      expect(domain.depth == 0)
    } else {
      expect(domain.parentHash).to.not.equal(ZeroHash);
      expect(!!domain.parent).to.be.true;
      expect(domain.depth > 0);
    }
  } catch (e) {
    console.error(`Error validating domain ${domain.label} with hash ${domain.id}`);
    console.error(e);
    exit(1);
  }

  // TODO after all is validated, output to JSON file?

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
    addressResolver: ZNSAddressResolver__factory.connect(ADDRESS_RESOLVER_ADDR, signer) as unknown as ZNSAddressResolver,
    subRegistrar: ZNSSubRegistrar__factory.connect(SUBREGISTRAR_ADDR, signer) as unknown as ZNSSubRegistrar,
    treasury: ZNSTreasury__factory.connect(TREASURY_ADDR, signer) as unknown as ZNSTreasury,
    fixedPricer: ZNSFixedPricer__factory.connect(FIXED_PRICER_ADDR, signer) as unknown as ZNSFixedPricer,
    curvedPricer: ZNSCurvePricer__factory.connect(FIXED_PRICER_ADDR, signer) as unknown as ZNSCurvePricer,
    accessController: ZNSAccessController__factory.connect(ACCESS_CONTROLLER_ADDR, signer) as unknown as ZNSAccessController
  }
}