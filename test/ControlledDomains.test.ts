import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getConfig } from "../src/deploy/campaign/get-config";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { MongoDBAdapter } from "@zero-tech/zdc";
import { IZNSContracts } from "../src/deploy/campaign/types";
import { defaultRootRegistration, registrationWithSetup } from "./helpers/register-setup";
import { expect } from "chai";
import {
  AccessType, DEFAULT_CURVE_PRICE_CONFIG_BYTES, distrConfigEmpty, DISTRIBUTION_LOCKED_NOT_EXIST_ERR,
  NONEXISTENT_TOKEN_ERC_ERR,
  NOT_AUTHORIZED_ERR, NOT_FULL_OWNER_ERR, paymentConfigEmpty,
} from "./helpers";
import { getDomainHashFromEvent } from "./helpers/events";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";


const makeSetupFixture = async () => {
  const controlledSubLabel = "controlled-subdomain";
  const controlledRootLabel = "controlled-root";

  const [deployer, parentOwner, rootOwner, operator, subOwner] = await hre.ethers.getSigners();

  const config = await getConfig({
    deployer,
  });

  const campaign = await runZnsCampaign({
    config,
  });

  const zns = campaign.state.contracts as IZNSContracts;
  const mongoAdapter = campaign.dbAdapter;

  // Give funds and approve
  await zns.meowToken.mint(parentOwner.address, hre.ethers.parseEther("1000000000000000000"));
  await zns.meowToken.mint(rootOwner.address, hre.ethers.parseEther("1000000000000000000"));

  await zns.meowToken.connect(parentOwner).approve(
    await zns.treasury.getAddress(),
    hre.ethers.MaxUint256
  );
  await zns.meowToken.connect(rootOwner).approve(
    await zns.treasury.getAddress(),
    hre.ethers.MaxUint256
  );

  // Register the root domain for the Registrar
  const baseRootDomainHash = await registrationWithSetup({
    zns,
    tokenOwner: parentOwner.address,
    user: parentOwner,
    domainLabel: "controlling-root",
  });

  // register subdomain for user
  const subTokenURI = "https://example.com/subdomain";
  await zns.subRegistrar.connect(parentOwner).registerSubdomain({
    parentHash: baseRootDomainHash,
    label: controlledSubLabel,
    domainAddress: subOwner.address,
    tokenOwner: subOwner.address,
    tokenURI: subTokenURI,
    distrConfig: distrConfigEmpty,
    paymentConfig: paymentConfigEmpty,
  });

  // check that the subdomain is registered
  const controlledSubHash = await getDomainHashFromEvent({
    zns,
    user: parentOwner,
    tokenOwner: subOwner.address,
  });

  const tokenURI = "https://example.com/rootdomain";
  // assign token to deployer as controlled token owner for this root domain
  await defaultRootRegistration({
    zns,
    user: rootOwner,
    domainName: controlledRootLabel,
    tokenOwner: deployer.address, // controlled token owner
    tokenURI,
    distrConfig: distrConfigEmpty,
    paymentConfig: paymentConfigEmpty,
  });

  // check that the subdomain is registered
  const controlledRootHash = await getDomainHashFromEvent({
    zns,
    user: rootOwner,
  });

  // assign operators
  await zns.registry.connect(parentOwner).setOwnersOperator(operator.address, true);
  await zns.registry.connect(rootOwner).setOwnersOperator(operator.address, true);

  return {
    deployer,
    parentOwner,
    rootOwner,
    operator,
    subOwner,
    zns,
    mongoAdapter,
    baseRootDomainHash,
    controlledRootHash,
    controlledSubHash,
  };
};

