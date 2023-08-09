import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IDistributionConfig, IDomainConfigForTest, ITreeRegResult, ZNSContracts } from "./helpers/types";
import {
  deployZNS, getPrice, getPriceObject,
  hashDomainLabel,
  hashSubdomainName, INVALID_TOKENID_ERC_ERR,
  normalizeName,
  priceConfigDefault,
  REGISTRAR_ROLE,
} from "./helpers";
import * as hre from "hardhat";
import * as ethers from "ethers";
import {
  ZNSDirectPayment,
  ZNSDirectPayment__factory,
  ZNSFixedPricing,
  ZNSFixedPricing__factory, ZNSSubdomainRegistrar, ZNSSubdomainRegistrar__factory,
} from "../typechain";
import { expect } from "chai";
import { getDomainHashFromEvent, getDomainHashFromReceipt } from "./helpers/events";
import { BigNumber, Contract } from "ethers";
import { registrationWithSetup } from "./helpers/register-setup";
import { registerDomainTree } from "./helpers/flows/registration";
import assert from "assert";


describe("ZNSSubdomainRegistrar", () => {
  let deployer : SignerWithAddress;
  let rootOwner : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let lvl1SubOwner : SignerWithAddress;
  let lvl2SubOwner : SignerWithAddress;
  let lvl3SubOwner : SignerWithAddress;
  let lvl4SubOwner : SignerWithAddress;
  let lvl5SubOwner : SignerWithAddress;

  let zns : ZNSContracts;
  let zeroVault : SignerWithAddress;

  let defaultDistConfig : IDistributionConfig;

  // NI - non-isolated tests - these tests can only be run all together,
  // since they depend on each other (one flow broken down into multiple tests)
  describe("Register-Revoke by level - 3 levels (NI, smoke)", () => {
    let subdomainPrice : BigNumber;
    let subdomainHash : string;
    let subSubdomainHash : string;
    let subTokenId : string;
    let subSubTokenId : string;
    let subdomainFee : BigNumber;

    const rootDomainName = normalizeName("wilder");
    const rootDomainHash = hashDomainLabel(rootDomainName);
    const subdomainLabel = normalizeName("beast");
    const subSubdomainLabel = normalizeName("wape");
    const subdomainName = `${rootDomainName}.${subdomainLabel}`;
    const subHash = hashSubdomainName(subdomainName);
    const subdomainHashKecc = ethers.utils.keccak256(
      rootDomainHash,
      ethers.utils.toUtf8Bytes(subdomainName)
    );

    before(async () => {
      [
        deployer,
        zeroVault,
        rootOwner,
        governor,
        admin,
        lvl1SubOwner,
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

      // Give funds to user
      await zns.zeroToken.connect(rootOwner).approve(zns.treasury.address, ethers.constants.MaxUint256);
      await zns.zeroToken.mint(rootOwner.address, priceConfigDefault.maxPrice);
      await zns.zeroToken.mint(lvl1SubOwner.address, ethers.utils.parseEther("10000000000000"));
      await zns.zeroToken.mint(lvl2SubOwner.address, ethers.utils.parseEther("10000000000000"));

      defaultDistConfig = {
        pricingContract: zns.fixedPricing.address,
        paymentContract: zns.directPayment.address,
        accessType: 1,
      };

      const distrConfig = {
        ...defaultDistConfig,
        pricingContract: zns.asPricing.address,
        paymentContract: zns.stakePayment.address,
      };

      const fullRootConfig = {
        distrConfig,
        priceConfig: priceConfigDefault,
        paymentConfig: {
          paymentToken: zns.zeroToken.address,
          beneficiary: rootOwner.address,
        },
      };

      await registrationWithSetup({
        zns,
        user: rootOwner,
        domainLabel: rootDomainName,
        fullConfig: fullRootConfig,
        isRootDomain: true,
      });
    });

    it("should register lvl 1 subdomain (fixedPricing + directPayment)", async () => {
      const subOwnerBalBefore = await zns.zeroToken.balanceOf(lvl1SubOwner.address);
      const parentOwnerBalBefore = await zns.zeroToken.balanceOf(rootOwner.address);

      const subPriceObj = await getPriceObject(
        subdomainLabel
      );
      ({
        expectedPrice: subdomainPrice,
        fee: subdomainFee,
      } = subPriceObj);

      await zns.zeroToken.connect(lvl1SubOwner).approve(
        zns.stakePayment.address,
        subdomainPrice.add(subdomainFee)
      );

      const fullSubConfig = {
        distrConfig: defaultDistConfig,
        priceConfig: subdomainPrice,
        paymentConfig: {
          paymentToken: zns.zeroToken.address,
          beneficiary: lvl1SubOwner.address,
        },
      };

      subdomainHash = await registrationWithSetup({
        zns,
        user: lvl1SubOwner,
        parentHash: rootDomainHash,
        domainLabel: subdomainLabel,
        fullConfig: fullSubConfig,
        isRootDomain: false,
      });

      // TODO sub: figure this out!
      // expect(parentHashFromSC).to.eq(rootDomainHash);
      // expect(subHashFromSC).to.eq(subdomainHash);
      // expect(subdomainHash).to.eq(subdomainHashKecc);

      const subOwnerBalAfter = await zns.zeroToken.balanceOf(lvl1SubOwner.address);
      const parentOwnerBalAfter = await zns.zeroToken.balanceOf(rootOwner.address);

      expect(
        subOwnerBalBefore.sub(subOwnerBalAfter)
      ).to.eq(
        subdomainPrice.add(subdomainFee)
      );
      expect(
        parentOwnerBalAfter.sub(parentOwnerBalBefore)
      ).to.eq(
        subdomainFee
      );

      const dataFromReg = await zns.registry.getDomainRecord(subdomainHash);
      expect(dataFromReg.owner).to.eq(lvl1SubOwner.address);
      expect(dataFromReg.resolver).to.eq(zns.addressResolver.address);

      subTokenId = BigNumber.from(subdomainHash).toString();
      const subTokenOwner = await zns.domainToken.ownerOf(subTokenId);
      expect(subTokenOwner).to.eq(lvl1SubOwner.address);

      // resolution check
      const domainAddress = await zns.addressResolver.getAddress(subdomainHash);
      expect(domainAddress).to.eq(lvl1SubOwner.address);
    });

    it("should register lvl 2 subdomain", async () => {
      const subOwnerBalBefore = await zns.zeroToken.balanceOf(lvl1SubOwner.address);
      const subSubOwnerBalBefore = await zns.zeroToken.balanceOf(lvl2SubOwner.address);

      await zns.zeroToken.connect(lvl2SubOwner).approve(
        zns.directPayment.address,
        subdomainPrice
      );

      await zns.subdomainRegistrar.connect(lvl2SubOwner).registerSubdomain(
        subdomainHash,
        subSubdomainLabel,
        lvl2SubOwner.address,
        defaultDistConfig
      );

      subSubdomainHash = await getDomainHashFromEvent({
        zns,
        user: lvl2SubOwner,
      });

      // TODO sub: figure this out!
      // expect(parentHashFromSC).to.eq(rootDomainHash);
      // expect(subHashFromSC).to.eq(subdomainHash);
      // expect(subdomainHash).to.eq(subdomainHashKecc);

      const subOwnerBalAfter = await zns.zeroToken.balanceOf(lvl1SubOwner.address);
      const subSubOwnerBalAfter = await zns.zeroToken.balanceOf(lvl2SubOwner.address);

      expect(
        subOwnerBalAfter.sub(subOwnerBalBefore)
      ).to.eq(
        subdomainPrice
      );
      expect(
        subSubOwnerBalBefore.sub(subSubOwnerBalAfter)
      ).to.eq(
        subdomainPrice
      );

      const dataFromReg = await zns.registry.getDomainRecord(subSubdomainHash);
      expect(dataFromReg.owner).to.eq(lvl2SubOwner.address);
      expect(dataFromReg.resolver).to.eq(zns.addressResolver.address);

      subSubTokenId = BigNumber.from(subSubdomainHash).toString();
      const subTokenOwner = await zns.domainToken.ownerOf(subSubTokenId);
      expect(subTokenOwner).to.eq(lvl2SubOwner.address);

      // resolution check
      const domainAddress = await zns.addressResolver.getAddress(subSubdomainHash);
      expect(domainAddress).to.eq(lvl2SubOwner.address);
    });

    it("should revoke a lvl 2 subdomain", async () => {
      await zns.subdomainRegistrar.connect(lvl2SubOwner).revokeSubdomain(subdomainHash, subSubdomainHash);

      const dataFromReg = await zns.registry.getDomainRecord(subSubdomainHash);
      expect(dataFromReg.owner).to.eq(ethers.constants.AddressZero);
      expect(dataFromReg.resolver).to.eq(ethers.constants.AddressZero);

      await expect(
        zns.domainToken.ownerOf(subSubTokenId)
      ).to.be.revertedWith(
        INVALID_TOKENID_ERC_ERR
      );

      // TODO sub: add checks that owner can't call domain functions on Registry anymore
    });

    it("should revoke lvl 1 subdomain with refund", async () => {
      const subOwnerBalBefore = await zns.zeroToken.balanceOf(lvl1SubOwner.address);
      const parentOwnerBalBefore = await zns.zeroToken.balanceOf(rootOwner.address);

      await zns.subdomainRegistrar.connect(lvl1SubOwner).revokeSubdomain(rootDomainHash, subdomainHash);

      const subOwnerBalAfter = await zns.zeroToken.balanceOf(lvl1SubOwner.address);
      const parentOwnerBalAfter = await zns.zeroToken.balanceOf(rootOwner.address);

      expect(
        subOwnerBalAfter.sub(subOwnerBalBefore)
      ).to.eq(
        subdomainPrice
      );
      expect(
        parentOwnerBalBefore.sub(parentOwnerBalAfter)
      ).to.eq(
        BigNumber.from(0)
      );

      const dataFromReg = await zns.registry.getDomainRecord(subdomainHash);
      expect(dataFromReg.owner).to.eq(ethers.constants.AddressZero);
      expect(dataFromReg.resolver).to.eq(ethers.constants.AddressZero);

      await expect(
        zns.domainToken.ownerOf(subTokenId)
      ).to.be.revertedWith(
        INVALID_TOKENID_ERC_ERR
      );
    });
  });

  describe("6 level tree (5 subdomains) with all possible configs (NI)", () => {
    let domainConfigs : Array<IDomainConfigForTest>;
    let regResults : Array<ITreeRegResult>;

    const fixedPrice = ethers.utils.parseEther("1375.612");

    before(async () => {
      [
        deployer,
        zeroVault,
        governor,
        admin,
        rootOwner,
        lvl1SubOwner,
        lvl2SubOwner,
        lvl3SubOwner,
        lvl4SubOwner,
        lvl5SubOwner,
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
      await zns.zeroToken.mint(rootOwner.address, ethers.utils.parseEther("10000000000000"));
      await zns.zeroToken.mint(lvl1SubOwner.address, ethers.utils.parseEther("10000000000000"));
      await zns.zeroToken.mint(lvl2SubOwner.address, ethers.utils.parseEther("10000000000000"));
      await zns.zeroToken.mint(lvl3SubOwner.address, ethers.utils.parseEther("10000000000000"));
      await zns.zeroToken.mint(lvl4SubOwner.address, ethers.utils.parseEther("10000000000000"));
      await zns.zeroToken.mint(lvl5SubOwner.address, ethers.utils.parseEther("10000000000000"));

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
          user: lvl1SubOwner,
          domainLabel: "lvlOne",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.asPricing.address,
              paymentContract: zns.stakePayment.address,
              accessType: 1,
            },
            priceConfig: priceConfigDefault,
            paymentConfig: {
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl1SubOwner.address,
            },
          },
        },
        {
          user: lvl2SubOwner,
          domainLabel: "lvlTwo",
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
              beneficiary: lvl2SubOwner.address,
            },
          },
        },
        {
          user: lvl3SubOwner,
          domainLabel: "lvlThree",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.fixedPricing.address,
              paymentContract: zns.stakePayment.address,
              accessType: 1,
            },
            priceConfig: fixedPrice,
            paymentConfig: {
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl3SubOwner.address,
            },
          },
        },
        {
          user: lvl4SubOwner,
          domainLabel: "lvlFour",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.fixedPricing.address,
              paymentContract: zns.directPayment.address,
              accessType: 1,
            },
            priceConfig: fixedPrice,
            paymentConfig: {
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl4SubOwner.address,
            },
          },
        },
        {
          user: lvl5SubOwner,
          domainLabel: "lvlFive",
          fullConfig: {
            distrConfig: {
              pricingContract: zns.asPricing.address,
              paymentContract: zns.stakePayment.address,
              accessType: 1,
            },
            priceConfig: priceConfigDefault,
            paymentConfig: {
              paymentToken: zns.zeroToken.address,
              beneficiary: lvl5SubOwner.address,
            },
          },
        },
      ];

      regResults = await registerDomainTree({
        zns,
        domainConfigs,
      });

      assert.equal(regResults.length, domainConfigs.length);
    });

    it("should register a tree of 5 subdomains with different configs", async () => {
      await domainConfigs.reduce(
        async (
          acc,
          {
            user,
            fullConfig,
            domainLabel,
          },
          idx,
          array
        ) => {
          await acc;

          let expectedPrice = fixedPrice;
          let fee = BigNumber.from(0);

          // calc only needed for asymptotic pricing, otherwise it is fixed
          if (idx === 0 || array[idx - 1].fullConfig?.distrConfig.pricingContract === zns.asPricing.address) {
            ({
              expectedPrice,
              fee,
            } = getPriceObject(domainLabel));
          }

          const {
            domainHash,
            userBalanceBefore,
            userBalanceAfter,
            parentBalanceBefore,
            parentBalanceAfter,
          } = regResults[idx];

          // if parent's payment contract is staking, then beneficiary only gets the fee
          const expParentBalDiff =
            idx === 0 || array[idx - 1].fullConfig?.distrConfig.paymentContract === zns.stakePayment.address
              ? fee : expectedPrice.add(fee);

          // fee can be 0
          const expUserBalDiff = expectedPrice.add(fee);

          // check user balance
          expect(userBalanceBefore.sub(userBalanceAfter)).to.eq(expUserBalDiff);
          // check parent balance
          expect(parentBalanceAfter.sub(parentBalanceBefore)).to.eq(expParentBalDiff);

          const dataFromReg = await zns.registry.getDomainRecord(domainHash);
          expect(dataFromReg.owner).to.eq(user.address);
          expect(dataFromReg.resolver).to.eq(zns.addressResolver.address);

          const tokenId = BigNumber.from(domainHash).toString();
          const tokenOwner = await zns.domainToken.ownerOf(tokenId);
          expect(tokenOwner).to.eq(user.address);

          const domainAddress = await zns.addressResolver.getAddress(domainHash);
          expect(domainAddress).to.eq(user.address);
        }, Promise.resolve()
      );
    });
  });

  // TODO sub: test what happens if subOwner revokes before subSubOwner
});
