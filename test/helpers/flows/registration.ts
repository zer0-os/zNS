import { IDomainConfigForTest, ZNSContracts, IPathRegResult } from "../types";
import { registrationWithSetup } from "../register-setup";
import { BigNumber, ethers } from "ethers";
import { getPriceObject, getStakingOrProtocolFee } from "../pricing";
import { expect } from "chai";
import { getDomainRegisteredEvents } from "../events";
import { IERC20__factory } from "../../../typechain";
import { PaymentType } from "../constants";


// TODO sub: make these messy helpers better or no one will be able to maintain this
export const registerDomainPath = async ({
  zns,
  domainConfigs,
} : {
  zns : ZNSContracts;
  domainConfigs : Array<IDomainConfigForTest>;
}) => domainConfigs.reduce(
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
        : ethers.constants.HashZero;
    }

    const isRootDomain = parentHash === ethers.constants.HashZero;

    // and get the necessary contracts based on parent config
    let paymentTokenContract;
    let beneficiary;

    if (isRootDomain) {
      paymentTokenContract = zns.zeroToken;
      // no beneficiary for root domain
      beneficiary = ethers.constants.AddressZero;
    } else {
      // grab all the important data of the parent
      const paymentConfig = await zns.treasury.paymentConfigs(parentHash);
      const { token: paymentTokenAddress } = paymentConfig;
      ({ beneficiary } = paymentConfig);

      if (paymentTokenAddress === zns.zeroToken.address) {
        paymentTokenContract = zns.zeroToken;
      } else {
        const ierc20 = IERC20__factory.connect(paymentTokenAddress, config.user);
        paymentTokenContract = ierc20.attach(paymentTokenAddress);
      }
    }

    const parentBalanceBefore = isRootDomain
      ? BigNumber.from(0)
      : await paymentTokenContract.balanceOf(beneficiary);
    const userBalanceBefore = await paymentTokenContract.balanceOf(config.user.address);
    const treasuryBalanceBefore = await paymentTokenContract.balanceOf(zns.treasury.address);
    const zeroVaultBalanceBefore = await paymentTokenContract.balanceOf(zns.zeroVaultAddress);

    const domainHash = await registrationWithSetup({
      zns,
      parentHash,
      isRootDomain,
      ...config,
    });

    const parentBalanceAfter = isRootDomain
      ? BigNumber.from(0)
      : await paymentTokenContract.balanceOf(beneficiary);
    const userBalanceAfter = await paymentTokenContract.balanceOf(config.user.address);
    const treasuryBalanceAfter = await paymentTokenContract.balanceOf(zns.treasury.address);
    const zeroVaultBalanceAfter = await paymentTokenContract.balanceOf(zns.zeroVaultAddress);

    const domainObj = {
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
  zns : ZNSContracts;
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

    let expectedPrice : BigNumber;
    let stakeFee = BigNumber.from(0);

    // calc only needed for asymptotic pricing, otherwise it is fixed
    let parentHashFound = parentHash;
    if (!parentHashFound) {
      parentHashFound = !!regResults[idx - 1] ? regResults[idx - 1].domainHash : ethers.constants.HashZero;
    }

    const {
      maxPrice: oracleMaxPrice,
      minPrice: oracleMinPrice,
      maxLength: oracleMaxLength,
      baseLength: oracleBaseLength,
      precisionMultiplier: oraclePrecisionMultiplier,
      feePercentage: oracleFeePercentage,
    } = await zns.priceOracle.priceConfigs(ethers.constants.HashZero);

    let expParentBalDiff;
    let expTreasuryBalDiff;
    let paymentType;
    if (parentHashFound === ethers.constants.HashZero) {
      ({
        expectedPrice,
      } = getPriceObject(
        domainLabel,
        {
          maxPrice: oracleMaxPrice,
          minPrice: oracleMinPrice,
          maxLength: oracleMaxLength,
          baseLength: oracleBaseLength,
          precisionMultiplier: oraclePrecisionMultiplier,
          feePercentage: oracleFeePercentage,
        },
      ));
      expParentBalDiff = BigNumber.from(0);
      expTreasuryBalDiff = expectedPrice;
    } else {
      const config = await zns.subdomainRegistrar.distrConfigs(parentHashFound);
      const {
        pricingContract,
      } = config;
      ({ paymentType } = config);

      if (pricingContract === zns.fixedPricing.address) {
        ({
          price: expectedPrice,
          fee: stakeFee,
        } = await zns.fixedPricing.getPriceAndFee(parentHashFound, domainLabel));
      } else {
        const {
          maxPrice,
          minPrice,
          maxLength,
          baseLength,
          precisionMultiplier,
          feePercentage,
        } = await zns.priceOracle.priceConfigs(parentHashFound);

        ({
          expectedPrice,
          stakeFee,
        } = getPriceObject(
          domainLabel,
          {
            maxPrice,
            minPrice,
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
        stakeFee = BigNumber.from(0);
        expParentBalDiff = expectedPrice;
      }

      expTreasuryBalDiff = paymentType === PaymentType.STAKE
        ? expectedPrice : BigNumber.from(0);
    }

    const protocolFee = getStakingOrProtocolFee(
      expectedPrice.add(stakeFee),
      oracleFeePercentage
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
    const expUserBalDiff = expectedPrice.add(stakeFee).add(protocolFee);

    // check user balance
    expect(userBalanceBefore.sub(userBalanceAfter)).to.eq(expUserBalDiff);
    // check parent balance
    expect(parentBalanceAfter.sub(parentBalanceBefore)).to.eq(expParentBalDiff);
    // check treasury stakes
    expect(treasuryBalanceAfter.sub(treasuryBalanceBefore)).to.eq(expTreasuryBalDiff);
    // check zero vault exempt fees
    expect(zeroVaultBalanceAfter.sub(zeroVaultBalanceBefore)).to.eq(protocolFee);

    const dataFromReg = await zns.registry.getDomainRecord(domainHash);
    expect(dataFromReg.owner).to.eq(user.address);
    expect(dataFromReg.resolver).to.eq(zns.addressResolver.address);

    const tokenId = BigNumber.from(domainHash).toString();
    const tokenOwner = await zns.domainToken.ownerOf(tokenId);
    expect(tokenOwner).to.eq(user.address);

    const domainAddress = await zns.addressResolver.getAddress(domainHash);
    expect(domainAddress).to.eq(user.address);

    const events = await getDomainRegisteredEvents({
      zns,
      registrant: user.address,
    });
    expect(events[events.length - 1].args?.parentHash).to.eq(parentHashFound);
    expect(events[events.length - 1].args?.domainHash).to.eq(domainHash);
    expect(events[events.length - 1].args?.tokenId).to.eq(tokenId);
    expect(events[events.length - 1].args?.name).to.eq(domainLabel);
    expect(events[events.length - 1].args?.domainAddress).to.eq(user.address);
  }, Promise.resolve()
);
