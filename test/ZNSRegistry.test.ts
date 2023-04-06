import * as hre from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ZNSRegistry, ZNSRegistry__factory } from '../typechain';

require('@nomicfoundation/hardhat-chai-matchers');

/**
 * TODO should we disallow burning the root domain?
 * The process of burning would transfer ownership to the 0x0 address
 * Nobody would be able to successfully mint new subdomaisn in this scenario
 * In the case the `owner` we set in the initializer is an EOA, it's a
 * possibility the account is compromised
 */

describe('ZNSRegistry Tests', () => {
  let deployer : SignerWithAddress;
  let operator : SignerWithAddress;

  // ZNSResolver has not been created, but an address will be equivalent for now
  let mockResolver : SignerWithAddress;
  let registry : ZNSRegistry;

  // Set owner of 0x0 domain in initalizer, will be used by every other subdomain
  const rootDomainHash = hre.ethers.constants.HashZero;
  const wilderLabel = hre.ethers.utils.id('wilder');

  // Wilder subdomain hash created in `setSubdomainRecord` call to `setSubdomainOwner`
  const wilderSubdomainHash = hre.ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [rootDomainHash, wilderLabel]);

  beforeEach(async () => {
    [deployer, operator, mockResolver] = await hre.ethers.getSigners();

    const registryFactory = new ZNSRegistry__factory(deployer);
    registry = await registryFactory.deploy();

    // To set the owner of the zero domain to the deployer
    await registry.connect(deployer).initialize(deployer.address);

    // Create a first domain from the base domain
    await registry.connect(deployer)
      .setSubdomainRecord(
        rootDomainHash,
        wilderLabel,
        deployer.address,
        mockResolver.address
      );
  });

  // a valid operator can change the owner of a domain, is this wanted?
  describe('Operator functionality', () => {
    it('Returns false when an operator is not allowed by an owner', async () => {
      await registry.connect(deployer).setOwnerOperator(operator.address, false);

      const allowed = await registry.isAllowedOperator(deployer.address, operator.address);
      expect(allowed).to.be.false;
    });

    it('Returns true when an operator is allowed by an owner', async () => {
      await registry.connect(deployer).setOwnerOperator(operator.address, true);

      const allowed = await registry.isAllowedOperator(deployer.address, operator.address);
      expect(allowed).to.be.true;
    });

    it('Returns false when an owner has not specified any operators', async () => {
      const allowed = await registry.isAllowedOperator(deployer.address, operator.address);

      expect(allowed).to.be.false;
    });

    it('Permits an allowed operator to modify a domain record', async () => {
      await registry.connect(deployer).setOwnerOperator(operator.address, true);

      const tx = registry.connect(operator).setDomainResolver(wilderSubdomainHash, operator.address);
      await expect(tx).to.not.be.reverted;
    });

    it('Does not permit a disallowed operator to modify a domain record', async () => {
      await registry.connect(deployer).setOwnerOperator(operator.address, false);

      const tx = registry.connect(operator).setDomainResolver(wilderSubdomainHash, operator.address);
      await expect(tx).to.be.revertedWith('ZNS: Not allowed');
    });

    it('Does not permit an operator that\'s never been allowed to modify a record', async () => {
      const tx = registry.connect(operator).setDomainResolver(wilderSubdomainHash, operator.address);
      await expect(tx).to.be.revertedWith('ZNS: Not allowed');
    });
  });

  describe('Domain and subdomain records', async () => {
    it('Gets a domain record', async () => {
      // Domain exists
      const rootRecord = await registry.getDomainRecord(rootDomainHash);
      expect(rootRecord.owner).to.eq(deployer.address);

      // Domain exists
      const wilderRecord = await registry.getDomainRecord(wilderSubdomainHash);
      expect(wilderRecord.owner).to.eq(deployer.address);

      // Domain does not exist
      const domainHash = hre.ethers.utils.id('random-record');
      const record = await registry.getDomainRecord(domainHash);
      expect(record.owner).to.eq(hre.ethers.constants.AddressZero);
    });

    it('Gets a domain owner', async () => {
      // The domain exists
      const existOwner = await registry.getDomainOwner(wilderSubdomainHash);
      expect(existOwner).to.eq(deployer.address);

      // The domain does not exist
      const domainHash = hre.ethers.utils.id('random-record');
      const notExistOwner = await registry.getDomainOwner(domainHash);
      expect(notExistOwner).to.eq(hre.ethers.constants.AddressZero);
    });

    it('Gets a domain resolver', async () => {
      // The domain exists
      const existResolver = await registry.getDomainResolver(wilderSubdomainHash);
      expect(existResolver).to.eq(mockResolver.address);

      // The domain does not exist
      const domainHash = hre.ethers.utils.id('random-record');
      const notExistResolver = await registry.getDomainResolver(domainHash);
      expect(notExistResolver).to.eq(hre.ethers.constants.AddressZero);

    });
  });

  describe('Setter functions for a domain\'s record, owner, or resolver', () => {
    it('Sets a domain record', async () => {
      await registry.connect(deployer).setDomainRecord(rootDomainHash, operator.address, mockResolver.address);

      const record = await registry.getDomainRecord(rootDomainHash);
      expect(record.owner).to.eq(operator.address);
    });

    it('Fails to set a record when caller is not owner or operator', async () => {
      const tx = registry.connect(operator).setDomainRecord(rootDomainHash, operator.address, mockResolver.address);
      await expect(tx).to.be.revertedWith('ZNS: Not allowed');
    });

    it('Sets a subdomain record', async () => {
      // In order to set a subdomain, the caller must be the owner of the parent domain
      const zeroLabel = hre.ethers.utils.id('zero');

      await registry.connect(deployer)
        .setSubdomainRecord(
          wilderSubdomainHash,
          zeroLabel,
          deployer.address,
          mockResolver.address
        );

      const zeroDomainHash = hre.ethers.utils
        .solidityKeccak256(
          ['bytes32', 'bytes32'],
          [wilderSubdomainHash, zeroLabel]
        );
      const zeroOwner = await registry.getDomainOwner(zeroDomainHash);
      expect(zeroOwner).to.eq(deployer.address);
    });

    it('Fails to set a subdomain record because caller is not the owner of the parent domain', async () => {
      const zeroLabel = hre.ethers.utils.id('zero');

      const tx = registry.connect(operator)
        .setSubdomainRecord(
          wilderSubdomainHash,
          zeroLabel,
          deployer.address,
          mockResolver.address
        );
      await expect(tx).to.be.revertedWith('ZNS: Not allowed');
    });

    it('Fails to create another root domain', async () => {
      // The root domain ownership is set in the initializer function
      // Any additional root domains would fail because they are checked for owner,
      // but because that owner can't exist as the record doesn't exist yet, it fails
      const domainHash = hre.ethers.utils.id('random-record');
      const tx = registry.connect(deployer)
        .setDomainRecord(
          domainHash,
          operator.address,
          mockResolver.address
        );
      await expect(tx).to.be.revertedWith('ZNS: Not allowed');
    });
  });
});