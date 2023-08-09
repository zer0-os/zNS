import { IDomainConfigForTest, ZNSContracts, IPathRegResult, IASPriceConfig } from "../types";
import { registrationWithSetup } from "../register-setup";
import { BigNumber } from "ethers";
import assert from "assert";
import { getPriceObject } from "../pricing";
import { expect } from "chai";
import { priceConfigDefault } from "../constants";


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
    idx,
    configS
  ) => {
    const newAcc = await acc;
    const parentHash = !!newAcc[idx - 1] ? newAcc[idx - 1].domainHash : undefined;

    const isRootDomain = !parentHash;

    // determine the price based on the pricing contract in the config
    // and get the necessary contracts based on parent config
    let totalPrice;
    let price = BigNumber.from(0);
    let fee = BigNumber.from(0);
    let paymentTokenContract;
    let paymentContract;
    let pricingContract;
    let beneficiary;

    if (isRootDomain) {
      ({ totalPrice } = await zns.priceOracle.getPrice(config.domainLabel));
      paymentTokenContract = zns.zeroToken;
      paymentContract = zns.treasury;
      beneficiary = zns.zeroVaultAddress;
    } else {
      // grab all the important contracts from the config of parent
      ({
        paymentContract,
        pricingContract,
        paymentTokenContract,
      } = Object.values(zns).reduce(
        (accc, contract) => {
          if (contract.address === configS[idx - 1].fullConfig?.distrConfig?.pricingContract) {
            return { ...accc, pricingContract: contract };
          }

          if (contract.address === configS[idx - 1].fullConfig?.distrConfig?.paymentContract) {
            return { ...accc, paymentContract: contract };
          }

          if (contract.address === configS[idx - 1].fullConfig?.paymentConfig.paymentToken) {
            return { ...accc, paymentTokenContract: contract };
          }

          return accc;
        }, {}
      ));

      beneficiary = configS[idx - 1].fullConfig?.paymentConfig.beneficiary;

      assert.ok(pricingContract, `Pricing contract not found in config for ${config.domainLabel}`);

      if (await pricingContract.feeEnforced()) {
        ({ price, fee } = await pricingContract.getPriceAndFee(parentHash, config.domainLabel));
        totalPrice = price.add(fee);
      } else {
        totalPrice = await pricingContract.getPrice(parentHash, config.domainLabel);
      }
    }

    // approve the payment amount (price) set by the parent
    await paymentTokenContract.connect(config.user).approve(paymentContract.address, totalPrice);

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
    },
    idx,
    array
  ) => {
    await acc;

    let expectedPrice : BigNumber;
    let fee = BigNumber.from(0);

    // calc only needed for asymptotic pricing, otherwise it is fixed
    if (idx === 0 || array[idx - 1].fullConfig.distrConfig.pricingContract === zns.asPricing.address) {
      const priceConfig = !!array[idx - 1]
        ? array[idx - 1].fullConfig.priceConfig as IASPriceConfig
        : priceConfigDefault;

      ({
        expectedPrice,
        fee,
      } = getPriceObject(
        domainLabel,
        priceConfig,
      ));
    } else {
      expectedPrice = array[idx - 1].fullConfig?.priceConfig as BigNumber;
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
