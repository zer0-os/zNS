import { IASPriceConfig, IFullDistributionConfig, IDomainConfigForTest, ZNSContracts, ITreeRegResult } from "../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { registrationWithSetup } from "../register-setup";
import { priceConfigDefault } from "../constants";
import { BigNumber, ethers } from "ethers";
import assert from "assert";


export const registerDomainPath = async ({
  zns,
  domainConfigs,
} : {
  zns : ZNSContracts;
  domainConfigs : Array<IDomainConfigForTest>;
}) => domainConfigs.reduce(
  async (
    acc : Promise<Array<ITreeRegResult>>,
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
