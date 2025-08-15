/* eslint-disable no-shadow, @typescript-eslint/no-shadow */
import { IDomainConfigForTest, IPathRegResult } from "../types";
import { registrationWithSetup } from "../register-setup";
import { ethers } from "ethers";
import { decodePriceConfig, getPriceObject, getStakingOrProtocolFee } from "../pricing";
import { expect } from "chai";
import { getDomainRegisteredEvents } from "../events";
import { PaymentType } from "../constants";
import { getTokenContract } from "../tokens";
import { ICurvePriceConfig } from "../../../src/deploy/missions/types";
import { IZNSContracts } from "../../../src/deploy/campaign/types";

interface DomainObj {
  domainHash : string;
  userBalanceBefore : bigint;
  userBalanceAfter : bigint;
  parentBalanceBefore : bigint;
  parentBalanceAfter : bigint;
  treasuryBalanceBefore : bigint;
  treasuryBalanceAfter : bigint;
  zeroVaultBalanceBefore : bigint;
  zeroVaultBalanceAfter : bigint;
}

export const registerDomainPath = async ({
  zns,
  domainConfigs,
  zeroVaultAddress,
} : {
  zns : IZNSContracts;
  domainConfigs : Array<IDomainConfigForTest>;
  zeroVaultAddress : string;
}) : Promise<Array<IPathRegResult>> => domainConfigs.reduce(
  async (
    acc : Promise<Array<IPathRegResult>>,
    config,
    idx
  ) => {
    const newAcc = await acc;

    let parentHash = config.parentHash;
    if (!parentHash) {
      parentHash = !!newAcc[idx - 1]
        ? newAcc[idx - 1].domainHash
        : ethers.ZeroHash;
    }

    const isRootDomain = parentHash === ethers.ZeroHash;

    // and get the necessary contracts based on parent config
    let paymentTokenContract;
    let beneficiary;

    if (isRootDomain) {
      paymentTokenContract = zns.meowToken;
      // no beneficiary for root domain
      beneficiary = ethers.ZeroAddress;
    } else {
      // grab all the important data of the parent
      const paymentConfig = await zns.treasury.paymentConfigs(parentHash);
      const { token: paymentTokenAddress } = paymentConfig;
      ({ beneficiary } = paymentConfig);

      if (paymentTokenAddress === await zns.meowToken.getAddress()) {
        paymentTokenContract = zns.meowToken;
      } else {
        paymentTokenContract = getTokenContract(paymentTokenAddress, config.user);
      }
    }

    const parentBalanceBefore = isRootDomain
      ? BigInt(0)
      : await paymentTokenContract.balanceOf(beneficiary);
    const userBalanceBefore = await paymentTokenContract.balanceOf(config.user.address);
    const treasuryBalanceBefore = await paymentTokenContract.balanceOf(await zns.treasury.getAddress());
    const zeroVaultBalanceBefore = await paymentTokenContract.balanceOf(zeroVaultAddress);

    const domainHash = await registrationWithSetup({
      zns,
      parentHash,
      ...config,
    });

    const parentBalanceAfter = isRootDomain
      ? BigInt(0)
      : await paymentTokenContract.balanceOf(beneficiary);
    const userBalanceAfter = await paymentTokenContract.balanceOf(config.user.address);
    const treasuryBalanceAfter = await paymentTokenContract.balanceOf(await zns.treasury.getAddress());
    const zeroVaultBalanceAfter = await paymentTokenContract.balanceOf(zeroVaultAddress);

    const domainObj : DomainObj = {
      domainHash,
      userBalanceBefore,
      userBalanceAfter,
      parentBalanceBefore,
      parentBalanceAfter,
      treasuryBalanceBefore,
      treasuryBalanceAfter,
      zeroVaultBalanceBefore,
      zeroVaultBalanceAfter,
    };

    return [...newAcc, domainObj];
  }, Promise.resolve([])
);

