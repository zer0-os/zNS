import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IDomainConfigForTest, IPathRegResult, ZNSContracts } from "./helpers/types";
import {
  AccessType,
  ADMIN_ROLE, defaultTokenURI,
  deployZNS,
  distrConfigEmpty,
  DISTRIBUTION_LOCKED_ERR,
  fullDistrConfigEmpty,
  getAccessRevertMsg,
  getPriceObject,
  getStakingOrProtocolFee, GOVERNOR_ROLE, INITIALIZED_ERR,
  INVALID_TOKENID_ERC_ERR,
  ONLY_NAME_OWNER_REG_ERR,
  PaymentType,
  priceConfigDefault, validateUpgrade,
} from "./helpers";
import * as hre from "hardhat";
import * as ethers from "ethers";
import { BigNumber } from "ethers";
import { expect } from "chai";
import { registerDomainPath, validatePathRegistration } from "./helpers/flows/registration";
import assert from "assert";
import { registrationWithSetup } from "./helpers/register-setup";
import { getDomainHashFromEvent } from "./helpers/events";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  ZNSSubRegistrarUpgradeMock__factory,
} from "../typechain";
import { parseEther } from "ethers/lib/utils";


describe("ZNSSubRegistrar", () => {
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
              pricerContract: zns.fixedPricer.address,
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: zns.zeroToken.address,
              beneficiary: rootOwner.address,
            },
            priceConfig: { price: fixedPrice, feePercentage: BigNumber.from(0) },
          },
        },
        {
          user: lvl2SubOwner,
          domainLabel: "lvltwo",
          fullConfig: {
            distrConfig: {
              pricerContract: zns.curvePricer.address,
              paymentType: PaymentType.STAKE,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: zns.zeroToken.address,
              beneficiary: lvl2SubOwner.address,
            },
            priceConfig: priceConfigDefault,
          },
        },
        {
          user: lvl3SubOwner,
          domainLabel: "lvlthree",
          fullConfig: {
            distrConfig: {
              pricerContract: zns.curvePricer.address,
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              // TODO sub: test with different ERC20 tokens as tokens
              token: zns.zeroToken.address,
              beneficiary: lvl3SubOwner.address,
            },
            priceConfig: priceConfigDefault,
          },
        },
        {
          user: lvl4SubOwner,
          domainLabel: "lvlfour",
          fullConfig: {
            distrConfig: {
              pricerContract: zns.curvePricer.address,
              paymentType: PaymentType.STAKE,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: zns.zeroToken.address,
              beneficiary: lvl4SubOwner.address,
            },
            priceConfig: priceConfigDefault,

          },
        },
        {
          user: lvl5SubOwner,
          domainLabel: "lvlfive",
          fullConfig: {
            distrConfig: {
              pricerContract: zns.fixedPricer.address,
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: zns.zeroToken.address,
              beneficiary: lvl5SubOwner.address,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },

          },
        },
        {
          user: lvl6SubOwner,
          domainLabel: "lvlsix",
          fullConfig: {
            distrConfig: {
              pricerContract: zns.curvePricer.address,
              paymentType: PaymentType.STAKE,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: zns.zeroToken.address,
              beneficiary: lvl6SubOwner.address,
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

      await zns.subRegistrar.connect(lvl6SubOwner).revokeSubdomain(
        domainHash,
      );

      const userBalAfter = await zns.zeroToken.balanceOf(lvl6SubOwner.address);

      expect(userBalAfter.sub(userBalBefore)).to.eq(0);

      // make sure that accessType has been set to LOCKED
      // and nobody can register a subdomain under this domain
      const { accessType: accessTypeFromSC } = await zns.subRegistrar.distrConfigs(domainHash);
      expect(accessTypeFromSC).to.eq(AccessType.LOCKED);

      await expect(
        zns.subRegistrar.connect(lvl6SubOwner).registerSubdomain(
          domainHash,
          "newsubdomain",
          lvl6SubOwner.address,
          defaultTokenURI,
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

      await zns.subRegistrar.connect(lvl5SubOwner).revokeSubdomain(domainHash);

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
      const { accessType: accessTypeFromSC } = await zns.subRegistrar.distrConfigs(domainHash);
      expect(accessTypeFromSC).to.eq(AccessType.LOCKED);

      await expect(
        zns.subRegistrar.connect(lvl6SubOwner).registerSubdomain(
          domainHash,
          "newsubdomain",
          lvl6SubOwner.address,
          defaultTokenURI,
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
              pricerContract: zns.fixedPricer.address,
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: zns.zeroToken.address,
              beneficiary: branchLvl1Owner.address,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
          },
        },
        {
          user: branchLvl2Owner,
          domainLabel: "lvlfournew",
          fullConfig: {
            distrConfig: {
              pricerContract: zns.curvePricer.address,
              paymentType: PaymentType.STAKE,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: zns.zeroToken.address,
              beneficiary: branchLvl2Owner.address,
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
      await zns.subRegistrar.connect(lvl2SubOwner).revokeSubdomain(
        lvl2Hash,
      );

      // make sure all parent's distribution configs still exist
      const parentDistrConfig = await zns.subRegistrar.distrConfigs(lvl2Hash);
      const parentPaymentConfig = await zns.treasury.paymentConfigs(lvl2Hash);
      expect(parentDistrConfig.pricerContract).to.eq(domainConfigs[1].fullConfig.distrConfig.pricerContract);
      expect(
        parentDistrConfig.paymentType
      ).to.eq(
        domainConfigs[1].fullConfig.distrConfig.paymentType
      );
      expect(
        parentPaymentConfig.token
      ).to.eq(
        domainConfigs[1].fullConfig.paymentConfig.token
      );
      expect(
        parentPaymentConfig.beneficiary
      ).to.eq(
        domainConfigs[1].fullConfig.paymentConfig.beneficiary
      );

      expect(parentDistrConfig.pricerContract).to.eq(zns.curvePricer.address);

      // check a couple of fields from price config
      const priceConfig = await zns.curvePricer.priceConfigs(lvl2Hash);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if ("maxPrice" in domainConfigs[1].fullConfig.priceConfig!) {
        expect(priceConfig.maxPrice).to.eq(domainConfigs[1].fullConfig.priceConfig.maxPrice);
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if ("minPrice" in domainConfigs[1].fullConfig.priceConfig!) {
        expect(priceConfig.minPrice).to.eq(domainConfigs[1].fullConfig.priceConfig.minPrice);
      }

      // make sure the child's stake is still there
      const { amount: childStakedAmt } = await zns.treasury.stakedForDomain(lvl3Hash);
      const { expectedPrice } = getPriceObject(domainConfigs[2].domainLabel);

      expect(childStakedAmt).to.eq(expectedPrice);

      const userBalBefore = await zns.zeroToken.balanceOf(lvl3SubOwner.address);

      // revoke child
      await zns.subRegistrar.connect(lvl3SubOwner).revokeSubdomain(
        lvl3Hash,
      );

      const userBalAfter = await zns.zeroToken.balanceOf(lvl3SubOwner.address);

      expect(userBalAfter.sub(userBalBefore)).to.eq(expectedPrice);

      const childExistsAfter = await zns.registry.exists(lvl3Hash);
      assert.ok(!childExistsAfter);

      const { amount: stakedAfterRevoke } = await zns.treasury.stakedForDomain(lvl3Hash);
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
          fullConfig: domainConfigs[1].fullConfig,
        });

        expect(newHash).to.eq(lvl2Hash);
      }

      // revoke subdomain
      await zns.subRegistrar.connect(lvl2SubOwner).revokeSubdomain(
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
              pricerContract: zns.fixedPricer.address,
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: zns.zeroToken.address,
              beneficiary: branchLvl1Owner.address,
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
      await zns.rootRegistrar.connect(rootOwner).revokeDomain(
        lvl1Hash
      );

      const exists = await zns.registry.exists(lvl1Hash);
      assert.ok(!exists);

      await expect(
        zns.subRegistrar.connect(branchLvl1Owner).registerSubdomain(
          lvl1Hash,
          "newsubdomain",
          branchLvl1Owner.address,
          defaultTokenURI,
          distrConfigEmpty,
        )
      ).to.be.revertedWith(DISTRIBUTION_LOCKED_ERR);
    });

    it("should NOT register a child (subdomain) under a parent (subdomain) that has been revoked", async () => {
      const lvl4Hash = regResults[3].domainHash;

      // revoke parent
      await zns.subRegistrar.connect(lvl4SubOwner).revokeSubdomain(
        lvl4Hash,
      );

      const exists = await zns.registry.exists(lvl4Hash);
      assert.ok(!exists);

      await expect(
        zns.subRegistrar.connect(branchLvl2Owner).registerSubdomain(
          lvl4Hash,
          "newsubdomain",
          branchLvl2Owner.address,
          defaultTokenURI,
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
            pricerContract: zns.fixedPricer.address,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: zns.zeroToken.address,
            beneficiary: rootOwner.address,
          },
          priceConfig: {
            price: fixedPrice,
            feePercentage: BigNumber.from(0),
          },
        },
      });
    });

    it("FixedPricer + StakePayment with stake fee", async () => {
      const priceConfig = {
        price: fixedPrice,
        feePercentage,
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "fixedstake",
        fullConfig: {
          distrConfig: {
            pricerContract: zns.fixedPricer.address,
            paymentType: PaymentType.STAKE,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: zns.zeroToken.address,
            beneficiary: lvl2SubOwner.address,
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
      await zns.subRegistrar.connect(lvl3SubOwner).revokeSubdomain(
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

    it("FixedPricer + StakePayment no fee", async () => {
      const priceConfig = {
        price: fixedPrice,
        feePercentage: BigNumber.from(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "fixedstakenofee",
        fullConfig: {
          distrConfig: {
            pricerContract: zns.fixedPricer.address,
            accessType: AccessType.OPEN,
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            token: zns.zeroToken.address,
            beneficiary: lvl2SubOwner.address,
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
      await zns.subRegistrar.connect(lvl3SubOwner).revokeSubdomain(
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

    it("FixedPricer + DirectPayment no fee", async () => {
      const priceConfig = {
        price: fixedPrice,
        feePercentage: BigNumber.from(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "fixeddirectnofee",
        fullConfig: {
          distrConfig: {
            paymentType: PaymentType.DIRECT,
            pricerContract: zns.fixedPricer.address,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: zns.zeroToken.address,
            beneficiary: lvl2SubOwner.address,
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
      await zns.subRegistrar.connect(lvl3SubOwner).revokeSubdomain(
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

    it("CurvePricer + StakePayment with stake fee", async () => {
      const priceConfig = priceConfigDefault;

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "asympstake",
        fullConfig: {
          distrConfig: {
            paymentType: PaymentType.STAKE,
            pricerContract: zns.curvePricer.address,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: zns.zeroToken.address,
            beneficiary: lvl2SubOwner.address,
          },
          priceConfig,
        },
      });

      const contractBalBefore = await zns.zeroToken.balanceOf(zns.treasury.address);
      const parentBalBefore = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.zeroToken.balanceOf(zeroVault.address);

      const label = "curvestakechild";

      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
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
      await zns.subRegistrar.connect(lvl3SubOwner).revokeSubdomain(
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

    it("CurvePricer + StakePayment no fee", async () => {
      const priceConfig = {
        ...priceConfigDefault,
        feePercentage: BigNumber.from(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "asstakenofee",
        fullConfig: {
          distrConfig: {
            pricerContract: zns.curvePricer.address,
            accessType: AccessType.OPEN,
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            token: zns.zeroToken.address,
            beneficiary: lvl2SubOwner.address,
          },
          priceConfig,
        },
      });

      const contractBalBefore = await zns.zeroToken.balanceOf(zns.treasury.address);
      const parentBalBefore = await zns.zeroToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.zeroToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.zeroToken.balanceOf(zeroVault.address);

      const label = "curvestakenofeechild";

      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
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
      await zns.subRegistrar.connect(lvl3SubOwner).revokeSubdomain(
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

    it("CurvePricer + DirectPayment no fee", async () => {
      const priceConfig = {
        ...priceConfigDefault,
        feePercentage: BigNumber.from(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "curvedirectnofee",
        fullConfig: {
          distrConfig: {
            pricerContract: zns.curvePricer.address,
            accessType: AccessType.OPEN,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: zns.zeroToken.address,
            beneficiary: lvl2SubOwner.address,
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
      await zns.subRegistrar.connect(lvl3SubOwner).revokeSubdomain(
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

    it("FixedPricer + DirectPayment with price = 0 - should NOT perform any transfers", async () => {
      const priceConfig = {
        price: BigNumber.from(0),
        feePercentage: BigNumber.from(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "zeroprice",
        fullConfig: {
          distrConfig: {
            pricerContract: zns.fixedPricer.address,
            accessType: AccessType.OPEN,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: zns.zeroToken.address,
            beneficiary: lvl2SubOwner.address,
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
      await zns.subRegistrar.connect(lvl3SubOwner).revokeSubdomain(
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

    it("CurvePricer + DirectPayment with price = 0 - should NOT perform any transfers", async () => {
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
        fullConfig: {
          distrConfig: {
            pricerContract: zns.curvePricer.address,
            accessType: AccessType.OPEN,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: zns.zeroToken.address,
            beneficiary: lvl2SubOwner.address,
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
      await zns.subRegistrar.connect(lvl3SubOwner).revokeSubdomain(
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

    it("CurvePricer + StakePayment with price = 0 - should NOT perform any transfers", async () => {
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
        fullConfig: {
          distrConfig: {
            pricerContract: zns.curvePricer.address,
            accessType: AccessType.OPEN,
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            token: zns.zeroToken.address,
            beneficiary: lvl2SubOwner.address,
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
      await zns.subRegistrar.connect(lvl3SubOwner).revokeSubdomain(
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

    it("FixedPricer + StakePayment with price = 0 - should NOT perform any transfers", async () => {
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
        fullConfig: {
          distrConfig: {
            pricerContract: zns.fixedPricer.address,
            accessType: AccessType.OPEN,
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            token: zns.zeroToken.address,
            beneficiary: lvl2SubOwner.address,
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
      await zns.subRegistrar.connect(lvl3SubOwner).revokeSubdomain(
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
              pricerContract: zns.fixedPricer.address,
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: zns.zeroToken.address,
              beneficiary: rootOwner.address,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
          },
        },
        {
          user: lvl2SubOwner,
          domainLabel: "levelone",
          fullConfig: {
            distrConfig: {
              pricerContract: zns.fixedPricer.address,
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: zns.zeroToken.address,
              beneficiary: lvl2SubOwner.address,
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
      await zns.subRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.LOCKED,
      );

      const balBefore = await zns.zeroToken.balanceOf(lvl2SubOwner.address);

      const hash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: regResults[1].domainHash,
        domainLabel: "ownercheck",
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
      await zns.subRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
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
        zns.subRegistrar.connect(lvl5SubOwner).registerSubdomain(
          res[0].domainHash,
          "tobedenied",
          ethers.constants.AddressZero,
          defaultTokenURI,
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

      await zns.subRegistrar.connect(lvl5SubOwner).registerSubdomain(
        parentHash,
        domainLabel,
        ethers.constants.AddressZero,
        defaultTokenURI,
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
    it("should ONLY allow mintlisted addresses and NOT allow other ones to register a domain when parent's accessType is WHITELIST", async () => {
      // approve direct payment
      await zns.zeroToken.connect(lvl3SubOwner).approve(zns.treasury.address, fixedPrice);
      // register parent with mintlisted access
      const parentHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: regResults[1].domainHash,
        domainLabel: "mintlistparent",
        fullConfig: {
          distrConfig: {
            pricerContract: zns.fixedPricer.address,
            paymentType: PaymentType.DIRECT,
            accessType: AccessType.MINTLIST,
          },
          paymentConfig: {
            token: zns.zeroToken.address,
            beneficiary: lvl3SubOwner.address,
          },
          priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
        },
      });

      // mintlist potential child user
      await zns.subRegistrar.connect(lvl3SubOwner).setMintlistForDomain(
        parentHash,
        [lvl4SubOwner.address],
        [true],
      );

      // register child
      const hash = await registrationWithSetup({
        zns,
        user: lvl4SubOwner,
        parentHash,
        domainLabel: "mintlisted",
      });

      // check registry
      const dataFromReg = await zns.registry.getDomainRecord(hash);
      expect(dataFromReg.owner).to.eq(lvl4SubOwner.address);
      expect(dataFromReg.resolver).to.eq(zns.addressResolver.address);

      // check domain token
      const tokenId = BigNumber.from(hash).toString();
      const tokenOwner = await zns.domainToken.ownerOf(tokenId);
      expect(tokenOwner).to.eq(lvl4SubOwner.address);

      // try to register child with non-mintlisted user
      await expect(
        zns.subRegistrar.connect(lvl5SubOwner).registerSubdomain(
          parentHash,
          "notmintlisted",
          ethers.constants.AddressZero,
          defaultTokenURI,
          distrConfigEmpty
        )
      ).to.be.revertedWith(
        "ZNSSubRegistrar: Sender is not approved for purchase"
      );

      // remove user from mintlist
      await zns.subRegistrar.connect(lvl3SubOwner).setMintlistForDomain(
        parentHash,
        [lvl4SubOwner.address],
        [false],
      );

      // try to register again
      await expect(
        zns.subRegistrar.connect(lvl4SubOwner).registerSubdomain(
          parentHash,
          "notmintlistednow",
          ethers.constants.AddressZero,
          defaultTokenURI,
          distrConfigEmpty
        )
      ).to.be.revertedWith(
        "ZNSSubRegistrar: Sender is not approved for purchase"
      );
    });

    it("#setMintlistForDomain should NOT allow setting if called by non-authorized account or registrar", async () => {
      const { domainHash } = regResults[1];

      // assign operator in registry
      // to see that he CAN do it
      await zns.registry.connect(lvl2SubOwner).setOwnerOperator(
        operator.address,
        true,
      );

      // try with operator
      await zns.subRegistrar.connect(operator).setMintlistForDomain(
        domainHash,
        [lvl5SubOwner.address],
        [true],
      );

      const mintlisted = await zns.subRegistrar.mintlist(
        domainHash,
        lvl5SubOwner.address
      );
      assert.ok(mintlisted, "User did NOT get mintlisted, but should've");

      // try with non-authorized
      await expect(
        zns.subRegistrar.connect(lvl5SubOwner).setMintlistForDomain(
          domainHash,
          [lvl5SubOwner.address],
          [true],
        )
      ).to.be.revertedWith(
        "ZNSSubRegistrar: Not authorized"
      );
    });

    it("should switch accessType for existing parent domain", async () => {
      await zns.subRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.LOCKED
      );

      await expect(
        zns.subRegistrar.connect(lvl5SubOwner).registerSubdomain(
          regResults[1].domainHash,
          "notallowed",
          ethers.constants.AddressZero,
          defaultTokenURI,
          distrConfigEmpty
        )
      ).to.be.revertedWith(
        DISTRIBUTION_LOCKED_ERR
      );

      // switch to mintlist
      await zns.subRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.MINTLIST
      );

      // add to mintlist
      await zns.subRegistrar.connect(lvl2SubOwner).setMintlistForDomain(
        regResults[1].domainHash,
        [lvl5SubOwner.address],
        [true],
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
      const paymentToParent = domainConfigs[1].fullConfig.distrConfig.paymentType === PaymentType.STAKE
        ? expectedPrice.add(stakeFee)
        : expectedPrice;

      const protocolFee = getStakingOrProtocolFee(paymentToParent);
      await zns.zeroToken.connect(lvl5SubOwner).approve(
        zns.treasury.address,
        paymentToParent.add(protocolFee)
      );

      // register
      await zns.subRegistrar.connect(lvl5SubOwner).registerSubdomain(
        regResults[1].domainHash,
        "alloweddddd",
        ethers.constants.AddressZero,
        defaultTokenURI,
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
      await zns.subRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
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
        fullConfig: fullDistrConfigEmpty, // accessType is 0 when supplying empty config
      });

      await expect(
        zns.subRegistrar.connect(lvl4SubOwner).registerSubdomain(
          parentHash,
          "notallowed",
          ethers.constants.AddressZero,
          defaultTokenURI,
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
              pricerContract: zns.fixedPricer.address,
              paymentType: PaymentType.STAKE,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: zns.zeroToken.address,
              beneficiary: rootOwner.address,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
          },
        },
        {
          user: lvl2SubOwner,
          domainLabel: "levelone",
          fullConfig: {
            distrConfig: {
              pricerContract: zns.fixedPricer.address,
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: zns.zeroToken.address,
              beneficiary: lvl2SubOwner.address,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
          },
        },
        {
          user: lvl3SubOwner,
          domainLabel: "lvlthree",
          fullConfig: {
            distrConfig: {
              pricerContract: zns.curvePricer.address,
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: zns.zeroToken.address,
              beneficiary: lvl3SubOwner.address,
            },
            priceConfig: priceConfigDefault,
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
        zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
          regResults[0].domainHash,
          domainConfigs[1].domainLabel,
          lvl2SubOwner.address,
          defaultTokenURI,
          domainConfigs[1].fullConfig.distrConfig
        )
      ).to.be.revertedWith(
        "ZNSSubRegistrar: Subdomain already exists"
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
        zns.subRegistrar.connect(lvl3SubOwner).revokeSubdomain(
          regResults[1].domainHash,
        )
      ).to.be.revertedWith(
        "ZNSSubRegistrar: Not the owner of both Name and Token"
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
        zns.subRegistrar.connect(lvl2SubOwner).revokeSubdomain(
          regResults[1].domainHash,
        )
      ).to.be.revertedWith(
        "ZNSSubRegistrar: Not the owner of both Name and Token"
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
      await zns.rootRegistrar.connect(lvl2SubOwner).reclaimDomain(
        regResults[1].domainHash,
      );

      const dataFromRegAfterReclaim = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromRegAfterReclaim.owner).to.eq(lvl2SubOwner.address);
      expect(dataFromRegAfterReclaim.resolver).to.eq(ethers.constants.AddressZero);
    });

    describe("#setDistributionConfigForDomain()", () => {
      it("should re-set distribution config for an existing subdomain", async () => {
        const domainHash = regResults[2].domainHash;

        const distrConfigBefore = await zns.subRegistrar.distrConfigs(domainHash);
        expect(distrConfigBefore.accessType).to.not.eq(AccessType.MINTLIST);
        expect(distrConfigBefore.pricerContract).to.not.eq(zns.fixedPricer.address);
        expect(
          distrConfigBefore.paymentType
        ).to.not.eq(
          PaymentType.STAKE
        );

        const newConfig = {
          pricerContract: zns.fixedPricer.address,
          paymentType: PaymentType.STAKE,
          accessType: AccessType.MINTLIST,
        };

        await zns.subRegistrar.connect(lvl3SubOwner).setDistributionConfigForDomain(
          domainHash,
          newConfig,
        );

        const distrConfigAfter = await zns.subRegistrar.distrConfigs(domainHash);
        expect(distrConfigAfter.accessType).to.eq(newConfig.accessType);
        expect(distrConfigAfter.pricerContract).to.eq(newConfig.pricerContract);
        expect(distrConfigAfter.paymentType).to.eq(newConfig.paymentType);

        // assign operator in registry
        await zns.registry.connect(lvl3SubOwner).setOwnerOperator(
          operator.address,
          true,
        );

        // reset it back
        await zns.subRegistrar.connect(operator).setDistributionConfigForDomain(
          domainHash,
          domainConfigs[2].fullConfig.distrConfig,
        );
        const origConfigAfter = await zns.subRegistrar.distrConfigs(domainHash);
        expect(origConfigAfter.accessType).to.eq(domainConfigs[2].fullConfig.distrConfig.accessType);
        expect(origConfigAfter.pricerContract).to.eq(domainConfigs[2].fullConfig.distrConfig.pricerContract);
        expect(
          origConfigAfter.paymentType
        ).to.eq(
          domainConfigs[2].fullConfig.distrConfig.paymentType
        );

        // remove operator
        await zns.registry.connect(lvl3SubOwner).setOwnerOperator(
          operator.address,
          false,
        );
      });

      it("should NOT allow to set distribution config for a non-authorized account", async () => {
        const domainHash = regResults[1].domainHash;

        const newConfig = {
          pricerContract: zns.curvePricer.address,
          paymentType: PaymentType.STAKE,
          accessType: AccessType.MINTLIST,
        };

        await expect(
          zns.subRegistrar.connect(lvl3SubOwner).setDistributionConfigForDomain(
            domainHash,
            newConfig,
          )
        ).to.be.revertedWith(
          "ZNSSubRegistrar: Not authorized"
        );
      });

      it("should revert if pricerContract is passed as 0x0 address", async () => {
        const domainHash = regResults[2].domainHash;

        const newConfig = {
          pricerContract: ethers.constants.AddressZero,
          paymentType: PaymentType.STAKE,
          accessType: AccessType.MINTLIST,
        };

        await expect(
          zns.subRegistrar.connect(lvl3SubOwner).setDistributionConfigForDomain(
            domainHash,
            newConfig,
          )
        ).to.be.revertedWith(
          "ZNSSubRegistrar: pricerContract can not be 0x0 address"
        );
      });
    });

    describe("#setPricerContractForDomain()", () => {
      it("should re-set pricer contract for an existing subdomain", async () => {
        const domainHash = regResults[2].domainHash;

        const pricerContractBefore = await zns.subRegistrar.distrConfigs(domainHash);
        expect(pricerContractBefore.pricerContract).to.eq(domainConfigs[2].fullConfig.distrConfig.pricerContract);

        await zns.subRegistrar.connect(lvl3SubOwner).setPricerContractForDomain(
          domainHash,
          zns.curvePricer.address,
        );

        const pricerContractAfter = await zns.subRegistrar.distrConfigs(domainHash);
        expect(pricerContractAfter.pricerContract).to.eq(zns.curvePricer.address);

        // reset it back
        await zns.subRegistrar.connect(lvl3SubOwner).setPricerContractForDomain(
          domainHash,
          domainConfigs[2].fullConfig.distrConfig.pricerContract,
        );
      });

      it("should NOT allow setting for non-authorized account", async () => {
        const domainHash = regResults[2].domainHash;

        await expect(
          zns.subRegistrar.connect(lvl2SubOwner).setPricerContractForDomain(
            domainHash,
            zns.curvePricer.address,
          )
        ).to.be.revertedWith(
          "ZNSSubRegistrar: Not authorized"
        );
      });

      it("should NOT set pricerContract to 0x0 address", async () => {
        const domainHash = regResults[2].domainHash;

        await expect(
          zns.subRegistrar.connect(lvl3SubOwner).setPricerContractForDomain(
            domainHash,
            ethers.constants.AddressZero,
          )
        ).to.be.revertedWith(
          "ZNSSubRegistrar: pricerContract can not be 0x0 address"
        );
      });
    });

    describe("#setPaymentTypeForDomain()", () => {
      it("should re-set payment type for an existing subdomain", async () => {
        const domainHash = regResults[2].domainHash;

        const { paymentType: paymentTypeBefore } = await zns.subRegistrar.distrConfigs(domainHash);
        expect(paymentTypeBefore).to.eq(domainConfigs[2].fullConfig.distrConfig.paymentType);

        await zns.subRegistrar.connect(lvl3SubOwner).setPaymentTypeForDomain(
          domainHash,
          PaymentType.STAKE,
        );

        const { paymentType: paymentTypeAfter } = await zns.subRegistrar.distrConfigs(domainHash);
        expect(paymentTypeAfter).to.eq(PaymentType.STAKE);

        // reset it back
        await zns.subRegistrar.connect(lvl3SubOwner).setPaymentTypeForDomain(
          domainHash,
          domainConfigs[2].fullConfig.distrConfig.paymentType,
        );
      });

      it("should NOT allow setting for non-authorized account", async () => {
        const domainHash = regResults[2].domainHash;

        await expect(
          zns.subRegistrar.connect(lvl2SubOwner).setPaymentTypeForDomain(
            domainHash,
            PaymentType.STAKE,
          )
        ).to.be.revertedWith(
          "ZNSSubRegistrar: Not authorized"
        );
      });

      it("should emit #PaymentTypeSet event with correct params", async () => {
        const domainHash = regResults[2].domainHash;

        await expect(
          zns.subRegistrar.connect(lvl3SubOwner).setPaymentTypeForDomain(
            domainHash,
            PaymentType.STAKE,
          )
        ).to.emit(zns.subRegistrar, "PaymentTypeSet").withArgs(
          domainHash,
          PaymentType.STAKE,
        );

        // reset back
        await zns.subRegistrar.connect(lvl3SubOwner).setPaymentTypeForDomain(
          domainHash,
          domainConfigs[2].fullConfig.distrConfig.paymentType,
        );
      });
    });

    // eslint-disable-next-line max-len
    it("should TRANSFER ownership of a subdomain and let the receiver RECLAIM and then revoke with REFUND", async () => {
      const tokenId = BigNumber.from(regResults[1].domainHash).toString();

      const { amount: stakedBefore } = await zns.treasury.stakedForDomain(regResults[1].domainHash);

      await zns.domainToken.connect(lvl2SubOwner).transferFrom(
        lvl2SubOwner.address,
        lvl3SubOwner.address,
        tokenId
      );

      // Verify owner in registry
      const dataFromReg = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromReg.owner).to.eq(lvl2SubOwner.address);

      // reclaim
      await zns.rootRegistrar.connect(lvl3SubOwner).reclaimDomain(
        regResults[1].domainHash,
      );

      // Verify domain token is still owned
      const tokenOwner = await zns.domainToken.ownerOf(tokenId);
      expect(tokenOwner).to.eq(lvl3SubOwner.address);

      // Verify owner in registry
      const dataFromRegAfter = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromRegAfter.owner).to.eq(lvl3SubOwner.address);

      // verify stake still existing
      const { amount: stakedAfter } = await zns.treasury.stakedForDomain(regResults[1].domainHash);
      expect(stakedAfter).to.eq(stakedBefore);

      const userBalbefore = await zns.zeroToken.balanceOf(lvl3SubOwner.address);

      // try revoking
      await zns.subRegistrar.connect(lvl3SubOwner).revokeSubdomain(
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
      const tx = await zns.subRegistrar.connect(admin).setRootRegistrar(random.address);

      await expect(tx).to.emit(zns.subRegistrar, "RootRegistrarSet").withArgs(random.address);

      expect(await zns.subRegistrar.rootRegistrar()).to.equal(random.address);
    });

    it("#setRootRegistrar() should NOT be callable by anyone other than ADMIN_ROLE", async () => {
      await expect(
        zns.subRegistrar.connect(random).setRootRegistrar(random.address),
      ).to.be.revertedWith(
        getAccessRevertMsg(random.address, ADMIN_ROLE),
      );
    });

    it("#setRootRegistrar should NOT set registrar as 0x0 address", async () => {
      await expect(
        zns.subRegistrar.connect(admin).setRootRegistrar(ethers.constants.AddressZero),
      ).to.be.revertedWith(
        "ZNSSubRegistrar: _registrar can not be 0x0 address",
      );
    });

    it("#setRegistry() should set the new registry correctly and emit #RegistrySet event", async () => {
      const tx = await zns.subRegistrar.connect(admin).setRegistry(random.address);

      await expect(tx).to.emit(zns.subRegistrar, "RegistrySet").withArgs(random.address);

      expect(await zns.subRegistrar.registry()).to.equal(random.address);
    });

    it("#setRegistry() should not be callable by anyone other than ADMIN_ROLE", async () => {
      await expect(
        zns.subRegistrar.connect(random).setRegistry(random.address),
      ).to.be.revertedWith(
        getAccessRevertMsg(random.address, ADMIN_ROLE),
      );
    });

    it("#setAccessController() should not be callable by anyone other than ADMIN_ROLE", async () => {
      await expect(
        zns.subRegistrar.connect(random).setAccessController(random.address),
      ).to.be.revertedWith(
        getAccessRevertMsg(random.address, ADMIN_ROLE),
      );
    });

    it("#getAccessController() should return the correct access controller", async () => {
      expect(
        await zns.subRegistrar.getAccessController()
      ).to.equal(zns.accessController.address);
    });

    // eslint-disable-next-line max-len
    it("#setAccessController() should set the new access controller correctly and emit #AccessControllerSet event", async () => {
      const tx = await zns.subRegistrar.connect(admin).setAccessController(random.address);

      await expect(tx).to.emit(zns.subRegistrar, "AccessControllerSet").withArgs(random.address);

      expect(await zns.subRegistrar.getAccessController()).to.equal(random.address);
    });
  });

  describe("UUPS", () => {
    let fixedPrice : BigNumber;
    let rootHash : string;

    beforeEach(async () => {
      [
        deployer,
        zeroVault,
        governor,
        admin,
        rootOwner,
        lvl2SubOwner,
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
        ].map(async ({ address }) =>
          zns.zeroToken.mint(address, ethers.utils.parseEther("1000000")))
      );
      await zns.zeroToken.connect(rootOwner).approve(zns.treasury.address, ethers.constants.MaxUint256);

      fixedPrice = ethers.utils.parseEther("397.13");
      // register root domain
      rootHash = await registrationWithSetup({
        zns,
        user: rootOwner,
        domainLabel: "root",
        fullConfig: {
          distrConfig: {
            accessType: AccessType.OPEN,
            pricerContract: zns.fixedPricer.address,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: zns.zeroToken.address,
            beneficiary: rootOwner.address,
          },
          priceConfig: {
            price: fixedPrice,
            feePercentage: BigNumber.from(0),
          },
        },
      });
    });

    it("Allows an authorized user to upgrade the contract", async () => {
      // SubRegistrar to upgrade to
      const factory = new ZNSSubRegistrarUpgradeMock__factory(deployer);
      const newRegistrar = await factory.deploy();
      await newRegistrar.deployed();

      // Confirm the deployer is a governor, as set in `deployZNS` helper
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const tx = zns.subRegistrar.connect(deployer).upgradeTo(newRegistrar.address);
      await expect(tx).to.not.be.reverted;

      await expect(
        zns.subRegistrar.connect(deployer).initialize(
          zns.accessController.address,
          zns.registry.address,
          zns.rootRegistrar.address,
        )
      ).to.be.revertedWith(INITIALIZED_ERR);
    });

    it("Fails to upgrade if the caller is not authorized", async () => {
      // SubRegistrar to upgrade to
      const factory = new ZNSSubRegistrarUpgradeMock__factory(deployer);
      const newRegistrar = await factory.deploy();
      await newRegistrar.deployed();

      // Confirm the account is not a governor
      await expect(zns.accessController.checkGovernor(lvl2SubOwner.address)).to.be.reverted;

      const tx = zns.subRegistrar.connect(lvl2SubOwner).upgradeTo(newRegistrar.address);

      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(lvl2SubOwner.address, GOVERNOR_ROLE)
      );
    });

    it("Verifies that variable values are not changed in the upgrade process", async () => {
      // Confirm deployer has the correct role first
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const registrarFactory = new ZNSSubRegistrarUpgradeMock__factory(deployer);
      const registrar = await registrarFactory.deploy();
      await registrar.deployed();

      const domainLabel = "world";

      await zns.zeroToken.connect(lvl2SubOwner).approve(zns.treasury.address, ethers.constants.MaxUint256);
      await zns.zeroToken.mint(lvl2SubOwner.address, parseEther("1000000"));

      await zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
        rootHash,
        domainLabel,
        lvl2SubOwner.address,
        defaultTokenURI,
        {
          accessType: AccessType.OPEN,
          pricerContract: zns.fixedPricer.address,
          paymentType: PaymentType.DIRECT,
        }
      );

      const domainHash = await getDomainHashFromEvent({
        zns,
        user: lvl2SubOwner,
      });

      await zns.subRegistrar.setRootRegistrar(lvl2SubOwner.address);

      const contractCalls = [
        zns.subRegistrar.getAccessController(),
        zns.subRegistrar.registry(),
        zns.subRegistrar.rootRegistrar(),
        zns.registry.exists(domainHash),
        zns.treasury.stakedForDomain(domainHash),
        zns.domainToken.name(),
        zns.domainToken.symbol(),
        zns.fixedPricer.getPrice(ethers.constants.HashZero, domainLabel),
      ];

      await validateUpgrade(deployer, zns.subRegistrar, registrar, registrarFactory, contractCalls);
    });

    it("Allows to add more fields to the existing struct in a mapping", async () => {
      // SubRegistrar to upgrade to
      const factory = new ZNSSubRegistrarUpgradeMock__factory(deployer);
      const newRegistrar = await factory.deploy();
      await newRegistrar.deployed();

      const tx = zns.subRegistrar.connect(deployer).upgradeTo(newRegistrar.address);
      await expect(tx).to.not.be.reverted;

      // create new proxy object
      const newRegistrarProxy = factory.attach(zns.subRegistrar.address);

      // check values in storage
      const rootConfigBefore = await newRegistrarProxy.distrConfigs(rootHash);
      expect(rootConfigBefore.accessType).to.eq(AccessType.OPEN);
      expect(rootConfigBefore.pricerContract).to.eq(zns.fixedPricer.address);
      expect(rootConfigBefore.paymentType).to.eq(PaymentType.DIRECT);

      await zns.zeroToken.mint(lvl2SubOwner.address, parseEther("1000000"));
      await zns.zeroToken.connect(lvl2SubOwner).approve(zns.treasury.address, parseEther("1000000"));

      const subConfigToSet = {
        accessType: AccessType.MINTLIST,
        pricerContract: zns.curvePricer.address,
        paymentType: PaymentType.STAKE,
        newAddress: lvl2SubOwner.address,
        newUint: BigNumber.from(1912171236),
      };

      // register a subdomain with new logic
      await newRegistrarProxy.connect(lvl2SubOwner).registerSubdomain(
        rootHash,
        "subbb",
        lvl2SubOwner.address,
        defaultTokenURI,
        subConfigToSet
      );

      const subHash = await getDomainHashFromEvent({
        zns,
        user: lvl2SubOwner,
      });

      const rootConfigAfter = await zns.subRegistrar.distrConfigs(rootHash);
      expect(rootConfigAfter.accessType).to.eq(rootConfigBefore.accessType);
      expect(rootConfigAfter.pricerContract).to.eq(rootConfigBefore.pricerContract);
      expect(rootConfigAfter.paymentType).to.eq(rootConfigBefore.paymentType);
      expect(rootConfigAfter.length).to.eq(3);

      const updatedStructConfig = {
        accessType: AccessType.OPEN,
        pricerContract: zns.fixedPricer.address,
        paymentType: PaymentType.DIRECT,
        newAddress: lvl2SubOwner.address,
        newUint: BigNumber.from(123),
      };

      // try setting new fields to the new struct
      await newRegistrarProxy.connect(rootOwner).setDistributionConfigForDomain(
        rootHash,
        updatedStructConfig
      );

      // check what we got for new
      const rootConfigFinal = await newRegistrarProxy.distrConfigs(rootHash);
      const subConfigAfter = await newRegistrarProxy.distrConfigs(subHash);

      // validate the new config has been set correctly
      expect(subConfigAfter.accessType).to.eq(subConfigToSet.accessType);
      expect(subConfigAfter.pricerContract).to.eq(subConfigToSet.pricerContract);
      expect(subConfigAfter.paymentType).to.eq(subConfigToSet.paymentType);
      expect(subConfigAfter.newAddress).to.eq(subConfigToSet.newAddress);
      expect(subConfigAfter.newUint).to.eq(subConfigToSet.newUint);

      // validate the old values stayed the same and new values been added
      expect(rootConfigFinal.accessType).to.eq(rootConfigBefore.accessType);
      expect(rootConfigFinal.pricerContract).to.eq(rootConfigBefore.pricerContract);
      expect(rootConfigFinal.paymentType).to.eq(rootConfigBefore.paymentType);
      expect(rootConfigFinal.newAddress).to.eq(updatedStructConfig.newAddress);
      expect(rootConfigFinal.newUint).to.eq(updatedStructConfig.newUint);

      // check that crucial state vars stayed the same
      expect(await newRegistrarProxy.getAccessController()).to.eq(zns.accessController.address);
      expect(await newRegistrarProxy.registry()).to.eq(zns.registry.address);
      expect(await newRegistrarProxy.rootRegistrar()).to.eq(zns.rootRegistrar.address);
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
