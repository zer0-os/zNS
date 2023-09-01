import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IDomainConfigForTest, IPathRegResult, ZNSContracts } from "../helpers/types";
import {
  AccessType,
  ADMIN_ROLE,
  deployZNS,
  distrConfigEmpty,
  DISTRIBUTION_LOCKED_ERR,
  fullDistrConfigEmpty,
  getAccessRevertMsg,
  getPriceObject,
  getStakingOrProtocolFee,
  INVALID_TOKENID_ERC_ERR,
  ONLY_NAME_OWNER_REG_ERR,
  PaymentType,
  priceConfigDefault,
} from "../helpers";
import * as hre from "hardhat";
import * as ethers from "ethers";
import { BigNumber } from "ethers";
import { expect } from "chai";
import { registerDomainPath, validatePathRegistration } from "../helpers/flows/registration";
import assert from "assert";
import { registrationWithSetup } from "../helpers/register-setup";
import { getDomainHashFromEvent } from "../helpers/events";
import { time } from "@nomicfoundation/hardhat-network-helpers";


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
  let random : SignerWithAddress;
  let operator : SignerWithAddress;

  let zns : ZNSContracts;
  let zeroVault : SignerWithAddress;

  describe("Operations within domain paths", () => {
    let domainConfigs : Array<IDomainConfigForTest>;
    let regResults : Array<IPathRegResult>;

    const fixedPrice = ethers.utils.parseEther("1375.612");
    const fixedFeePercentage = BigNumber.from(200);

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

      // Give funds to users
      await Promise.all(
        [
          rootOwner,
          lvl2SubOwner,
          lvl3SubOwner,
          lvl4SubOwner,
          lvl5SubOwner,
          lvl6SubOwner,
          branchLvl1Owner,
          branchLvl2Owner,
        ].map(async ({ address }) =>
          zns.zeroToken.mint(address, ethers.utils.parseEther("1000000")))
      );
      await zns.zeroToken.connect(rootOwner).approve(zns.treasury.address, ethers.constants.MaxUint256);

      domainConfigs = [
        {
          user: rootOwner,
          domainLabel: "root",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.fixedPricing.address,
              paymentConfig: {
                paymentType: PaymentType.DIRECT,
                paymentToken: zns.zeroToken.address,
                beneficiary: rootOwner.address,
              },
              accessType: AccessType.OPEN,
            },
            priceConfig: { price: fixedPrice, feePercentage: BigNumber.from(0) },
          },
        },
        {
          user: lvl2SubOwner,
          domainLabel: "lvltwo",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.asPricing.address,
              paymentConfig: {
                paymentType: PaymentType.STAKE,
                paymentToken: zns.zeroToken.address,
                beneficiary: lvl2SubOwner.address,
              },
              accessType: AccessType.OPEN,
            },
            priceConfig: priceConfigDefault,
          },
        },
        {
          user: lvl3SubOwner,
          domainLabel: "lvlthree",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.asPricing.address,
              paymentConfig: {
                // TODO sub: test with different ERC20 tokens as paymentTokens
                paymentType: PaymentType.DIRECT,
                paymentToken: zns.zeroToken.address,
                beneficiary: lvl3SubOwner.address,
              },
              accessType: AccessType.OPEN,
            },
            priceConfig: priceConfigDefault,
          },
        },
        {
          user: lvl4SubOwner,
          domainLabel: "lvlfour",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.asPricing.address,
              paymentConfig: {
                paymentType: PaymentType.STAKE,
                paymentToken: zns.zeroToken.address,
                beneficiary: lvl4SubOwner.address,
              },
              accessType: AccessType.OPEN,
            },
            priceConfig: priceConfigDefault,

          },
        },
        {
          user: lvl5SubOwner,
          domainLabel: "lvlfive",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.fixedPricing.address,
              paymentConfig: {
                paymentType: PaymentType.DIRECT,
                paymentToken: zns.zeroToken.address,
                beneficiary: lvl5SubOwner.address,
              },
              accessType: AccessType.OPEN,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },

          },
        },
        {
          user: lvl6SubOwner,
          domainLabel: "lvlsix",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.asPricing.address,
              paymentConfig: {
                paymentType: PaymentType.STAKE,
                paymentToken: zns.zeroToken.address,
                beneficiary: lvl6SubOwner.address,
              },
              accessType: AccessType.OPEN,
            },
            priceConfig: priceConfigDefault,
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

    it("should revoke lvl 6 domain without refund and lock registration", async () => {
      const domainHash = regResults[5].domainHash;

      const userBalBefore = await zns.zeroToken.balanceOf(lvl6SubOwner.address);

      await zns.subdomainRegistrar.connect(lvl6SubOwner).revokeSubdomain(
        domainHash,
      );

      const userBalAfter = await zns.zeroToken.balanceOf(lvl6SubOwner.address);

      expect(userBalAfter.sub(userBalBefore)).to.eq(0);

      // make sure that accessType has been set to LOCKED
      // and nobody can register a subdomain under this domain
      const { accessType: accessTypeFromSC } = await zns.subdomainRegistrar.distrConfigs(domainHash);
      expect(accessTypeFromSC).to.eq(AccessType.LOCKED);

      await expect(
        zns.subdomainRegistrar.connect(lvl6SubOwner).registerSubdomain(
          domainHash,
          "newsubdomain",
          lvl6SubOwner.address,
          distrConfigEmpty,
        )
      ).to.be.revertedWith(
        DISTRIBUTION_LOCKED_ERR
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
        zns.registry.connect(lvl6SubOwner).updateDomainRecord(domainHash, rootOwner.address, lvl6SubOwner.address)
      ).to.be.revertedWith(ONLY_NAME_OWNER_REG_ERR);
    });

    it("should revoke lvl 5 domain with refund", async () => {
      const domainHash = regResults[4].domainHash;

      const userBalanceBefore = await zns.zeroToken.balanceOf(lvl5SubOwner.address);
      const parentBalBefore = await zns.zeroToken.balanceOf(lvl4SubOwner.address);
      const paymentContractBalBefore = await zns.zeroToken.balanceOf(zns.treasury.address);

      await zns.subdomainRegistrar.connect(lvl5SubOwner).revokeSubdomain(domainHash);

      const userBalAfter = await zns.zeroToken.balanceOf(lvl5SubOwner.address);
      const parentBalAfter = await zns.zeroToken.balanceOf(lvl4SubOwner.address);
      const paymentContractBalAfter = await zns.zeroToken.balanceOf(zns.treasury.address);

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

      // make sure that accessType has been set to LOCKED
      // and nobody can register a subdomain under this domain
      const { accessType: accessTypeFromSC } = await zns.subdomainRegistrar.distrConfigs(domainHash);
      expect(accessTypeFromSC).to.eq(AccessType.LOCKED);

      await expect(
        zns.subdomainRegistrar.connect(lvl6SubOwner).registerSubdomain(
          domainHash,
          "newsubdomain",
          lvl6SubOwner.address,
          distrConfigEmpty,
        )
      ).to.be.revertedWith(
        DISTRIBUTION_LOCKED_ERR
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
          parentHash: regResults[2].domainHash,
          fullConfig: {
            distrConfig: {
              pricingContract: zns.fixedPricing.address,
              paymentConfig: {
                paymentType: PaymentType.DIRECT,
                paymentToken: zns.zeroToken.address,
                beneficiary: branchLvl1Owner.address,
              },
              accessType: AccessType.OPEN,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
          },
        },
        {
          user: branchLvl2Owner,
          domainLabel: "lvlfournew",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.asPricing.address,
              paymentConfig: {
                paymentType: PaymentType.STAKE,
                paymentToken: zns.zeroToken.address,
                beneficiary: branchLvl2Owner.address,
              },
              accessType: AccessType.OPEN,
            },
            priceConfig: priceConfigDefault,
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

    it("should revoke lvl 3 domain (child) with refund after lvl 2 (parent) has been revoked", async () => {
      const lvl2Hash = regResults[1].domainHash;
      const lvl3Hash = regResults[2].domainHash;

      const childExists = await zns.registry.exists(lvl3Hash);
      assert.ok(childExists);

      // revoke parent
      await zns.subdomainRegistrar.connect(lvl2SubOwner).revokeSubdomain(
        lvl2Hash,
      );

      // make sure all parent's distribution configs still exist
      const parentDistrConfig = await zns.subdomainRegistrar.distrConfigs(lvl2Hash);
      expect(parentDistrConfig.pricingContract).to.eq(domainConfigs[1].fullConfig.distrConfig.pricingContract);
      expect(
        parentDistrConfig.paymentConfig.paymentType
      ).to.eq(
        domainConfigs[1].fullConfig.distrConfig.paymentConfig.paymentType
      );
      expect(
        parentDistrConfig.paymentConfig.paymentToken
      ).to.eq(
        domainConfigs[1].fullConfig.distrConfig.paymentConfig.paymentToken
      );
      expect(
        parentDistrConfig.paymentConfig.beneficiary
      ).to.eq(
        domainConfigs[1].fullConfig.distrConfig.paymentConfig.beneficiary
      );

      expect(parentDistrConfig.pricingContract).to.eq(zns.asPricing.address);

      // check a couple of fields from price config
      const priceConfig = await zns.asPricing.priceConfigs(lvl2Hash);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if ("maxPrice" in domainConfigs[1].fullConfig.priceConfig!) {
        expect(priceConfig.maxPrice).to.eq(domainConfigs[1].fullConfig.priceConfig.maxPrice);
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if ("minPrice" in domainConfigs[1].fullConfig.priceConfig!) {
        expect(priceConfig.minPrice).to.eq(domainConfigs[1].fullConfig.priceConfig.minPrice);
      }

      // make sure the child's stake is still there
      const childStakedAmt = await zns.treasury.stakedForDomain(lvl3Hash);
      const { expectedPrice } = getPriceObject(domainConfigs[2].domainLabel);

      expect(childStakedAmt).to.eq(expectedPrice);

      const userBalBefore = await zns.zeroToken.balanceOf(lvl3SubOwner.address);

      // revoke child
      await zns.subdomainRegistrar.connect(lvl3SubOwner).revokeSubdomain(
        lvl3Hash,
      );

      const userBalAfter = await zns.zeroToken.balanceOf(lvl3SubOwner.address);

      expect(userBalAfter.sub(userBalBefore)).to.eq(expectedPrice);

      const childExistsAfter = await zns.registry.exists(lvl3Hash);
      assert.ok(!childExistsAfter);

      const stakedAfterRevoke = await zns.treasury.stakedForDomain(lvl3Hash);
      expect(stakedAfterRevoke).to.eq(0);

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

    // TODO sub: add more tests here:
    //  1. reregister a revoked domain and set your own config and distribute subs
    //  2. after revocation NOONE can register!
    //  3. After a new owner came in on revoked domain, people can register as usual
    //  4. find more cases !
    it("should let anyone register a previously revoked domain", async () => {
      const lvl2Hash = regResults[1].domainHash;
      const parentHash = regResults[0].domainHash;

      const exists = await zns.registry.exists(lvl2Hash);
      if (!exists) {
        const newHash = await registrationWithSetup({
          zns,
          user: lvl2SubOwner,
          parentHash,
          domainLabel: domainConfigs[1].domainLabel,
          fullConfig: fullDistrConfigEmpty,
          isRootDomain: false,
        });

        expect(newHash).to.eq(lvl2Hash);
      }

      // revoke subdomain
      await zns.subdomainRegistrar.connect(lvl2SubOwner).revokeSubdomain(
        lvl2Hash,
      );

      // someone else is taking it
      const newConfig = [
        {
          user: branchLvl1Owner,
          domainLabel: "lvltwonew",
          parentHash,
          fullConfig: {
            distrConfig: {
              pricingContract: zns.fixedPricing.address,
              paymentConfig: {
                paymentType: PaymentType.DIRECT,
                paymentToken: zns.zeroToken.address,
                beneficiary: branchLvl1Owner.address,
              },
              accessType: AccessType.OPEN,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
          },
        },
      ];

      const newResult = await registerDomainPath({
        zns,
        domainConfigs: newConfig,
      });

      await validatePathRegistration({
        zns,
        domainConfigs: newConfig,
        regResults: newResult,
      });
    });

    it("should NOT register a child (subdomain) under a parent (root domain) that has been revoked", async () => {
      const lvl1Hash = regResults[0].domainHash;

      // revoke parent
      await zns.registrar.connect(rootOwner).revokeDomain(
        lvl1Hash
      );

      const exists = await zns.registry.exists(lvl1Hash);
      assert.ok(!exists);

      await expect(
        zns.subdomainRegistrar.connect(branchLvl1Owner).registerSubdomain(
          lvl1Hash,
          "newsubdomain",
          branchLvl1Owner.address,
          distrConfigEmpty,
        )
      ).to.be.revertedWith(DISTRIBUTION_LOCKED_ERR);
    });

    it("should NOT register a child (subdomain) under a parent (subdomain) that has been revoked", async () => {
      const lvl4Hash = regResults[3].domainHash;

      // revoke parent
      await zns.subdomainRegistrar.connect(lvl4SubOwner).revokeSubdomain(
        lvl4Hash,
      );

      const exists = await zns.registry.exists(lvl4Hash);
      assert.ok(!exists);

      await expect(
        zns.subdomainRegistrar.connect(branchLvl2Owner).registerSubdomain(
          lvl4Hash,
          "newsubdomain",
          branchLvl2Owner.address,
          distrConfigEmpty,
        )
      ).to.be.revertedWith(DISTRIBUTION_LOCKED_ERR);
    });
  });

  describe("Token transfers for different distr configs", () => {
    let rootHash : string;
    let fixedPrice : BigNumber;
    let feePercentage : BigNumber;

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

      // Give funds to users
      await Promise.all(
        [
          rootOwner,
          lvl2SubOwner,
          lvl3SubOwner,
          lvl4SubOwner,
          lvl5SubOwner,
          lvl6SubOwner,
          branchLvl1Owner,
          branchLvl2Owner,
        ].map(async ({ address }) =>
          zns.zeroToken.mint(address, ethers.utils.parseEther("1000000")))
      );
      await zns.zeroToken.connect(rootOwner).approve(zns.treasury.address, ethers.constants.MaxUint256);

      fixedPrice = ethers.utils.parseEther("397.13");
      feePercentage = BigNumber.from(200);
      // register root domain
      rootHash = await registrationWithSetup({
        zns,
        user: rootOwner,
        domainLabel: "root",
        fullConfig: {
          distrConfig: {
            accessType: AccessType.OPEN,
            pricingContract: zns.fixedPricing.address,
            paymentConfig: {
              paymentToken: zns.zeroToken.address,
              beneficiary: rootOwner.address,
              paymentType: PaymentType.DIRECT,
            },
          },
          priceConfig: {
            price: fixedPrice,
            feePercentage: BigNumber.from(0),
          },
        },
      });
    });

    it("FixedPricing + StakePayment with stake fee", async () => {
      const priceConfig = {
        price: fixedPrice,
        feePercentage,
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "fixedstake",
        isRootDomain: false,
        fullConfig: {
          distrConfig: {
            pricingContract: zns.fixedPricing.address,
            paymentConfig: {
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl2SubOwner.address,
              paymentType: PaymentType.STAKE,
            },
            accessType: AccessType.OPEN,
          },
          priceConfig,
        },
      });

      const contractBalBefore = await zns.zeroToken.balanceOf(zns.treasury.address);
      const parentBalBefore = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.zeroToken.balanceOf(zeroVault.address);

      const label = "fixedstakechild";

      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
        isRootDomain: false,
        fullConfig: fullDistrConfigEmpty,
      });

      const parentBalAfter = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await zns.zeroToken.balanceOf(zns.treasury.address);
      const zeroVaultBalanceAfter = await zns.zeroToken.balanceOf(zeroVault.address);

      const { expectedPrice, stakeFee: stakeFee } = getPriceObject(label, priceConfig);
      const protocolFee = getStakingOrProtocolFee(expectedPrice.add(stakeFee), priceConfigDefault.feePercentage);

      expect(parentBalAfter.sub(parentBalBefore)).to.eq(stakeFee);
      expect(childBalBefore.sub(childBalAfter)).to.eq(expectedPrice.add(stakeFee).add(protocolFee));
      expect(contractBalAfter.sub(contractBalBefore)).to.eq(expectedPrice);
      expect(zeroVaultBalanceAfter.sub(zeroVaultBalanceBefore)).to.eq(protocolFee);

      // revoke
      await zns.subdomainRegistrar.connect(lvl3SubOwner).revokeSubdomain(
        childHash,
      );

      // should offer refund !
      const contractBalAfterRevoke = await zns.zeroToken.balanceOf(zns.treasury.address);
      const childBalAfterRevoke = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const parentBalAfterRevoke = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const zeroVaultBalanceAfterRevoke = await zns.zeroToken.balanceOf(zeroVault.address);

      expect(contractBalAfter.sub(contractBalAfterRevoke)).to.eq(expectedPrice);
      expect(childBalAfterRevoke.sub(childBalAfter)).to.eq(expectedPrice);
      expect(parentBalAfterRevoke.sub(parentBalAfter)).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke.sub(zeroVaultBalanceAfter)).to.eq(0);
    });

    it("FixedPricing + StakePayment no fee", async () => {
      const priceConfig = {
        price: fixedPrice,
        feePercentage: BigNumber.from(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "fixedstakenofee",
        isRootDomain: false,
        fullConfig: {
          distrConfig: {
            pricingContract: zns.fixedPricing.address,
            accessType: AccessType.OPEN,
            paymentConfig: {
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl2SubOwner.address,
              paymentType: PaymentType.STAKE,
            },
          },
          priceConfig,
        },
      });

      const contractBalBefore = await zns.zeroToken.balanceOf(zns.treasury.address);
      const parentBalBefore = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.zeroToken.balanceOf(zeroVault.address);

      const label = "fixedstakenofeechild";

      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
        isRootDomain: false,
        fullConfig: fullDistrConfigEmpty,
      });

      const parentBalAfter = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await zns.zeroToken.balanceOf(zns.treasury.address);
      const zeroVaultBalanceAfter = await zns.zeroToken.balanceOf(zeroVault.address);

      const { expectedPrice } = getPriceObject(label, priceConfig);
      const protocolFee = getStakingOrProtocolFee(expectedPrice, priceConfigDefault.feePercentage);

      expect(parentBalAfter.sub(parentBalBefore)).to.eq(0);
      expect(childBalBefore.sub(childBalAfter)).to.eq(expectedPrice.add(protocolFee));
      expect(contractBalAfter.sub(contractBalBefore)).to.eq(expectedPrice);
      expect(zeroVaultBalanceAfter.sub(zeroVaultBalanceBefore)).to.eq(protocolFee);

      // revoke
      await zns.subdomainRegistrar.connect(lvl3SubOwner).revokeSubdomain(
        childHash,
      );

      // should offer refund !
      const contractBalAfterRevoke = await zns.zeroToken.balanceOf(zns.treasury.address);
      const childBalAfterRevoke = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const parentBalAfterRevoke = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const zeroVaultBalanceAfterRevoke = await zns.zeroToken.balanceOf(zeroVault.address);

      expect(contractBalAfter.sub(contractBalAfterRevoke)).to.eq(expectedPrice);
      expect(childBalAfterRevoke.sub(childBalAfter)).to.eq(expectedPrice);
      expect(parentBalAfterRevoke.sub(parentBalAfter)).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke.sub(zeroVaultBalanceAfter)).to.eq(0);
    });

    it("FixedPricing + DirectPayment no fee", async () => {
      const priceConfig = {
        price: fixedPrice,
        feePercentage: BigNumber.from(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "fixeddirectnofee",
        isRootDomain: false,
        fullConfig: {
          distrConfig: {
            paymentConfig: {
              paymentType: PaymentType.DIRECT,
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl2SubOwner.address,
            },
            pricingContract: zns.fixedPricing.address,
            accessType: AccessType.OPEN,
          },
          priceConfig,
        },
      });

      const parentBalBefore = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const contractBalBefore = await zns.zeroToken.balanceOf(zns.treasury.address);
      const zeroVaultBalanceBefore = await zns.zeroToken.balanceOf(zeroVault.address);

      const label = "fixeddirectnofeechild";

      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
        isRootDomain: false,
        fullConfig: fullDistrConfigEmpty,
      });

      const parentBalAfter = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await zns.zeroToken.balanceOf(zns.treasury.address);
      const zeroVaultBalanceAfter = await zns.zeroToken.balanceOf(zeroVault.address);

      const { expectedPrice } = getPriceObject(label, priceConfig);
      const protocolFee = getStakingOrProtocolFee(
        expectedPrice,
        priceConfigDefault.feePercentage
      );

      expect(parentBalAfter.sub(parentBalBefore)).to.eq(expectedPrice);
      expect(childBalBefore.sub(childBalAfter)).to.eq(expectedPrice.add(protocolFee));
      expect(contractBalAfter.sub(contractBalBefore)).to.eq(0);
      expect(zeroVaultBalanceAfter.sub(zeroVaultBalanceBefore)).to.eq(protocolFee);

      // revoke
      await zns.subdomainRegistrar.connect(lvl3SubOwner).revokeSubdomain(
        childHash,
      );

      // should NOT offer refund !
      const parentBalAfterRevoke = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalAfterRevoke = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfterRevoke = await zns.zeroToken.balanceOf(zns.treasury.address);
      const zeroVaultBalanceAfterRevoke = await zns.zeroToken.balanceOf(zeroVault.address);

      expect(parentBalAfterRevoke.sub(parentBalAfter)).to.eq(0);
      expect(childBalAfterRevoke.sub(childBalAfter)).to.eq(0);
      expect(contractBalAfterRevoke.sub(contractBalAfter)).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke.sub(zeroVaultBalanceAfter)).to.eq(0);
    });

    it("AsymptoticPricing + StakePayment with stake fee", async () => {
      const priceConfig = priceConfigDefault;

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "asympstake",
        isRootDomain: false,
        fullConfig: {
          distrConfig: {
            paymentConfig: {
              paymentType: PaymentType.STAKE,
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl2SubOwner.address,
            },
            pricingContract: zns.asPricing.address,
            accessType: AccessType.OPEN,
          },
          priceConfig,
        },
      });

      const contractBalBefore = await zns.zeroToken.balanceOf(zns.treasury.address);
      const parentBalBefore = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.zeroToken.balanceOf(zeroVault.address);

      const label = "asstakechild";

      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
        isRootDomain: false,
        fullConfig: fullDistrConfigEmpty,
      });

      const contractBalAfter = await zns.zeroToken.balanceOf(zns.treasury.address);
      const parentBalAfter = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceAfter = await zns.zeroToken.balanceOf(zeroVault.address);

      const { expectedPrice, stakeFee: stakeFee } = getPriceObject(label, priceConfig);
      const protocolFee = getStakingOrProtocolFee(expectedPrice.add(stakeFee), priceConfigDefault.feePercentage);

      expect(parentBalAfter.sub(parentBalBefore)).to.eq(stakeFee);
      expect(childBalBefore.sub(childBalAfter)).to.eq(expectedPrice.add(protocolFee).add(stakeFee));
      expect(contractBalAfter.sub(contractBalBefore)).to.eq(expectedPrice);
      expect(zeroVaultBalanceAfter.sub(zeroVaultBalanceBefore)).to.eq(protocolFee);

      // revoke
      await zns.subdomainRegistrar.connect(lvl3SubOwner).revokeSubdomain(
        childHash,
      );

      // should offer refund !
      const contractBalAfterRevoke = await zns.zeroToken.balanceOf(zns.treasury.address);
      const childBalAfterRevoke = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const parentBalAfterRevoke = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const zeroVaultBalanceAfterRevoke = await zns.zeroToken.balanceOf(zeroVault.address);

      expect(contractBalAfter.sub(contractBalAfterRevoke)).to.eq(expectedPrice);
      expect(childBalAfterRevoke.sub(childBalAfter)).to.eq(expectedPrice);
      expect(parentBalAfterRevoke.sub(parentBalAfter)).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke.sub(zeroVaultBalanceAfter)).to.eq(0);
    });

    it("AsymptoticPricing + StakePayment no fee", async () => {
      const priceConfig = {
        ...priceConfigDefault,
        feePercentage: BigNumber.from(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "asstakenofee",
        isRootDomain: false,
        fullConfig: {
          distrConfig: {
            pricingContract: zns.asPricing.address,
            accessType: AccessType.OPEN,
            paymentConfig: {
              paymentType: PaymentType.STAKE,
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl2SubOwner.address,
            },
          },
          priceConfig,
        },
      });

      const contractBalBefore = await zns.zeroToken.balanceOf(zns.treasury.address);
      const parentBalBefore = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.zeroToken.balanceOf(zeroVault.address);

      const label = "asstakenofeechild";

      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
        isRootDomain: false,
        fullConfig: fullDistrConfigEmpty,
      });

      const contractBalAfter = await zns.zeroToken.balanceOf(zns.treasury.address);
      const parentBalAfter = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceAfter = await zns.zeroToken.balanceOf(zeroVault.address);

      const { expectedPrice } = getPriceObject(label, priceConfig);
      const protocolFee = getStakingOrProtocolFee(expectedPrice, priceConfigDefault.feePercentage);

      expect(parentBalAfter.sub(parentBalBefore)).to.eq(0);
      expect(childBalBefore.sub(childBalAfter)).to.eq(expectedPrice.add(protocolFee));
      expect(contractBalAfter.sub(contractBalBefore)).to.eq(expectedPrice);
      expect(zeroVaultBalanceAfter.sub(zeroVaultBalanceBefore)).to.eq(protocolFee);

      // revoke
      await zns.subdomainRegistrar.connect(lvl3SubOwner).revokeSubdomain(
        childHash,
      );

      // should offer refund !
      const contractBalAfterRevoke = await zns.zeroToken.balanceOf(zns.treasury.address);
      const childBalAfterRevoke = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const parentBalAfterRevoke = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const zeroVaultBalanceAfterRevoke = await zns.zeroToken.balanceOf(zeroVault.address);

      expect(contractBalAfter.sub(contractBalAfterRevoke)).to.eq(expectedPrice);
      expect(childBalAfterRevoke.sub(childBalAfter)).to.eq(expectedPrice);
      expect(parentBalAfterRevoke.sub(parentBalAfter)).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke.sub(zeroVaultBalanceAfter)).to.eq(0);
    });

    it("AsymptoticPricing + DirectPayment no fee", async () => {
      const priceConfig = {
        ...priceConfigDefault,
        feePercentage: BigNumber.from(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "asdirectnofee",
        isRootDomain: false,
        fullConfig: {
          distrConfig: {
            pricingContract: zns.asPricing.address,
            accessType: AccessType.OPEN,
            paymentConfig: {
              paymentType: PaymentType.DIRECT,
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl2SubOwner.address,
            },
          },
          priceConfig,
        },
      });

      const contractBalBefore = await zns.zeroToken.balanceOf(zns.treasury.address);
      const parentBalBefore = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.zeroToken.balanceOf(zeroVault.address);

      const label = "asdirectnofeechild";

      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
        isRootDomain: false,
        fullConfig: fullDistrConfigEmpty,
      });

      const parentBalAfter = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await zns.zeroToken.balanceOf(zns.treasury.address);
      const zeroVaultBalanceAfter = await zns.zeroToken.balanceOf(zeroVault.address);

      const { expectedPrice } = getPriceObject(label, priceConfig);
      const protocolFee = getStakingOrProtocolFee(expectedPrice, priceConfigDefault.feePercentage);

      expect(parentBalAfter.sub(parentBalBefore)).to.eq(expectedPrice);
      expect(childBalBefore.sub(childBalAfter)).to.eq(expectedPrice.add(protocolFee));
      expect(contractBalAfter.sub(contractBalBefore)).to.eq(0);
      expect(zeroVaultBalanceAfter.sub(zeroVaultBalanceBefore)).to.eq(protocolFee);

      // revoke
      await zns.subdomainRegistrar.connect(lvl3SubOwner).revokeSubdomain(
        childHash,
      );

      // should NOT offer refund !
      const parentBalAfterRevoke = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalAfterRevoke = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfterRevoke = await zns.zeroToken.balanceOf(zns.treasury.address);
      const zeroVaultBalanceAfterRevoke = await zns.zeroToken.balanceOf(zeroVault.address);

      expect(parentBalAfterRevoke.sub(parentBalAfter)).to.eq(0);
      expect(childBalAfterRevoke.sub(childBalAfter)).to.eq(0);
      expect(contractBalAfterRevoke.sub(contractBalAfter)).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke.sub(zeroVaultBalanceAfter)).to.eq(0);
    });

    it("FixedPricing + DirectPayment with price = 0 - should NOT perform any transfers", async () => {
      const priceConfig = {
        price: BigNumber.from(0),
        feePercentage: BigNumber.from(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "zeroprice",
        isRootDomain: false,
        fullConfig: {
          distrConfig: {
            pricingContract: zns.fixedPricing.address,
            accessType: AccessType.OPEN,
            paymentConfig: {
              paymentType: PaymentType.DIRECT,
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl2SubOwner.address,
            },
          },
          priceConfig,
        },
      });

      const contractBalBefore = await zns.zeroToken.balanceOf(zns.treasury.address);
      const parentBalBefore = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.zeroToken.balanceOf(zeroVault.address);

      const label = "zeropricechild";
      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
        isRootDomain: false,
        fullConfig: fullDistrConfigEmpty,
      });

      const parentBalAfter = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await zns.zeroToken.balanceOf(zns.treasury.address);
      const zeroVaultBalanceAfter = await zns.zeroToken.balanceOf(zeroVault.address);

      expect(parentBalAfter.sub(parentBalBefore)).to.eq(0);
      expect(childBalBefore.sub(childBalAfter)).to.eq(0);
      expect(contractBalAfter.sub(contractBalBefore)).to.eq(0);
      expect(zeroVaultBalanceAfter.sub(zeroVaultBalanceBefore)).to.eq(0);

      // validate transfer events are not happenning
      const latestBlock = await time.latestBlock();
      const transferFilterToParent = zns.zeroToken.filters.Transfer(lvl3SubOwner.address, lvl2SubOwner.address);
      const transferFilterToTreasury = zns.zeroToken.filters.Transfer(lvl3SubOwner.address, zns.treasury.address);
      const transfersToParent = await zns.zeroToken.queryFilter(
        transferFilterToParent,
        latestBlock - 3,
        latestBlock
      );
      const transfersToTreasury = await zns.zeroToken.queryFilter(
        transferFilterToTreasury,
        latestBlock - 3,
        latestBlock
      );
      expect(transfersToParent.length).to.eq(0);
      expect(transfersToTreasury.length).to.eq(0);

      // revoke
      await zns.subdomainRegistrar.connect(lvl3SubOwner).revokeSubdomain(
        childHash,
      );

      // should NOT offer refund !
      const parentBalAfterRevoke = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalAfterRevoke = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfterRevoke = await zns.zeroToken.balanceOf(zns.treasury.address);
      const zeroVaultBalanceAfterRevoke = await zns.zeroToken.balanceOf(zeroVault.address);

      expect(parentBalAfterRevoke.sub(parentBalAfter)).to.eq(0);
      expect(childBalAfterRevoke.sub(childBalAfter)).to.eq(0);
      expect(contractBalAfterRevoke.sub(contractBalAfter)).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke.sub(zeroVaultBalanceAfter)).to.eq(0);
    });

    it("AsymptoticPricing + DirectPayment with price = 0 - should NOT perform any transfers", async () => {
      const priceConfig = {
        ...priceConfigDefault,
        maxPrice: BigNumber.from(0),
        minPrice: BigNumber.from(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "zeropricead",
        isRootDomain: false,
        fullConfig: {
          distrConfig: {
            pricingContract: zns.asPricing.address,
            accessType: AccessType.OPEN,
            paymentConfig: {
              paymentType: PaymentType.DIRECT,
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl2SubOwner.address,
            },
          },
          priceConfig,
        },
      });

      const contractBalBefore = await zns.zeroToken.balanceOf(zns.treasury.address);
      const parentBalBefore = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.zeroToken.balanceOf(zeroVault.address);

      const label = "zeropricechildad";
      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
        isRootDomain: false,
        fullConfig: fullDistrConfigEmpty,
      });

      const parentBalAfter = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await zns.zeroToken.balanceOf(zns.treasury.address);
      const zeroVaultBalanceAfter = await zns.zeroToken.balanceOf(zeroVault.address);

      expect(parentBalAfter.sub(parentBalBefore)).to.eq(0);
      expect(childBalBefore.sub(childBalAfter)).to.eq(0);
      expect(contractBalAfter.sub(contractBalBefore)).to.eq(0);
      expect(zeroVaultBalanceAfter.sub(zeroVaultBalanceBefore)).to.eq(0);

      // validate transfer events are not happenning
      const latestBlock = await time.latestBlock();
      const transferFilterToParent = zns.zeroToken.filters.Transfer(lvl3SubOwner.address, lvl2SubOwner.address);
      const transferFilterToTreasury = zns.zeroToken.filters.Transfer(lvl3SubOwner.address, zns.treasury.address);
      const transfersToParent = await zns.zeroToken.queryFilter(
        transferFilterToParent,
        latestBlock - 3,
        latestBlock
      );
      const transfersToTreasury = await zns.zeroToken.queryFilter(
        transferFilterToTreasury,
        latestBlock - 3,
        latestBlock
      );
      expect(transfersToParent.length).to.eq(0);
      expect(transfersToTreasury.length).to.eq(0);

      // revoke
      await zns.subdomainRegistrar.connect(lvl3SubOwner).revokeSubdomain(
        childHash,
      );

      // should NOT offer refund !
      const parentBalAfterRevoke = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalAfterRevoke = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfterRevoke = await zns.zeroToken.balanceOf(zns.treasury.address);
      const zeroVaultBalanceAfterRevoke = await zns.zeroToken.balanceOf(zeroVault.address);

      expect(parentBalAfterRevoke.sub(parentBalAfter)).to.eq(0);
      expect(childBalAfterRevoke.sub(childBalAfter)).to.eq(0);
      expect(contractBalAfterRevoke.sub(contractBalAfter)).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke.sub(zeroVaultBalanceAfter)).to.eq(0);
    });

    it("AsymptoticPricing + StakePayment with price = 0 - should NOT perform any transfers", async () => {
      const priceConfig = {
        ...priceConfigDefault,
        maxPrice: BigNumber.from(0),
        minPrice: BigNumber.from(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "zeropriceas",
        isRootDomain: false,
        fullConfig: {
          distrConfig: {
            pricingContract: zns.asPricing.address,
            accessType: AccessType.OPEN,
            paymentConfig: {
              paymentType: PaymentType.STAKE,
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl2SubOwner.address,
            },
          },
          priceConfig,
        },
      });

      const contractBalBefore = await zns.zeroToken.balanceOf(zns.treasury.address);
      const parentBalBefore = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.zeroToken.balanceOf(zeroVault.address);

      const label = "zeropricechildas";
      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
        isRootDomain: false,
        fullConfig: fullDistrConfigEmpty,
      });

      const parentBalAfter = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await zns.zeroToken.balanceOf(zns.treasury.address);
      const zeroVaultBalanceAfter = await zns.zeroToken.balanceOf(zeroVault.address);

      expect(parentBalAfter.sub(parentBalBefore)).to.eq(0);
      expect(childBalBefore.sub(childBalAfter)).to.eq(0);
      expect(contractBalAfter.sub(contractBalBefore)).to.eq(0);
      expect(zeroVaultBalanceAfter.sub(zeroVaultBalanceBefore)).to.eq(0);

      // validate transfer events are not happenning
      const latestBlock = await time.latestBlock();
      const transferFilterToParent = zns.zeroToken.filters.Transfer(lvl3SubOwner.address, lvl2SubOwner.address);
      const transferFilterToTreasury = zns.zeroToken.filters.Transfer(lvl3SubOwner.address, zns.treasury.address);
      const transfersToParent = await zns.zeroToken.queryFilter(
        transferFilterToParent,
        latestBlock - 3,
        latestBlock
      );
      const transfersToTreasury = await zns.zeroToken.queryFilter(
        transferFilterToTreasury,
        latestBlock - 3,
        latestBlock
      );
      expect(transfersToParent.length).to.eq(0);
      expect(transfersToTreasury.length).to.eq(0);

      // revoke
      await zns.subdomainRegistrar.connect(lvl3SubOwner).revokeSubdomain(
        childHash,
      );

      // should NOT offer refund !
      const parentBalAfterRevoke = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalAfterRevoke = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfterRevoke = await zns.zeroToken.balanceOf(zns.treasury.address);
      const zeroVaultBalanceAfterRevoke = await zns.zeroToken.balanceOf(zeroVault.address);

      expect(parentBalAfterRevoke.sub(parentBalAfter)).to.eq(0);
      expect(childBalAfterRevoke.sub(childBalAfter)).to.eq(0);
      expect(contractBalAfterRevoke.sub(contractBalAfter)).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke.sub(zeroVaultBalanceAfter)).to.eq(0);
    });

    it("FixedPricing + StakePayment with price = 0 - should NOT perform any transfers", async () => {
      const priceConfig = {
        price: BigNumber.from(0),
        // we are trying to set a feePercentage, but that should still result to 0 fee
        // since fee is based on price
        feePercentage: BigNumber.from(5),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "zeropricefs",
        isRootDomain: false,
        fullConfig: {
          distrConfig: {
            pricingContract: zns.fixedPricing.address,
            accessType: AccessType.OPEN,
            paymentConfig: {
              paymentType: PaymentType.STAKE,
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl2SubOwner.address,
            },
          },
          priceConfig,
        },
      });

      const contractBalBefore = await zns.zeroToken.balanceOf(zns.treasury.address);
      const parentBalBefore = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.zeroToken.balanceOf(zeroVault.address);

      const label = "zeropricechildfs";
      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
        isRootDomain: false,
        fullConfig: fullDistrConfigEmpty,
      });

      const parentBalAfter = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await zns.zeroToken.balanceOf(zns.treasury.address);
      const zeroVaultBalanceAfter = await zns.zeroToken.balanceOf(zeroVault.address);

      expect(parentBalAfter.sub(parentBalBefore)).to.eq(0);
      expect(childBalBefore.sub(childBalAfter)).to.eq(0);
      expect(contractBalAfter.sub(contractBalBefore)).to.eq(0);
      expect(zeroVaultBalanceAfter.sub(zeroVaultBalanceBefore)).to.eq(0);

      // validate transfer events are not happenning
      const latestBlock = await time.latestBlock();
      const transferFilterToParent = zns.zeroToken.filters.Transfer(lvl3SubOwner.address, lvl2SubOwner.address);
      const transferFilterToTreasury = zns.zeroToken.filters.Transfer(lvl3SubOwner.address, zns.treasury.address);
      const transfersToParent = await zns.zeroToken.queryFilter(
        transferFilterToParent,
        latestBlock - 3,
        latestBlock
      );
      const transfersToTreasury = await zns.zeroToken.queryFilter(
        transferFilterToTreasury,
        latestBlock - 3,
        latestBlock
      );
      expect(transfersToParent.length).to.eq(0);
      expect(transfersToTreasury.length).to.eq(0);

      // revoke
      await zns.subdomainRegistrar.connect(lvl3SubOwner).revokeSubdomain(
        childHash,
      );

      // should NOT offer refund !
      const parentBalAfterRevoke = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalAfterRevoke = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfterRevoke = await zns.zeroToken.balanceOf(zns.treasury.address);
      const zeroVaultBalanceAfterRevoke = await zns.zeroToken.balanceOf(zeroVault.address);

      expect(parentBalAfterRevoke.sub(parentBalAfter)).to.eq(0);
      expect(childBalAfterRevoke.sub(childBalAfter)).to.eq(0);
      expect(contractBalAfterRevoke.sub(contractBalAfter)).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke.sub(zeroVaultBalanceAfter)).to.eq(0);
    });
  });

  describe("Registration access", () => {
    let fixedPrice : BigNumber;
    let domainConfigs : Array<IDomainConfigForTest>;
    let regResults : Array<IPathRegResult>;
    let fixedFeePercentage : BigNumber;

    before(async () => {
      [
        deployer,
        zeroVault,
        governor,
        admin,
        operator,
        rootOwner,
        lvl2SubOwner,
        lvl3SubOwner,
        lvl4SubOwner,
        lvl5SubOwner,
        lvl6SubOwner,
      ] = await hre.ethers.getSigners();
      // zeroVault address is used to hold the fee charged to the user when registering
      zns = await deployZNS({
        deployer,
        governorAddresses: [deployer.address, governor.address],
        adminAddresses: [admin.address],
        priceConfig: priceConfigDefault,
        zeroVaultAddress: zeroVault.address,
      });

      fixedPrice = ethers.utils.parseEther("397");
      fixedFeePercentage = BigNumber.from(200);

      await Promise.all(
        [
          rootOwner,
          lvl2SubOwner,
          lvl3SubOwner,
          lvl4SubOwner,
          lvl5SubOwner,
          lvl6SubOwner,
        ].map(async ({ address }) =>
          zns.zeroToken.mint(address, ethers.utils.parseEther("1000000")))
      );
      await zns.zeroToken.connect(rootOwner).approve(zns.treasury.address, ethers.constants.MaxUint256);

      // register root domain and 1 subdomain
      domainConfigs = [
        {
          user: rootOwner,
          domainLabel: "root",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.fixedPricing.address,
              paymentConfig: {
                paymentType: PaymentType.DIRECT,
                paymentToken: zns.zeroToken.address,
                beneficiary: rootOwner.address,
              },
              accessType: AccessType.OPEN,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
          },
        },
        {
          user: lvl2SubOwner,
          domainLabel: "levelone",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.fixedPricing.address,
              paymentConfig: {
                paymentType: PaymentType.DIRECT,
                paymentToken: zns.zeroToken.address,
                beneficiary: lvl2SubOwner.address,
              },
              accessType: AccessType.OPEN,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
          },
        },
      ];

      regResults = await registerDomainPath({
        zns,
        domainConfigs,
      });
    });

    it("should allow parent owner to register a subdomain under himself even if accessType is LOCKED", async () => {
      await zns.subdomainRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.LOCKED,
      );

      const balBefore = await zns.zeroToken.balanceOf(lvl2SubOwner.address);

      const hash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: regResults[1].domainHash,
        domainLabel: "ownercheck",
        isRootDomain: false,
        fullConfig: fullDistrConfigEmpty,
      });

      const latestBlock = await time.latestBlock();
      // look for an event where user pays himself
      const filter = zns.zeroToken.filters.Transfer(lvl2SubOwner.address, lvl2SubOwner.address);
      const events = await zns.zeroToken.queryFilter(
        filter,
        latestBlock - 50,
        latestBlock
      );
      // this means NO transfers have been executed, which is what we need
      expect(events.length).to.eq(0);

      const balAfter = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      // the diff is 0 because user should not pay himself
      expect(balAfter.sub(balBefore)).to.eq(0);

      // check registry
      const dataFromReg = await zns.registry.getDomainRecord(hash);
      expect(dataFromReg.owner).to.eq(lvl2SubOwner.address);
      expect(dataFromReg.resolver).to.eq(zns.addressResolver.address);

      // check domain token
      const tokenId = BigNumber.from(hash).toString();
      const tokenOwner = await zns.domainToken.ownerOf(tokenId);
      expect(tokenOwner).to.eq(lvl2SubOwner.address);

      // revert back to OPEN
      await zns.subdomainRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.OPEN,
      );
    });

    it("should NOT allow others to register a domain when parent's accessType is LOCKED", async () => {
      // register parent with locked access
      const res = await registerDomainPath({
        zns,
        domainConfigs: [
          {
            user: lvl3SubOwner,
            domainLabel: "leveltwo",
            parentHash: regResults[1].domainHash,
            // when we do not specify accessType or config, it defaults to LOCKED
            // we can also set it as 0 specifically if setting a config
            fullConfig: fullDistrConfigEmpty,
          },
        ],
      });

      // try to register child
      await expect(
        zns.subdomainRegistrar.connect(lvl5SubOwner).registerSubdomain(
          res[0].domainHash,
          "tobedenied",
          ethers.constants.AddressZero,
          distrConfigEmpty
        )
      ).to.be.revertedWith(
        DISTRIBUTION_LOCKED_ERR
      );
    });

    it("should allow anyone to register a domain when parent's accessType is OPEN", async () => {
      const { domainHash: parentHash } = regResults[1];
      const domainLabel = "alloweded";

      const {
        expectedPrice,
      } = getPriceObject(
        domainLabel,
        domainConfigs[1].fullConfig.priceConfig
      );

      const protocolFee = getStakingOrProtocolFee(expectedPrice);
      // approve direct payment
      await zns.zeroToken.connect(lvl5SubOwner).approve(
        zns.treasury.address,
        expectedPrice.add(protocolFee)
      );

      await zns.subdomainRegistrar.connect(lvl5SubOwner).registerSubdomain(
        parentHash,
        domainLabel,
        ethers.constants.AddressZero,
        distrConfigEmpty
      );

      const hash = await getDomainHashFromEvent({
        zns,
        user: lvl5SubOwner,
      });

      // check registry
      const dataFromReg = await zns.registry.getDomainRecord(hash);
      expect(dataFromReg.owner).to.eq(lvl5SubOwner.address);
      expect(dataFromReg.resolver).to.eq(ethers.constants.AddressZero);

      // check domain token
      const tokenId = BigNumber.from(hash).toString();
      const tokenOwner = await zns.domainToken.ownerOf(tokenId);
      expect(tokenOwner).to.eq(lvl5SubOwner.address);
    });

    // eslint-disable-next-line max-len
    it("should ONLY allow whitelisted addresses and NOT allow other ones to register a domain when parent's accessType is WHITELIST", async () => {
      // approve direct payment
      await zns.zeroToken.connect(lvl3SubOwner).approve(zns.treasury.address, fixedPrice);
      // register parent with whitelisted access
      const parentHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: regResults[1].domainHash,
        domainLabel: "whitelistparent",
        isRootDomain: false,
        fullConfig: {
          distrConfig: {
            pricingContract: zns.fixedPricing.address,
            paymentConfig: {
              paymentType: PaymentType.DIRECT,
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl3SubOwner.address,
            },
            accessType: AccessType.WHITELIST,
          },
          priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
        },
      });

      // whitelist potential child user
      await zns.subdomainRegistrar.connect(lvl3SubOwner).setWhitelistForDomain(
        parentHash,
        lvl4SubOwner.address,
        true,
      );

      // register child
      const hash = await registrationWithSetup({
        zns,
        user: lvl4SubOwner,
        parentHash,
        domainLabel: "whitelisted",
        isRootDomain: false,
        fullConfig: fullDistrConfigEmpty,
      });

      // check registry
      const dataFromReg = await zns.registry.getDomainRecord(hash);
      expect(dataFromReg.owner).to.eq(lvl4SubOwner.address);
      expect(dataFromReg.resolver).to.eq(zns.addressResolver.address);

      // check domain token
      const tokenId = BigNumber.from(hash).toString();
      const tokenOwner = await zns.domainToken.ownerOf(tokenId);
      expect(tokenOwner).to.eq(lvl4SubOwner.address);

      // try to register child with non-whitelisted user
      await expect(
        zns.subdomainRegistrar.connect(lvl5SubOwner).registerSubdomain(
          parentHash,
          "notwhitelisted",
          ethers.constants.AddressZero,
          distrConfigEmpty
        )
      ).to.be.revertedWith(
        "ZNSSubdomainRegistrar: Sender is not whitelisted"
      );

      // remove user from whitelist
      await zns.subdomainRegistrar.connect(lvl3SubOwner).setWhitelistForDomain(
        parentHash,
        lvl4SubOwner.address,
        false,
      );

      // try to register again
      await expect(
        zns.subdomainRegistrar.connect(lvl4SubOwner).registerSubdomain(
          parentHash,
          "notwhitelistednow",
          ethers.constants.AddressZero,
          distrConfigEmpty
        )
      ).to.be.revertedWith(
        "ZNSSubdomainRegistrar: Sender is not whitelisted"
      );
    });

    it("#setWhitelistForDomain should NOT allow setting if called by non-authorized account or registrar", async () => {
      const { domainHash } = regResults[1];

      // assign operator in registry
      // to see that he CAN do it
      await zns.registry.connect(lvl2SubOwner).setOwnerOperator(
        operator.address,
        true,
      );

      // try with operator
      await zns.subdomainRegistrar.connect(operator).setWhitelistForDomain(
        domainHash,
        lvl5SubOwner.address,
        true,
      );

      const whitelisted = await zns.subdomainRegistrar.distributionWhitelist(
        domainHash,
        lvl5SubOwner.address
      );
      assert.ok(whitelisted, "User did NOT get whitelisted, but should've");

      // try with non-authorized
      await expect(
        zns.subdomainRegistrar.connect(lvl5SubOwner).setWhitelistForDomain(
          domainHash,
          lvl5SubOwner.address,
          true,
        )
      ).to.be.revertedWith(
        "ZNSSubdomainRegistrar: Not authorized"
      );
    });

    it("should switch accessType for existing parent domain", async () => {
      await zns.subdomainRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.LOCKED
      );

      await expect(
        zns.subdomainRegistrar.connect(lvl5SubOwner).registerSubdomain(
          regResults[1].domainHash,
          "notallowed",
          ethers.constants.AddressZero,
          distrConfigEmpty
        )
      ).to.be.revertedWith(
        DISTRIBUTION_LOCKED_ERR
      );

      // switch to whitelist
      await zns.subdomainRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.WHITELIST
      );

      // add to whitelist
      await zns.subdomainRegistrar.connect(lvl2SubOwner).setWhitelistForDomain(
        regResults[1].domainHash,
        lvl5SubOwner.address,
        true,
      );

      const label = "alloweddddd";

      // approve
      const {
        expectedPrice,
        stakeFee,
      } = getPriceObject(
        label,
        domainConfigs[1].fullConfig.priceConfig
      );
      const paymentToParent = domainConfigs[1].fullConfig.distrConfig.paymentConfig.paymentType === PaymentType.STAKE
        ? expectedPrice.add(stakeFee)
        : expectedPrice;

      const protocolFee = getStakingOrProtocolFee(paymentToParent);
      await zns.zeroToken.connect(lvl5SubOwner).approve(
        zns.treasury.address,
        paymentToParent.add(protocolFee)
      );

      // register
      await zns.subdomainRegistrar.connect(lvl5SubOwner).registerSubdomain(
        regResults[1].domainHash,
        "alloweddddd",
        ethers.constants.AddressZero,
        distrConfigEmpty
      );

      const hash = await getDomainHashFromEvent({
        zns,
        user: lvl5SubOwner,
      });

      // check registry
      const dataFromReg = await zns.registry.getDomainRecord(hash);
      expect(dataFromReg.owner).to.eq(lvl5SubOwner.address);

      // switch back to open
      await zns.subdomainRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.OPEN
      );
    });

    // eslint-disable-next-line max-len
    it("should NOT allow to register subdomains under the parent that hasn't set up his distribution config", async () => {
      const parentHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: regResults[1].domainHash,
        domainLabel: "parentnoconfig",
        isRootDomain: false,
        fullConfig: fullDistrConfigEmpty, // accessType is 0 when supplying empty config
      });

      await expect(
        zns.subdomainRegistrar.connect(lvl4SubOwner).registerSubdomain(
          parentHash,
          "notallowed",
          ethers.constants.AddressZero,
          distrConfigEmpty
        )
      ).to.be.revertedWith(
        DISTRIBUTION_LOCKED_ERR
      );
    });
  });

  describe("Existing subdomain ops", () => {
    let fixedPrice : BigNumber;
    let domainConfigs : Array<IDomainConfigForTest>;
    let regResults : Array<IPathRegResult>;
    let fixedFeePercentage : BigNumber;

    before(async () => {
      [
        deployer,
        zeroVault,
        governor,
        admin,
        operator,
        rootOwner,
        lvl2SubOwner,
        lvl3SubOwner,
        lvl4SubOwner,
        lvl5SubOwner,
        lvl6SubOwner,
      ] = await hre.ethers.getSigners();
      // zeroVault address is used to hold the fee charged to the user when registering
      zns = await deployZNS({
        deployer,
        governorAddresses: [deployer.address, governor.address],
        adminAddresses: [admin.address],
        priceConfig: priceConfigDefault,
        zeroVaultAddress: zeroVault.address,
      });

      fixedPrice = ethers.utils.parseEther("397");
      fixedFeePercentage = BigNumber.from(200);

      await Promise.all(
        [
          rootOwner,
          lvl2SubOwner,
          lvl3SubOwner,
          lvl4SubOwner,
          lvl5SubOwner,
          lvl6SubOwner,
        ].map(async ({ address }) =>
          zns.zeroToken.mint(address, ethers.utils.parseEther("1000000")))
      );
      await zns.zeroToken.connect(rootOwner).approve(zns.treasury.address, ethers.constants.MaxUint256);

      // register root domain and 1 subdomain
      domainConfigs = [
        {
          user: rootOwner,
          domainLabel: "root",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.fixedPricing.address,
              paymentConfig: {
                paymentType: PaymentType.STAKE,
                paymentToken: zns.zeroToken.address,
                beneficiary: rootOwner.address,
              },
              accessType: AccessType.OPEN,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
          },
        },
        {
          user: lvl2SubOwner,
          domainLabel: "levelone",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.fixedPricing.address,
              paymentConfig: {
                paymentType: PaymentType.DIRECT,
                paymentToken: zns.zeroToken.address,
                beneficiary: lvl2SubOwner.address,
              },
              accessType: AccessType.OPEN,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
          },
        },
      ];

      regResults = await registerDomainPath({
        zns,
        domainConfigs,
      });
    });

    it("should NOT allow to register an existing subdomain that has not been revoked", async () => {
      await expect(
        zns.subdomainRegistrar.connect(lvl2SubOwner).registerSubdomain(
          regResults[0].domainHash,
          domainConfigs[1].domainLabel,
          lvl2SubOwner.address,
          domainConfigs[1].fullConfig.distrConfig
        )
      ).to.be.revertedWith(
        "ZNSSubdomainRegistrar: Subdomain already exists"
      );
    });

    it("should NOT allow revoking when the caller is NOT an owner of both Name and Token", async () => {
      // change owner of the domain
      await zns.registry.connect(lvl2SubOwner).updateDomainOwner(
        regResults[1].domainHash,
        rootOwner.address
      );

      // fail
      await expect(
        zns.subdomainRegistrar.connect(lvl3SubOwner).revokeSubdomain(
          regResults[1].domainHash,
        )
      ).to.be.revertedWith(
        "ZNSSubdomainRegistrar: Not the owner of both Name and Token"
      );

      // change owner back
      await zns.registry.connect(rootOwner).updateDomainOwner(
        regResults[1].domainHash,
        lvl2SubOwner.address
      );

      // tranfer token
      await zns.domainToken.connect(lvl2SubOwner).transferFrom(
        lvl2SubOwner.address,
        lvl3SubOwner.address,
        regResults[1].domainHash
      );

      // fail again
      await expect(
        zns.subdomainRegistrar.connect(lvl2SubOwner).revokeSubdomain(
          regResults[1].domainHash,
        )
      ).to.be.revertedWith(
        "ZNSSubdomainRegistrar: Not the owner of both Name and Token"
      );

      // give token back
      await zns.domainToken.connect(lvl3SubOwner).transferFrom(
        lvl3SubOwner.address,
        lvl2SubOwner.address,
        regResults[1].domainHash
      );
    });

    it("should allow to UPDATE domain data for subdomain", async () => {
      const dataFromReg = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromReg.owner).to.eq(lvl2SubOwner.address);
      expect(dataFromReg.resolver).to.eq(zns.addressResolver.address);

      await zns.registry.connect(lvl2SubOwner).updateDomainRecord(
        regResults[1].domainHash,
        lvl3SubOwner.address,
        ethers.constants.AddressZero,
      );

      const dataFromRegAfter = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromRegAfter.owner).to.eq(lvl3SubOwner.address);
      expect(dataFromRegAfter.resolver).to.eq(ethers.constants.AddressZero);

      // reclaim to switch ownership back to original owner
      await zns.registrar.connect(lvl2SubOwner).reclaimDomain(
        regResults[1].domainHash,
      );

      const dataFromRegAfterReclaim = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromRegAfterReclaim.owner).to.eq(lvl2SubOwner.address);
      expect(dataFromRegAfterReclaim.resolver).to.eq(ethers.constants.AddressZero);
    });

    it("#setDistributionConfigForDomain() should re-set distribution config for an existing subdomain", async () => {
      const domainHash = regResults[1].domainHash;

      const distrConfigBefore = await zns.subdomainRegistrar.distrConfigs(domainHash);
      expect(distrConfigBefore.accessType).to.eq(domainConfigs[1].fullConfig.distrConfig.accessType);
      expect(distrConfigBefore.pricingContract).to.eq(domainConfigs[1].fullConfig.distrConfig.pricingContract);
      expect(
        distrConfigBefore.paymentConfig.paymentType
      ).to.eq(
        domainConfigs[1].fullConfig.distrConfig.paymentConfig.paymentType
      );
      expect(
        distrConfigBefore.paymentConfig.paymentToken
      ).to.eq(
        domainConfigs[1].fullConfig.distrConfig.paymentConfig.paymentToken
      );
      expect(
        distrConfigBefore.paymentConfig.beneficiary
      ).to.eq(
        domainConfigs[1].fullConfig.distrConfig.paymentConfig.beneficiary
      );

      const newConfig = {
        pricingContract: zns.asPricing.address,
        paymentConfig: {
          paymentType: PaymentType.STAKE,
          paymentToken: zns.zeroToken.address,
          beneficiary: lvl2SubOwner.address,
        },
        accessType: AccessType.WHITELIST,
      };

      await zns.subdomainRegistrar.connect(lvl2SubOwner).setDistributionConfigForDomain(
        domainHash,
        newConfig,
      );

      const distrConfigAfter = await zns.subdomainRegistrar.distrConfigs(domainHash);
      expect(distrConfigAfter.accessType).to.eq(newConfig.accessType);
      expect(distrConfigAfter.pricingContract).to.eq(newConfig.pricingContract);
      expect(distrConfigAfter.paymentConfig.paymentType).to.eq(newConfig.paymentConfig.paymentType);
      expect(distrConfigAfter.paymentConfig.paymentToken).to.eq(newConfig.paymentConfig.paymentToken);
      expect(distrConfigAfter.paymentConfig.beneficiary).to.eq(newConfig.paymentConfig.beneficiary);

      // assign operator in registry
      await zns.registry.connect(lvl2SubOwner).setOwnerOperator(
        operator.address,
        true,
      );

      // reset it back
      await zns.subdomainRegistrar.connect(operator).setDistributionConfigForDomain(
        domainHash,
        domainConfigs[1].fullConfig.distrConfig,
      );
      const origConfigAfter = await zns.subdomainRegistrar.distrConfigs(domainHash);
      expect(origConfigAfter.accessType).to.eq(domainConfigs[1].fullConfig.distrConfig.accessType);
      expect(origConfigAfter.pricingContract).to.eq(domainConfigs[1].fullConfig.distrConfig.pricingContract);
      expect(
        origConfigAfter.paymentConfig.paymentType
      ).to.eq(
        domainConfigs[1].fullConfig.distrConfig.paymentConfig.paymentType
      );
      expect(
        origConfigAfter.paymentConfig.paymentToken
      ).to.eq(
        domainConfigs[1].fullConfig.distrConfig.paymentConfig.paymentToken
      );
      expect(
        origConfigAfter.paymentConfig.beneficiary
      ).to.eq(
        domainConfigs[1].fullConfig.distrConfig.paymentConfig.beneficiary
      );

      // remove operator
      await zns.registry.connect(lvl2SubOwner).setOwnerOperator(
        operator.address,
        false,
      );
    });

    // eslint-disable-next-line max-len
    it("#setDistributionConfigForDomain() should NOT allow to set distribution config for a non-authorized account", async () => {
      const domainHash = regResults[1].domainHash;

      const newConfig = {
        pricingContract: zns.asPricing.address,
        paymentConfig: {
          paymentType: PaymentType.STAKE,
          paymentToken: zns.zeroToken.address,
          beneficiary: lvl2SubOwner.address,
        },
        accessType: AccessType.WHITELIST,
      };

      await expect(
        zns.subdomainRegistrar.connect(lvl3SubOwner).setDistributionConfigForDomain(
          domainHash,
          newConfig,
        )
      ).to.be.revertedWith(
        "ZNSSubdomainRegistrar: Not authorized"
      );
    });

    it("#setPricingContractForDomain() should re-set pricing contract for an existing subdomain", async () => {
      const domainHash = regResults[1].domainHash;

      const pricingContractBefore = await zns.subdomainRegistrar.distrConfigs(domainHash);
      expect(pricingContractBefore.pricingContract).to.eq(domainConfigs[1].fullConfig.distrConfig.pricingContract);

      await zns.subdomainRegistrar.connect(lvl2SubOwner).setPricingContractForDomain(
        domainHash,
        zns.asPricing.address,
      );

      const pricingContractAfter = await zns.subdomainRegistrar.distrConfigs(domainHash);
      expect(pricingContractAfter.pricingContract).to.eq(zns.asPricing.address);

      // reset it back
      await zns.subdomainRegistrar.connect(lvl2SubOwner).setPricingContractForDomain(
        domainHash,
        domainConfigs[1].fullConfig.distrConfig.pricingContract,
      );
    });

    it("#setPricingContractForDomain() should NOT allow setting for non-authorized account", async () => {
      const domainHash = regResults[1].domainHash;

      await expect(
        zns.subdomainRegistrar.connect(lvl3SubOwner).setPricingContractForDomain(
          domainHash,
          zns.asPricing.address,
        )
      ).to.be.revertedWith(
        "ZNSSubdomainRegistrar: Not authorized"
      );
    });

    it("#setPricingContractForDomain() should NOT set pricingContract to 0x0 address", async () => {
      const domainHash = regResults[1].domainHash;

      await expect(
        zns.subdomainRegistrar.connect(lvl2SubOwner).setPricingContractForDomain(
          domainHash,
          ethers.constants.AddressZero,
        )
      ).to.be.revertedWith(
        "ZNSSubdomainRegistrar: pricingContract can not be 0x0 address"
      );
    });

    it("#setPaymentConfigForDomain() should re-set payment config for an existing subdomain", async () => {
      const domainHash = regResults[1].domainHash;

      const paymentContractBefore = await zns.subdomainRegistrar.distrConfigs(domainHash);
      expect(
        paymentContractBefore.paymentConfig.paymentType
      ).to.eq(
        domainConfigs[1].fullConfig.distrConfig.paymentConfig.paymentType
      );
      expect(
        paymentContractBefore.paymentConfig.paymentToken
      ).to.eq(
        domainConfigs[1].fullConfig.distrConfig.paymentConfig.paymentToken
      );
      expect(
        paymentContractBefore.paymentConfig.beneficiary
      ).to.eq(
        domainConfigs[1].fullConfig.distrConfig.paymentConfig.beneficiary
      );

      const configToSet = {
        paymentType: PaymentType.STAKE,
        paymentToken: lvl2SubOwner.address,
        beneficiary: lvl2SubOwner.address,
      };

      await zns.subdomainRegistrar.connect(lvl2SubOwner).setPaymentConfigForDomain(
        domainHash,
        configToSet,
      );

      const paymentContractAfter = await zns.subdomainRegistrar.distrConfigs(domainHash);
      expect(paymentContractAfter.paymentConfig.paymentType).to.eq(configToSet.paymentType);
      expect(paymentContractAfter.paymentConfig.paymentToken).to.eq(configToSet.paymentToken);
      expect(paymentContractAfter.paymentConfig.beneficiary).to.eq(configToSet.beneficiary);

      // reset it back
      await zns.subdomainRegistrar.connect(lvl2SubOwner).setPaymentConfigForDomain(
        domainHash,
        domainConfigs[1].fullConfig.distrConfig.paymentConfig,
      );
    });

    it("#setPaymentConfigForDomain() should NOT allow setting for non-authorized account", async () => {
      const domainHash = regResults[1].domainHash;

      const configToSet = {
        paymentType: PaymentType.STAKE,
        paymentToken: lvl3SubOwner.address,
        beneficiary: lvl3SubOwner.address,
      };

      await expect(
        zns.subdomainRegistrar.connect(lvl3SubOwner).setPaymentConfigForDomain(
          domainHash,
          configToSet,
        )
      ).to.be.revertedWith(
        "ZNSSubdomainRegistrar: Not authorized"
      );
    });

    it("#setPaymentConfigForDomain() should NOT set paymentToken or beneficiary to 0x0 address", async () => {
      const domainHash = regResults[1].domainHash;
      const zeroTokenConfig = {
        paymentType: PaymentType.STAKE,
        paymentToken: ethers.constants.AddressZero,
        beneficiary: lvl2SubOwner.address,
      };

      await expect(
        zns.subdomainRegistrar.connect(lvl2SubOwner).setPaymentConfigForDomain(
          domainHash,
          zeroTokenConfig
        )
      ).to.be.revertedWith(
        "ZNSSubdomainRegistrar: paymentToken can not be 0x0 address"
      );

      const zeroBeneficiaryConfig = {
        paymentType: PaymentType.STAKE,
        paymentToken: lvl2SubOwner.address,
        beneficiary: ethers.constants.AddressZero,
      };

      await expect(
        zns.subdomainRegistrar.connect(lvl2SubOwner).setPaymentConfigForDomain(
          domainHash,
          zeroBeneficiaryConfig
        )
      ).to.be.revertedWith(
        "ZNSSubdomainRegistrar: beneficiary can not be 0x0 address"
      );
    });

    // eslint-disable-next-line max-len
    it("should TRANSFER ownership of a subdomain and let the receiver RECLAIM and then revoke with REFUND", async () => {
      const tokenId = BigNumber.from(regResults[1].domainHash).toString();

      const stakedBefore = await zns.treasury.stakedForDomain(regResults[1].domainHash);

      await zns.domainToken.connect(lvl2SubOwner).transferFrom(
        lvl2SubOwner.address,
        lvl3SubOwner.address,
        tokenId
      );

      // Verify owner in registry
      const dataFromReg = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromReg.owner).to.eq(lvl2SubOwner.address);

      // reclaim
      await zns.registrar.connect(lvl3SubOwner).reclaimDomain(
        regResults[1].domainHash,
      );

      // Verify domain token is still owned
      const tokenOwner = await zns.domainToken.ownerOf(tokenId);
      expect(tokenOwner).to.eq(lvl3SubOwner.address);

      // Verify owner in registry
      const dataFromRegAfter = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromRegAfter.owner).to.eq(lvl3SubOwner.address);

      // verify stake still existing
      const stakedAfter = await zns.treasury.stakedForDomain(regResults[1].domainHash);
      expect(stakedAfter).to.eq(stakedBefore);

      const userBalbefore = await zns.zeroToken.balanceOf(lvl3SubOwner.address);

      // try revoking
      await zns.subdomainRegistrar.connect(lvl3SubOwner).revokeSubdomain(
        regResults[1].domainHash,
      );

      // verify that refund has been acquired by the new owner
      const userBalAfter = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      expect(userBalAfter.sub(userBalbefore)).to.eq(fixedPrice);
    });
  });

  describe("State setters", () => {
    before(async () => {
      [
        deployer,
        admin,
        random,
      ] = await hre.ethers.getSigners();

      zns = await deployZNS({
        deployer,
        governorAddresses: [deployer.address],
        adminAddresses: [admin.address],
      });
    });

    it("#setRootRegistrar() should set the new root registrar correctly and emit #RootRegistrarSet event", async () => {
      const tx = await zns.subdomainRegistrar.connect(admin).setRootRegistrar(random.address);

      await expect(tx).to.emit(zns.subdomainRegistrar, "RootRegistrarSet").withArgs(random.address);

      expect(await zns.subdomainRegistrar.rootRegistrar()).to.equal(random.address);
    });

    it("#setRootRegistrar() should NOT be callable by anyone other than ADMIN_ROLE", async () => {
      await expect(
        zns.subdomainRegistrar.connect(random).setRootRegistrar(random.address),
      ).to.be.revertedWith(
        getAccessRevertMsg(random.address, ADMIN_ROLE),
      );
    });

    it("#setRootRegistrar should NOT set registrar as 0x0 address", async () => {
      await expect(
        zns.subdomainRegistrar.connect(admin).setRootRegistrar(ethers.constants.AddressZero),
      ).to.be.revertedWith(
        "ZNSSubdomainRegistrar: _registrar can not be 0x0 address",
      );
    });

    it("#setRegistry() should set the new registry correctly and emit #RegistrySet event", async () => {
      const tx = await zns.subdomainRegistrar.connect(admin).setRegistry(random.address);

      await expect(tx).to.emit(zns.subdomainRegistrar, "RegistrySet").withArgs(random.address);

      expect(await zns.subdomainRegistrar.registry()).to.equal(random.address);
    });

    it("#setRegistry() should not be callable by anyone other than ADMIN_ROLE", async () => {
      await expect(
        zns.subdomainRegistrar.connect(random).setRegistry(random.address),
      ).to.be.revertedWith(
        getAccessRevertMsg(random.address, ADMIN_ROLE),
      );
    });

    it("#setAccessController() should not be callable by anyone other than ADMIN_ROLE", async () => {
      await expect(
        zns.subdomainRegistrar.connect(random).setAccessController(random.address),
      ).to.be.revertedWith(
        getAccessRevertMsg(random.address, ADMIN_ROLE),
      );
    });

    it("#getAccessController() should return the correct access controller", async () => {
      expect(
        await zns.subdomainRegistrar.getAccessController()
      ).to.equal(zns.accessController.address);
    });

    // eslint-disable-next-line max-len
    it("#setAccessController() should set the new access controller correctly and emit #AccessControllerSet event", async () => {
      const tx = await zns.subdomainRegistrar.connect(admin).setAccessController(random.address);

      await expect(tx).to.emit(zns.subdomainRegistrar, "AccessControllerSet").withArgs(random.address);

      expect(await zns.subdomainRegistrar.getAccessController()).to.equal(random.address);
    });
  });
});

// TODO sub: Some tests to do:
// -  domain registration with invalid input (e.g., empty name, invalid characters)

// -  scenarios where payment fails (insufficient funds, wrong token, incorrect permissions, allowances etc.)
// -  registering domains with long names (max length).
// -  registering domains with very short names.
// -  using different ERC-20 tokens for payments.
// -  using tokens with varying decimal places.
// -  boundary values for pricing tiers and other numeric parameters.
// -  upgrading the contract while maintaining data integrity.