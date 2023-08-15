import { IDomainConfigForTest, ZNSContracts, IPathRegResult } from "../types";
import { registrationWithSetup } from "../register-setup";
import { BigNumber, ethers } from "ethers";
import { getPriceObject } from "../pricing";
import { expect } from "chai";
import { getDomainRegisteredEvents } from "../events";
import { IERC20__factory } from "../../../typechain";


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
    let paymentContract;
    let beneficiary;

    if (isRootDomain) {
      paymentTokenContract = zns.zeroToken;
      beneficiary = zns.zeroVaultAddress;
    } else {
      // grab all the important contracts of the parent
      const {
        paymentContract: paymentContractAddress,
      } = await zns.subdomainRegistrar.distrConfigs(parentHash);
      paymentContract = paymentContractAddress === zns.directPayment.address
        ? zns.directPayment
        : zns.stakePayment;

      const paymentConfig = await paymentContract.getPaymentConfig(parentHash);
      const { paymentToken: paymentTokenAddress } = paymentConfig;
      ({ beneficiary } = paymentConfig);

      if (paymentTokenAddress === zns.zeroToken.address) {
        paymentTokenContract = zns.zeroToken;
      } else {
        const ierc20 = IERC20__factory.connect(paymentTokenAddress, config.user);
        paymentTokenContract = ierc20.attach(paymentTokenAddress);
      }
    }

    const parentBalanceBefore = await paymentTokenContract.balanceOf(beneficiary);
    const userBalanceBefore = await paymentTokenContract.balanceOf(config.user.address);

    const domainHash = await registrationWithSetup({
      zns,
      parentHash,
      isRootDomain,
      ...config,
    });

    const parentBalanceAfter = await paymentTokenContract.balanceOf(beneficiary);
    const userBalanceAfter = await paymentTokenContract.balanceOf(config.user.address);

    const domainObj = {
      domainHash,
      userBalanceBefore,
      userBalanceAfter,
      parentBalanceBefore,
      parentBalanceAfter,
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
    let fee = BigNumber.from(0);

    // calc only needed for asymptotic pricing, otherwise it is fixed
    let parentHashFound = parentHash;
    if (!parentHashFound) {
      parentHashFound = !!regResults[idx - 1] ? regResults[idx - 1].domainHash : ethers.constants.HashZero;
    }

    let pricingContract;
    let paymentContract;

    if (parentHashFound === ethers.constants.HashZero) {
      pricingContract = zns.priceOracle.address;
      paymentContract = zns.treasury.address;
    } else {
      ({
        pricingContract,
        paymentContract,
      } = await zns.subdomainRegistrar.distrConfigs(parentHashFound));
    }

    if (pricingContract === zns.fixedPricing.address) {
      expectedPrice = await zns.fixedPricing.getPrice(parentHashFound, domainLabel);
    } else {
      const configCall = pricingContract === zns.priceOracle.address
        ? zns.priceOracle.rootDomainPriceConfig()
        : zns.asPricing.priceConfigs(parentHashFound);

      const {
        maxPrice,
        minPrice,
        maxLength,
        baseLength,
        precisionMultiplier,
        feePercentage,
      } = await configCall;

      ({
        expectedPrice,
        fee,
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

    const {
      domainHash,
      userBalanceBefore,
      userBalanceAfter,
      parentBalanceBefore,
      parentBalanceAfter,
    } = regResults[idx];

    // if parent's payment contract is staking, then beneficiary only gets the fee
    const expParentBalDiff = paymentContract === zns.stakePayment.address
    || paymentContract === zns.treasury.address
      ? fee
      : expectedPrice.add(fee);

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

    const events = await getDomainRegisteredEvents({
      zns,
      registrant: user.address,
    });
    expect(events[events.length - 1].args?.parentHash).to.eq(parentHashFound);
    expect(events[events.length - 1].args?.domainHash).to.eq(domainHash);
    expect(events[events.length - 1].args?.tokenId).to.eq(tokenId);
    expect(events[events.length - 1].args?.name).to.eq(domainLabel);
    expect(events[events.length - 1].args?.resolver).to.eq(zns.addressResolver.address);
    expect(events[events.length - 1].args?.domainAddress).to.eq(user.address);
  }, Promise.resolve()
);