describe("Controlled Domains Test", () => {
  let deployer : SignerWithAddress;
  let parentOwner : SignerWithAddress;
  let rootOwner : SignerWithAddress;
  let subOwner : SignerWithAddress;
  let operator : SignerWithAddress;

  let zns : IZNSContracts;
  let mongoAdapter : MongoDBAdapter;

  let baseRootDomainHash : string;
  let controlledSubHash : string;
  let controlledRootHash : string;

  before(async () => {
    ({
      deployer,
      parentOwner,
      rootOwner,
      operator,
      subOwner,
      zns,
      mongoAdapter,
      baseRootDomainHash,
      controlledRootHash,
      controlledSubHash,
    } = await loadFixture(makeSetupFixture));
  });

  after(async () => {
    await mongoAdapter.dropDB();
  });

  describe("Registration", () => {
    // eslint-disable-next-line max-len
    it("should register a controlled subdomain as an owner of parent domain by setting token owner to another address", async () => {
      const record = await zns.registry.getDomainRecord(controlledSubHash);
      const { owner: ownerFromContr, resolver } = record;
      expect(resolver).to.equal(zns.addressResolver.target);
      expect(ownerFromContr).to.equal(parentOwner.address);

      const subTokenOwner = await zns.domainToken.ownerOf(controlledSubHash);
      expect(subTokenOwner).to.equal(subOwner.address);

      const domainResolution = await zns.addressResolver.resolveDomainAddress(controlledSubHash);
      expect(domainResolution).to.equal(subOwner.address);
    });

    // eslint-disable-next-line max-len
    it("should register a subdomain as an operator of parent domain but assign parent owner as registry owner of subdomain", async () => {
      // make sure parent domain is LOCKED in SubRegistrar
      const { accessType } = await zns.subRegistrar.distrConfigs(baseRootDomainHash);
      expect(accessType).to.equal(AccessType.LOCKED);

      // register subdomain for user
      const subTokenURI = "https://example.com/subdomain";
      const label = "controlled-subdomain-2";
      await zns.subRegistrar.connect(operator).registerSubdomain({
        parentHash: baseRootDomainHash,
        label,
        domainAddress: subOwner.address,
        tokenOwner: subOwner.address,
        tokenURI: subTokenURI,
        distrConfig: distrConfigEmpty,
        paymentConfig: paymentConfigEmpty,
      });

      // check that the subdomain is registered
      const newSubHash = await getDomainHashFromEvent({
        zns,
        user: parentOwner,
      });

      // check that the subdomain is registered
      const subHashRef = await zns.subRegistrar.hashWithParent(
        baseRootDomainHash,
        label,
      );
      expect(newSubHash).to.equal(subHashRef);

      const record = await zns.registry.getDomainRecord(newSubHash);
      const { owner: ownerFromContr, resolver } = record;
      expect(resolver).to.equal(zns.addressResolver.target);
      expect(ownerFromContr).to.equal(parentOwner.address);

      const subTokenOwner = await zns.domainToken.ownerOf(newSubHash);
      expect(subTokenOwner).to.equal(subOwner.address);
      const tokenUriFromContract = await zns.domainToken.tokenURI(newSubHash);
      expect(tokenUriFromContract).to.equal(subTokenURI);

      const domainResolution = await zns.addressResolver.resolveDomainAddress(newSubHash);
      expect(domainResolution).to.equal(subOwner.address);
    });

    // eslint-disable-next-line max-len
    it("should revert when trying to register a subdomain as anyone other than owner or operator of parent", async () => {
      await expect(
        zns.subRegistrar.connect(subOwner).registerSubdomain(
          {
            parentHash: baseRootDomainHash,
            label: "controlled-subdomain-2",
            domainAddress: subOwner.address,
            tokenOwner: subOwner.address,
            tokenURI: "dummy-token-uri",
            distrConfig: distrConfigEmpty,
            paymentConfig: paymentConfigEmpty,
          }
        ),
      ).to.be.revertedWithCustomError(
        zns.subRegistrar,
        DISTRIBUTION_LOCKED_NOT_EXIST_ERR,
      );
    });

    it("should register a controlled root domain by assigning token owner to a separate address", async () => {
      const record = await zns.registry.getDomainRecord(controlledRootHash);
      const { owner: ownerFromContr, resolver } = record;
      expect(resolver).to.equal(zns.addressResolver.target);
      expect(ownerFromContr).to.equal(rootOwner.address);

      const subTokenOwner = await zns.domainToken.ownerOf(controlledRootHash);
      expect(subTokenOwner).to.equal(deployer.address);

      const domainResolution = await zns.addressResolver.resolveDomainAddress(controlledRootHash);
      expect(domainResolution).to.equal(rootOwner.address);
    });
  });

  describe("Domain Management", () => {
    [
      "Root Domain",
      "Subdomain",
    ].forEach(name => {
      let owner : SignerWithAddress;
      let tokenOwner : SignerWithAddress;
      let hash : string;
      let operatorLocal : SignerWithAddress;

      before(async () => {
        const ctx = await loadFixture(makeSetupFixture);
        ({ operator: operatorLocal } = ctx);

        if (name === "Root Domain") {
          ({
            rootOwner: owner,
            deployer: tokenOwner,
            controlledRootHash: hash,
          } = ctx);
        } else {
          ({
            parentOwner: owner,
            subOwner: tokenOwner,
            controlledSubHash: hash,
          } = ctx);
        }
      });

      it(`should NOT let ${name} token owner access domain management functions`, async () => {
        await expect(
          zns.subRegistrar.connect(tokenOwner).setPricerDataForDomain(
            controlledSubHash,
            DEFAULT_CURVE_PRICE_CONFIG_BYTES,
            await zns.fixedPricer.getAddress(),
          )
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          NOT_AUTHORIZED_ERR,
        );

        await expect(
          zns.subRegistrar.connect(tokenOwner).setDistributionConfigForDomain(
            controlledSubHash,
            distrConfigEmpty,
          )
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          NOT_AUTHORIZED_ERR,
        );

        await expect(
          zns.treasury.connect(tokenOwner).setPaymentConfig(
            controlledSubHash,
            paymentConfigEmpty,
          )
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          NOT_AUTHORIZED_ERR,
        );

        await expect(
          zns.registry.connect(tokenOwner).updateDomainOwner(
            controlledSubHash,
            tokenOwner.address,
          )
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          NOT_AUTHORIZED_ERR,
        );

        await expect(
          zns.addressResolver.connect(tokenOwner).setAddress(
            controlledSubHash,
            tokenOwner.address,
          )
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          NOT_AUTHORIZED_ERR,
        );
      });

      it("should allow registry owner or operator of a controlled domain mint its subdomains", async () => {
        // make sure parent domain is LOCKED in SubRegistrar
        const { accessType } = await zns.subRegistrar.distrConfigs(controlledSubHash);
        expect(accessType).to.equal(AccessType.LOCKED);

        await [owner, operatorLocal].reduce(
          async (acc, signer, idx) => {
            // register subdomain for user
            const subTokenURI = "https://example.com/subdomain";
            const label = `contr-sub-${idx}`;
            await zns.subRegistrar.connect(signer).registerSubdomain({
              parentHash: hash,
              label,
              domainAddress: owner.address,
              tokenOwner: owner.address,
              tokenURI: subTokenURI,
              distrConfig: distrConfigEmpty,
              paymentConfig: paymentConfigEmpty,
            });

            // check that the subdomain is registered
            const newSubHash = await getDomainHashFromEvent({
              zns,
              user: owner,
            });

            const record = await zns.registry.getDomainRecord(newSubHash);
            const { owner: ownerFromContr, resolver } = record;
            expect(resolver).to.equal(zns.addressResolver.target);
            expect(ownerFromContr).to.equal(owner.address);

            const subTokenOwner = await zns.domainToken.ownerOf(newSubHash);
            expect(subTokenOwner).to.equal(owner.address);
            const tokenUriFromContract = await zns.domainToken.tokenURI(newSubHash);
            expect(tokenUriFromContract).to.equal(subTokenURI);

            const domainResolution = await zns.addressResolver.resolveDomainAddress(newSubHash);
            expect(domainResolution).to.equal(owner.address);
          }, Promise.resolve()
        );
      });

      describe(`${name} Token Rights and Transfers`, () => {
        it("should NOT allow controlled domain owner (token owner only) to transfer the token", async () => {
          const curTokenOwner = await zns.domainToken.ownerOf(hash);
          const registryOwner = await zns.registry.getDomainOwner(hash);
          expect(registryOwner).to.not.equal(curTokenOwner);

          await expect(
            zns.domainToken.connect(tokenOwner).transferFrom(
              tokenOwner.address,
              deployer.address,
              hash,
            )
          ).to.be.revertedWithCustomError(
            zns.domainToken,
            NOT_FULL_OWNER_ERR,
          );

          // check both safeTransferFrom versions
          await expect(
            zns.domainToken.connect(tokenOwner)["safeTransferFrom(address,address,uint256)"](
              tokenOwner.address,
              deployer.address,
              hash,
            )
          ).to.be.revertedWithCustomError(
            zns.domainToken,
            NOT_FULL_OWNER_ERR,
          );

          await expect(
            zns.domainToken.connect(tokenOwner)["safeTransferFrom(address,address,uint256,bytes)"](
              tokenOwner.address,
              deployer.address,
              hash,
              "0x",
            )
          ).to.be.revertedWithCustomError(
            zns.domainToken,
            NOT_FULL_OWNER_ERR,
          );
        });

        it("should NOT allow approved spender to transfer the controlled domain token", async () => {
          const tokenOwnerLocal = await zns.domainToken.ownerOf(controlledSubHash);
          const registryOwner = await zns.registry.getDomainOwner(controlledSubHash);
          expect(registryOwner).to.not.equal(tokenOwnerLocal);

          await zns.domainToken.connect(subOwner).approve(deployer.address, controlledSubHash);

          await expect(
            zns.domainToken.connect(deployer).transferFrom(
              subOwner.address,
              deployer.address,
              controlledSubHash,
            )
          ).to.be.revertedWithCustomError(
            zns.domainToken,
            NOT_FULL_OWNER_ERR,
          );
        });

        // eslint-disable-next-line max-len
        it("should allow registry owner to reassign ownership of the controlled domain token back to himself or anyone else", async () => {
          const curTokenOwner = await zns.domainToken.ownerOf(hash);
          const registryOwner = await zns.registry.getDomainOwner(hash);
          expect(registryOwner).to.not.equal(curTokenOwner);

          await zns.rootRegistrar.connect(owner).assignDomainToken(hash, owner.address);

          // validate
          const newTokenOwner = await zns.domainToken.ownerOf(hash);
          const newRegistryOwner = await zns.registry.getDomainOwner(hash);
          expect(newTokenOwner).to.equal(owner.address);
          expect(newRegistryOwner).to.equal(owner.address);

          // assign it back to the user
          await zns.rootRegistrar.connect(owner).assignDomainToken(hash, tokenOwner.address);
          const tokenOwnerAfter = await zns.domainToken.ownerOf(hash);
          const registryOwnerAfter = await zns.registry.getDomainOwner(hash);
          expect(tokenOwnerAfter).to.equal(tokenOwner.address);
          expect(registryOwnerAfter).to.equal(owner.address);

          // now assign to someone else
          await zns.rootRegistrar.connect(owner).assignDomainToken(hash, operatorLocal.address);
          const tokenOwnerAfter2 = await zns.domainToken.ownerOf(hash);
          const registryOwnerAfter2 = await zns.registry.getDomainOwner(hash);
          expect(tokenOwnerAfter2).to.equal(operatorLocal.address);
          expect(registryOwnerAfter2).to.equal(owner.address);
        });

        it("should allow approved spender to transfer the subdomain token if owner is unified", async () => {
          const curTokenOwner = await zns.domainToken.ownerOf(hash);
          const registryOwner = await zns.registry.getDomainOwner(hash);
          try {
            expect(registryOwner).to.equal(curTokenOwner);
          } catch {
            await zns.rootRegistrar.connect(owner).assignDomainToken(hash, owner.address);
          }

          await zns.domainToken.connect(owner).approve(deployer.address, hash);

          await zns.domainToken.connect(deployer).transferFrom(
            owner.address,
            tokenOwner.address,
            hash,
          );

          // validate
          const newTokenOwner = await zns.domainToken.ownerOf(hash);
          const newRegistryOwner = await zns.registry.getDomainOwner(hash);
          expect(newTokenOwner).to.equal(tokenOwner.address);
          expect(newRegistryOwner).to.equal(tokenOwner.address);

          // reset back to the original controlled ownership (give ownership back to parent)
          await zns.registry.connect(tokenOwner).updateDomainOwner(hash, owner.address);
        });
      });

      describe(`${name} Revocation`, () => {
        it("should NOT allow domain token owner to revoke his domain", async () => {
          await expect(
            zns.rootRegistrar.connect(tokenOwner).revokeDomain(hash)
          ).to.be.revertedWithCustomError(
            zns.rootRegistrar,
            NOT_AUTHORIZED_ERR,
          );
        });

        it("should allow domain owner in registry to revoke subdomain", async () => {
          const curTokenOwner = await zns.domainToken.ownerOf(hash);
          const registryOwner = await zns.registry.getDomainOwner(hash);

          // if in this test owner is unified already, we are splitting it again to test
          // that Registry owner can revoke the subdomain if owners are split
          try {
            expect(registryOwner).to.not.equal(curTokenOwner);
          } catch {
            await zns.registry.connect(tokenOwner).updateDomainOwner(hash, owner.address);
          }

          await zns.rootRegistrar.connect(owner).revokeDomain(hash);

          // check that the subdomain is revoked
          const record = await zns.registry.getDomainRecord(hash);
          const { owner: ownerFromContr, resolver } = record;
          expect(ownerFromContr).to.equal(hre.ethers.ZeroAddress);
          expect(resolver).to.equal(hre.ethers.ZeroAddress);

          // check that the token is burned
          await expect(zns.domainToken.ownerOf(hash)).to.be.revertedWithCustomError(
            zns.domainToken,
            NONEXISTENT_TOKEN_ERC_ERR,
          );
        });
      });
    });
  });
});
