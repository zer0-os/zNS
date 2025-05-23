/* eslint-disable @typescript-eslint/no-empty-function */
import { ethers, upgrades } from "hardhat";
import { AccessType, DEFAULT_CURVE_PRICE_CONFIG, DEFAULT_CURVE_PRICE_CONFIG_BYTES, DEFAULT_FIXED_PRICER_CONFIG_BYTES, distrConfigEmpty, implSlotErc1967, paymentConfigEmpty, PaymentType } from "./constants";
import { IDistributionConfig, IDomainConfigForTest, IFullDistributionConfig, IPaymentConfig, IZNSContractsLocal } from "./types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export const getProxyImplAddress = async (proxyAddress : string) => {
  let impl;
  try {
    impl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  } catch (e) {
    const padded = await ethers.provider.getStorage(proxyAddress, implSlotErc1967);
    impl = ethers.toBeHex(ethers.stripZerosLeft(padded));
  }

  return impl;
};

export const loggerMock = {
  ...console,
  log: () => {},
  info: () => {},
  debug: () => {},
};

export const getRandomString = (length : number) => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    result += alphabet.charAt(randomIndex);
  }

  return result;
};

const _createConfig = async (
  zns : IZNSContractsLocal,
  user : SignerWithAddress,
  domainLabel : string,
  parentHash ?: string,
  distrConfig ?: Partial<IDistributionConfig>,
  paymentConfig ?: Partial<IPaymentConfig>
) : Promise<IDomainConfigForTest> => {

  let distrConfigToUse : IDistributionConfig;
  let paymentConfigToUse : IPaymentConfig;

  if (distrConfig) {
    distrConfigToUse = {
      pricerContract: distrConfig.pricerContract ? distrConfig.pricerContract : await zns.curvePricer.getAddress(),
      priceConfig: distrConfig.priceConfig ? distrConfig.priceConfig : DEFAULT_CURVE_PRICE_CONFIG_BYTES,
      paymentType: distrConfig.paymentType ? distrConfig.paymentType : PaymentType.DIRECT,
      accessType: distrConfig.accessType ? distrConfig.accessType : AccessType.OPEN,
    };
  } else {
    distrConfigToUse = distrConfigEmpty;
  }

  if (paymentConfig) {
    paymentConfigToUse = {
      token: paymentConfig.token ? paymentConfig.token : await zns.meowToken.getAddress(),
      beneficiary: paymentConfig.beneficiary ? paymentConfig.beneficiary : user.address,
    };
  } else {
    // Only set default payment config  if distrConfig is not empty
    if (distrConfigToUse != distrConfigEmpty) {
      paymentConfigToUse = {
        token: await zns.meowToken.getAddress(),
        beneficiary: user.address,
      };
    } else {
      paymentConfigToUse = paymentConfigEmpty;
    }
  }

  const createdConfig : IDomainConfigForTest = {
    user,
    domainLabel,
    parentHash: parentHash ?? ethers.ZeroHash,
    fullConfig: {
      distrConfig: distrConfigToUse,
      paymentConfig: paymentConfigToUse,
    },
  };

  return createdConfig;
};

interface CreateConfigArgs {
  user : SignerWithAddress;
  domainLabel ?: string;
  parentHash ?: string;
  distrConfig ?: Partial<IDistributionConfig>;
  paymentConfig ?: Partial<IPaymentConfig>;
}

export class Utils {
  hre : HardhatRuntimeEnvironment;
  zns : IZNSContractsLocal;

  constructor (
    hre : HardhatRuntimeEnvironment,
    zns : IZNSContractsLocal
  ) {
    this.hre = hre;
    this.zns = zns;
  }

  // Create a domain config for testing
  async createConfig (
    args : CreateConfigArgs
  ) : Promise<IDomainConfigForTest>  {
    return await _createConfig(
      this.zns,
      args.user,
      args.domainLabel ?? this.createLabel(),
      args.parentHash ?? this.hre.ethers.ZeroHash,
      args.distrConfig,
      args.paymentConfig
    );
  }

  async getDefaultFullConfigFixed (user : SignerWithAddress) {
    return {
      distrConfig: {
        pricerContract: this.zns.fixedPricer.target,
        priceConfig: DEFAULT_FIXED_PRICER_CONFIG_BYTES,
        paymentType: PaymentType.DIRECT,
        accessType: AccessType.OPEN,
      },
      paymentConfig: {
        token: this.zns.meowToken.target,
        beneficiary: user.address,
      },
    } as IFullDistributionConfig;
  }

  async getDefaultFullConfigCurve (user : SignerWithAddress) {
    return {
      distrConfig: {
        pricerContract: this.zns.curvePricer.target,
        priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
        paymentType: PaymentType.DIRECT,
        accessType: AccessType.OPEN,
      },
      paymentConfig: {
        token: this.zns.meowToken.target,
        beneficiary: user.address,
      },
    } as IFullDistributionConfig;
  }

  // Create a random label of default length 10
  // Specify a length to override this value
  createLabel (
    length ?: number
  ) {
    let result = "";
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";

    // If no length specified use 10 as a default
    for (let i = 0; i < (length ?? 10); i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
  }
}
