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
import { registerDomainPath } from "./helpers/flows/registration";
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

  let zns : ZNSContracts;
  let zeroVault : SignerWithAddress;

  describe.only("6 level path (5 subdomains) with all possible configs", () => {
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
      await zns.zeroToken.mint(lvl2SubOwner.address, ethers.utils.parseEther("10000000000000"));
      await zns.zeroToken.mint(lvl3SubOwner.address, ethers.utils.parseEther("10000000000000"));
      await zns.zeroToken.mint(lvl4SubOwner.address, ethers.utils.parseEther("10000000000000"));
      await zns.zeroToken.mint(lvl5SubOwner.address, ethers.utils.parseEther("10000000000000"));
      await zns.zeroToken.mint(lvl6SubOwner.address, ethers.utils.parseEther("10000000000000"));

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
  });

  // TODO sub: test what happens if subOwner revokes before subSubOwner
});