export const validatePathRegistration = async ({
  zns,
  domainConfigs,
  regResults,
} : {
  zns : IZNSContracts;
  domainConfigs : Array<IDomainConfigForTest>;
  regResults : Array<IPathRegResult>;
}) => domainConfigs.reduce(
  async (
    acc,
    {
      user,
      domainLabel,
      parentHash,
    },
    idx
  ) => {
    await acc;

    let expectedPrice : bigint;
    let stakeFee = BigInt(0);

    // calc only needed for asymptotic pricing, otherwise it is fixed
    let parentHashFound = parentHash;
    if (!parentHashFound) {
      parentHashFound = !!regResults[idx - 1] ? regResults[idx - 1].domainHash : ethers.ZeroHash;
    }

    const rootConfigBytes = await zns.rootRegistrar.rootPriceConfig();

    const {
      maxPrice,
      curveMultiplier,
      maxLength,
      baseLength,
      precisionMultiplier,
      feePercentage,
    } = decodePriceConfig(rootConfigBytes) as ICurvePriceConfig;

    let expParentBalDiff;
    let expTreasuryBalDiff;
    let paymentType;
    if (parentHashFound === ethers.ZeroHash) {
      ({
        expectedPrice,
      } = getPriceObject(
        domainLabel,
        {
          maxPrice,
          curveMultiplier,
          maxLength,
          baseLength,
          precisionMultiplier,
          feePercentage,
        },
      ));
      expParentBalDiff = BigInt(0);
      expTreasuryBalDiff = expectedPrice;
    } else {
      const config = await zns.subRegistrar.distrConfigs(parentHashFound);
      const {
        pricerContract,
      } = config;
      ({ paymentType } = config);

      if (pricerContract === await zns.fixedPricer.getAddress()) {
        ({
          price: expectedPrice,
          fee: stakeFee,
        } = await zns.fixedPricer.getPriceAndFee(config.priceConfig, domainLabel, false));
      } else {
        const priceConfig = await (await zns.subRegistrar.distrConfigs(parentHashFound)).priceConfig;

        const {
          maxPrice,
          curveMultiplier,
          maxLength,
          baseLength,
          precisionMultiplier,
          feePercentage,
        } = decodePriceConfig(priceConfig) as ICurvePriceConfig;

        ({
          expectedPrice,
          stakeFee,
        } = getPriceObject(
          domainLabel,
          {
            maxPrice,
            curveMultiplier,
            maxLength,
            baseLength,
            precisionMultiplier,
            feePercentage,
          },
        ));
      }

      // if parent's payment is staking, then beneficiary only gets the fee
      if (paymentType === PaymentType.STAKE) {
        expParentBalDiff = stakeFee;
      } else {
        stakeFee = BigInt(0);
        expParentBalDiff = expectedPrice;
      }

      expTreasuryBalDiff = paymentType === PaymentType.STAKE
        ? expectedPrice : BigInt(0);
    }

    const protocolFee = getStakingOrProtocolFee(
      expectedPrice + stakeFee,
      feePercentage
    );

    const {
      domainHash,
      userBalanceBefore,
      userBalanceAfter,
      parentBalanceBefore,
      parentBalanceAfter,
      treasuryBalanceBefore,
      treasuryBalanceAfter,
      zeroVaultBalanceBefore,
      zeroVaultBalanceAfter,
    } = regResults[idx];

    // fee can be 0
    const expUserBalDiff = expectedPrice + stakeFee + protocolFee;

    // check user balance
    expect(userBalanceBefore - userBalanceAfter).to.eq(expUserBalDiff);
    // check parent balance
    expect(parentBalanceAfter - parentBalanceBefore).to.eq(expParentBalDiff);
    // check treasury stakes
    expect(treasuryBalanceAfter - treasuryBalanceBefore).to.eq(expTreasuryBalDiff);
    // check zero vault exempt fees
    expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(protocolFee);

    const dataFromReg = await zns.registry.getDomainRecord(domainHash);
    expect(dataFromReg.owner).to.eq(user.address);
    expect(dataFromReg.resolver).to.eq(await zns.addressResolver.getAddress());

    const tokenId = BigInt(domainHash).toString();
    const tokenOwner = await zns.domainToken.ownerOf(tokenId);
    expect(tokenOwner).to.eq(user.address);

    const domainAddress = await zns.addressResolver.resolveDomainAddress(domainHash);
    expect(domainAddress).to.eq(user.address);

    const events = await getDomainRegisteredEvents({
      zns,
      registrant: user.address,
    });
    expect(events[events.length - 1].args?.parentHash).to.eq(parentHashFound);
    expect(events[events.length - 1].args?.domainHash).to.eq(domainHash);
    expect(events[events.length - 1].args?.tokenId).to.eq(tokenId);
    expect(events[events.length - 1].args?.label).to.eq(domainLabel);
    expect(events[events.length - 1].args?.domainAddress).to.eq(user.address);
  }, Promise.resolve()
);
