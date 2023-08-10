import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  IDomainConfigForTest,
  IPathRegResult,
  ZNSContracts,
} from "./helpers/types";
import {
  deployZNS, getPriceObject,
  INVALID_TOKENID_ERC_ERR,
  ONLY_NAME_OWNER_REG_ERR,
  priceConfigDefault,
} from "./helpers";
import * as hre from "hardhat";
import * as ethers from "ethers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { validatePathRegistration, registerDomainPath } from "./helpers/flows/registration";
import assert from "assert";


describe("ZNSSubdomainRegistrar", () => {
  let deployer : SignerWithAddress;
  let rootOwner : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let lvl2SubOwner : SignerWithAddress;
  let lvl3SubOwner : SignerWithAddress;
  let lvl4SubOwner : SignerWithAddress;
  let lvl5SubOwner : SignerWithAddress;
  let lvl6SubOwner : SignerWithAddress;
  let branchLvl1Owner : SignerWithAddress;
  let branchLvl2Owner : SignerWithAddress;

  let zns : ZNSContracts;
  let zeroVault : SignerWithAddress;

  describe("6 level path (5 subdomains) with all possible configs", () => {
    let domainConfigs : Array<IDomainConfigForTest>;
    let regResults : Array<IPathRegResult>;

    const fixedPrice = ethers.utils.parseEther("1375.612");

    before(async () => {
      [
        deployer,
        zeroVault,
        governor,
        admin,
        rootOwner,
        lvl2SubOwner,
        lvl3SubOwner,
        lvl4SubOwner,
        lvl5SubOwner,
        lvl6SubOwner,
        branchLvl1Owner,
        branchLvl2Owner,
      ] = await hre.ethers.getSigners();
      // zeroVault address is used to hold the fee charged to the user when registering
      zns = await deployZNS({
        deployer,
        governorAddresses: [deployer.address, governor.address],
        adminAddresses: [admin.address],
        priceConfig: priceConfigDefault,
        zeroVaultAddress: zeroVault.address,
      });

      // Give funds to user
      await zns.zeroToken.connect(rootOwner).approve(zns.treasury.address, ethers.constants.MaxUint256);
      await zns.zeroToken.mint(rootOwner.address, ethers.utils.parseEther("1000000"));
      await zns.zeroToken.mint(lvl2SubOwner.address, ethers.utils.parseEther("1000000"));
      await zns.zeroToken.mint(lvl3SubOwner.address, ethers.utils.parseEther("1000000"));
      await zns.zeroToken.mint(lvl4SubOwner.address, ethers.utils.parseEther("1000000"));
      await zns.zeroToken.mint(lvl5SubOwner.address, ethers.utils.parseEther("1000000"));
      await zns.zeroToken.mint(lvl6SubOwner.address, ethers.utils.parseEther("1000000"));
      await zns.zeroToken.mint(branchLvl1Owner.address, ethers.utils.parseEther("1000000"));
      await zns.zeroToken.mint(branchLvl2Owner.address, ethers.utils.parseEther("1000000"));

      domainConfigs = [
        {
          user: rootOwner,
          domainLabel: "root",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.fixedPricing.address,
              paymentContract: zns.directPayment.address,
              accessType: 1,
            },
            priceConfig: fixedPrice,
            paymentConfig: {
              paymentToken: zns.zeroToken.address,
              beneficiary: rootOwner.address,
            },
          },
        },
        {
          user: lvl2SubOwner,
          domainLabel: "lvltwo",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.asPricing.address,
              paymentContract: zns.stakePayment.address,
              accessType: 1,
            },
            priceConfig: priceConfigDefault,
            paymentConfig: {
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl2SubOwner.address,
            },
          },
        },
        {
          user: lvl3SubOwner,
          domainLabel: "lvlthree",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.asPricing.address,
              paymentContract: zns.directPayment.address,
              accessType: 1,
            },
            priceConfig: priceConfigDefault,
            paymentConfig: {
              // TODO sub: test with different ERC20 tokens as paymentTokens
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl3SubOwner.address,
            },
          },
        },
        {
          user: lvl4SubOwner,
          domainLabel: "lvlfour",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.asPricing.address,
              paymentContract: zns.stakePayment.address,
              accessType: 1,
            },
            priceConfig: priceConfigDefault,
            paymentConfig: {
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl4SubOwner.address,
            },
          },
        },
        {
          user: lvl5SubOwner,
          domainLabel: "lvlfive",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.fixedPricing.address,
              paymentContract: zns.directPayment.address,
              accessType: 1,
            },
            priceConfig: fixedPrice,
            paymentConfig: {
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl5SubOwner.address,
            },
          },
        },
        {
          user: lvl6SubOwner,
          domainLabel: "lvlsix",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.asPricing.address,
              paymentContract: zns.stakePayment.address,
              accessType: 1,
            },
            priceConfig: priceConfigDefault,
            paymentConfig: {
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl6SubOwner.address,
            },
          },
        },
      ];

      regResults = await registerDomainPath({
        zns,
        domainConfigs,
      });

      assert.equal(regResults.length, domainConfigs.length);
    });

    it("should register a path of 6 domains with different configs", async () => {
      await validatePathRegistration({
        zns,
        domainConfigs,
        regResults,
      });
    });

    it("should revoke lvl 6 domain without refund", async () => {
      const domainHash = regResults[5].domainHash;
      const parentHash = regResults[4].domainHash;

      const userBalBefore = await zns.zeroToken.balanceOf(lvl6SubOwner.address);

      await zns.subdomainRegistrar.connect(lvl6SubOwner).revokeSubdomain(
        parentHash,
        domainHash,
      );

      const userBalAfter = await zns.zeroToken.balanceOf(lvl6SubOwner.address);

      expect(userBalAfter.sub(userBalBefore)).to.eq(0);

      const dataFromReg = await zns.registry.getDomainRecord(domainHash);
      expect(dataFromReg.owner).to.eq(ethers.constants.AddressZero);
      expect(dataFromReg.resolver).to.eq(ethers.constants.AddressZero);

      const tokenId = BigNumber.from(domainHash).toString();
      await expect(
        zns.domainToken.ownerOf(tokenId)
      ).to.be.revertedWith(
        INVALID_TOKENID_ERC_ERR
      );

      await expect(
        zns.registry.connect(lvl6SubOwner).updateDomainRecord(domainHash, rootOwner.address, lvl6SubOwner.address)
      ).to.be.revertedWith(ONLY_NAME_OWNER_REG_ERR);
    });

    it("should revoke lvl 5 domain with refund", async () => {
      const domainHash = regResults[4].domainHash;
      const parentHash = regResults[3].domainHash;
      const {
        fullConfig: {
          distrConfig: {
            paymentContract,
          },
        },
      } = domainConfigs[3];

      const userBalanceBefore = await zns.zeroToken.balanceOf(lvl5SubOwner.address);
      const parentBalBefore = await zns.zeroToken.balanceOf(lvl4SubOwner.address);
      const paymentContractBalBefore = await zns.zeroToken.balanceOf(paymentContract);

      await zns.subdomainRegistrar.connect(lvl5SubOwner).revokeSubdomain(parentHash, domainHash);

      const userBalAfter = await zns.zeroToken.balanceOf(lvl5SubOwner.address);
      const parentBalAfter = await zns.zeroToken.balanceOf(lvl4SubOwner.address);
      const paymentContractBalAfter = await zns.zeroToken.balanceOf(paymentContract);

      const { expectedPrice } = getPriceObject(domainConfigs[4].domainLabel);

      expect(
        userBalAfter.sub(userBalanceBefore)
      ).to.eq(
        expectedPrice
      );
      expect(
        parentBalBefore.sub(parentBalAfter)
      ).to.eq(
        BigNumber.from(0)
      );
      expect(
        paymentContractBalBefore.sub(paymentContractBalAfter)
      ).to.eq(
        expectedPrice
      );

      const dataFromReg = await zns.registry.getDomainRecord(domainHash);
      expect(dataFromReg.owner).to.eq(ethers.constants.AddressZero);
      expect(dataFromReg.resolver).to.eq(ethers.constants.AddressZero);

      const tokenId = BigNumber.from(domainHash).toString();
      await expect(
        zns.domainToken.ownerOf(tokenId)
      ).to.be.revertedWith(
        INVALID_TOKENID_ERC_ERR
      );

      await expect(
        zns.registry.connect(lvl5SubOwner).updateDomainRecord(domainHash, rootOwner.address, lvl6SubOwner.address)
      ).to.be.revertedWith(ONLY_NAME_OWNER_REG_ERR);
    });

    it("should register a new 2 lvl path at lvl 3 of the existing path", async () => {
      const newConfigs = [
        {
          user: branchLvl1Owner,
          domainLabel: "lvlthreenew",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.fixedPricing.address,
              paymentContract: zns.directPayment.address,
              accessType: 1,
            },
            priceConfig: fixedPrice,
            paymentConfig: {
              paymentToken: zns.zeroToken.address,
              beneficiary: branchLvl1Owner.address,
            },
          },
        },
        {
          user: branchLvl2Owner,
          domainLabel: "lvlfournew",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.asPricing.address,
              paymentContract: zns.stakePayment.address,
              accessType: 1,
            },
            priceConfig: priceConfigDefault,
            paymentConfig: {
              paymentToken: zns.zeroToken.address,
              beneficiary: branchLvl2Owner.address,
            },
          },
        },
      ];

      const newRegResults = await registerDomainPath({
        zns,
        domainConfigs: newConfigs,
      });

      await validatePathRegistration({
        zns,
        domainConfigs: newConfigs,
        regResults: newRegResults,
      });
    });

    it("should properly revoke lvl 3 domain (child) with refund after lvl 2 (parent) has been revoked", async () => {
      const lvl1Hash = regResults[0].domainHash;
      const lvl2Hash = regResults[1].domainHash;
      const lvl3Hash = regResults[2].domainHash;

      const childExists = await zns.registry.exists(lvl3Hash);
      assert.ok(childExists);

      // revoke parent
      await zns.subdomainRegistrar.connect(lvl2SubOwner).revokeSubdomain(
        lvl1Hash,
        lvl2Hash,
      );

      // make sure all parent's distribution configs still exist
      const parentDistrConfig = await zns.subdomainRegistrar.distrConfigs(lvl2Hash);
      expect(parentDistrConfig.pricingContract).to.eq(domainConfigs[1].fullConfig.distrConfig.pricingContract);
      expect(parentDistrConfig.paymentContract).to.eq(domainConfigs[1].fullConfig.distrConfig.paymentContract);

      expect(parentDistrConfig.pricingContract).to.eq(zns.asPricing.address);
      expect(parentDistrConfig.paymentContract).to.eq(zns.stakePayment.address);
      // check a couple of fields from price config
      const priceConfig = await zns.asPricing.priceConfigs(lvl2Hash);
      if ("maxPrice" in domainConfigs[1].fullConfig.priceConfig) {
        expect(priceConfig.maxPrice).to.eq(domainConfigs[1].fullConfig.priceConfig.maxPrice);
      }
      if ("minPrice" in domainConfigs[1].fullConfig.priceConfig) {
        expect(priceConfig.minPrice).to.eq(domainConfigs[1].fullConfig.priceConfig.minPrice);
      }
      // make sure the child's stake is still there
      const childStakedAmt = await zns.stakePayment.stakedForDomain(lvl3Hash);
      const { expectedPrice } = getPriceObject(domainConfigs[2].domainLabel);

      expect(childStakedAmt).to.eq(expectedPrice);

      const userBalBefore = await zns.zeroToken.balanceOf(lvl3SubOwner.address);

      // revoke child
      await zns.subdomainRegistrar.connect(lvl3SubOwner).revokeSubdomain(
        lvl2Hash,
        lvl3Hash,
      );

      const userBalAfter = await zns.zeroToken.balanceOf(lvl3SubOwner.address);

      expect(userBalAfter.sub(userBalBefore)).to.eq(expectedPrice);

      const childExistsAfter = await zns.registry.exists(lvl3Hash);
      assert.ok(!childExistsAfter);

      const dataFromReg = await zns.registry.getDomainRecord(lvl3Hash);
      expect(dataFromReg.owner).to.eq(ethers.constants.AddressZero);
      expect(dataFromReg.resolver).to.eq(ethers.constants.AddressZero);

      const tokenId = BigNumber.from(lvl3Hash).toString();
      await expect(
        zns.domainToken.ownerOf(tokenId)
      ).to.be.revertedWith(
        INVALID_TOKENID_ERC_ERR
      );

      await expect(
        zns.registry.connect(lvl3SubOwner).updateDomainRecord(lvl3Hash, rootOwner.address, lvl4SubOwner.address)
      ).to.be.revertedWith(ONLY_NAME_OWNER_REG_ERR);
    });

    // TODO sub: is this a case we want to support ???
    // how do we handle these cases? we do not remove pricing/payment configs when parent revokes
    // to allow for refunds if needed. we can make paymentToken 0x0 address, making all subsequent registrations free
    // but this will block refunding when children are revoked.
    // if we do not make token a 0x0 address, then new subdomains will still pay the parent
    // even though it has been revoked
    // what do we do here ?? this needs a separate PR that will go deep into this and finds a solution
    it("should properly register a child (subdomain) under a parent (root domain) that has been revoked", async () => {
      const lvl1Hash = regResults[0].domainHash;
      const lvl2Hash = regResults[1].domainHash;

      const childExists = await zns.registry.exists(lvl2Hash);
      assert.ok(childExists);

      // revoke parent
      await zns.registrar.connect(rootOwner).revokeDomain(
        lvl1Hash
      );

      const childExistsAfter = await zns.registry.exists(lvl2Hash);
      assert.ok(childExistsAfter);

      const newConfig = [
        {
          user: branchLvl1Owner,
          domainLabel: "lvlthreenewnew",
          parentHash: lvl1Hash,
          isRootDomain: false,
          fullConfig: {
            distrConfig: {
              pricingContract: zns.fixedPricing.address,
              paymentContract: zns.directPayment.address,
              accessType: 1,
            },
            priceConfig: fixedPrice,
            paymentConfig: {
              paymentToken: zns.zeroToken.address,
              beneficiary: branchLvl1Owner.address,
            },
          },
        },
      ];

      const newRegResults = await registerDomainPath({
        zns,
        domainConfigs: newConfig,
      });

      await validatePathRegistration({
        zns,
        domainConfigs: newConfig,
        regResults: newRegResults,
      });
    });

    it("should properly register a child (subdomain) under a parent (subdomain) that has been revoked", async () => {
      const lvl1Hash = regResults[0].domainHash;
      const lvl2Hash = regResults[1].domainHash;
      const lvl3Hash = regResults[2].domainHash;

      const childExists = await zns.registry.exists(lvl3Hash);
      assert.ok(childExists);

      // revoke parent
      await zns.subdomainRegistrar.connect(lvl2SubOwner).revokeSubdomain(
        lvl1Hash,
        lvl2Hash,
      );

      const childExistsAfter = await zns.registry.exists(lvl3Hash);
      assert.ok(childExistsAfter);

      const newConfigs = [
        {
          user: branchLvl2Owner,
          domainLabel: "lvlthreenewnewnew",
          parentHash: lvl2Hash,
          fullConfig: {
            distrConfig: {
              pricingContract: zns.fixedPricing.address,
              paymentContract: zns.directPayment.address,
              accessType: 1,
            },
            priceConfig: fixedPrice,
            paymentConfig: {
              paymentToken: zns.zeroToken.address,
              beneficiary: branchLvl2Owner.address,
            },
          },
        },
      ];

      const newRegResults = await registerDomainPath({
        zns,
        domainConfigs: newConfigs,
      });

      await validatePathRegistration({
        zns,
        domainConfigs: newConfigs,
        regResults: newRegResults,
      });
    });
  });
});

// TODO sub: Some tests to do:
// -  domain registration with invalid input (e.g., empty name, invalid characters)
// -  different access scenarios (open to all, whitelist-based, locked)
// -  unauthorized access attempts and ensure they are rejected
// -  scenarios where payment fails (insufficient funds, wrong token, etc.)
// -  locking/unlocking of domains.
// -  adding/removing addresses to/from the whitelist.
// -  transferring ownership of domains and subdomains
// -  scenarios where transfer fails (e.g., incorrect permissions).
// -  accessing and managing nested subdomains.
// -  registering domains with long names (max length).
// -  registering domains with very short names.
// -  using different ERC-20 tokens for payments.
// -  using tokens with varying decimal places.
// -  boundary values for pricing tiers and other numeric parameters.
// -  scenarios where users need to approve token allowances.
// -  cases where allowances are insufficient for the transaction.
// -  upgrading the contract while maintaining data integrity.