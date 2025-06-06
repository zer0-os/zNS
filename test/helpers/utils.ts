/* eslint-disable @typescript-eslint/no-empty-function */
import { ethers, upgrades } from "hardhat";
import {
  AccessType,
  DEFAULT_CURVE_PRICE_CONFIG_BYTES,
  DEFAULT_FIXED_PRICER_CONFIG_BYTES,
  distrConfigEmpty,
  implSlotErc1967,
  paymentConfigEmpty,
  PaymentType,
} from "./constants";
import {
  CreateConfigArgs,
  IDistributionConfig,
  IDomainConfigForTest,
  IFullDistributionConfig,
  IPaymentConfig,
  IZNSContractsLocal,
} from "./types";
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

const createConfig = async (
  zns : IZNSContractsLocal,
  args : CreateConfigArgs
) : Promise<IDomainConfigForTest> => {
  let distrConfigToUse : IDistributionConfig;
  let paymentConfigToUse : IPaymentConfig;

  if (args.distrConfig) {
    // Option variables are only used only if not specified specified
    const paymentTypeOption = Math.random() < 0.5 ? PaymentType.DIRECT : PaymentType.STAKE;

    let accessTypeOption;
    const accessTypeSwitch = Math.random();

    if (accessTypeSwitch < 0.3333) {
      accessTypeOption = AccessType.OPEN;
    } else if (accessTypeSwitch < 0.6666) {
      accessTypeOption = AccessType.LOCKED;
    } else {
      accessTypeOption = AccessType.MINTLIST;
    }

    distrConfigToUse = {
      pricerContract: args.distrConfig.pricerContract ? args.distrConfig.pricerContract : zns.curvePricer.target,
      priceConfig: args.distrConfig.priceConfig ? args.distrConfig.priceConfig : DEFAULT_CURVE_PRICE_CONFIG_BYTES,
      paymentType: args.distrConfig.paymentType ? args.distrConfig.paymentType : paymentTypeOption,
      accessType: args.distrConfig.accessType ? args.distrConfig.accessType : accessTypeOption,
    };

    // Be sure we always set the contract and config to be the matching pair
    if (
      (
        distrConfigToUse.pricerContract === zns.curvePricer.target
        && distrConfigToUse.priceConfig.length !== DEFAULT_CURVE_PRICE_CONFIG_BYTES.length
      ) || (
        distrConfigToUse.pricerContract === zns.fixedPricer.target
        && distrConfigToUse.priceConfig.length !== DEFAULT_FIXED_PRICER_CONFIG_BYTES.length
      )
    ) {
      throw Error("Mismatch in distribution config: price config given does not match the price contract");
    }
  } else {
    distrConfigToUse = distrConfigEmpty;
  }

  if (args.paymentConfig) {
    paymentConfigToUse = {
      token: args.paymentConfig.token ? args.paymentConfig.token : await zns.meowToken.getAddress(),
      beneficiary: args.paymentConfig.beneficiary ? args.paymentConfig.beneficiary : args.user.address,
    };
  } else {
    // Only set default payment config  if distrConfig is not empty
    if (distrConfigToUse !== distrConfigEmpty) {
      paymentConfigToUse = {
        token: await zns.meowToken.getAddress(),
        beneficiary: args.user.address,
      };
    } else {
      paymentConfigToUse = paymentConfigEmpty;
    }
  }

  const createdConfig : IDomainConfigForTest = {
    user: args.user,
    domainLabel: args.domainLabel as string, // we know it is set at this point
    tokenOwner: args.user.address,
    parentHash: args.parentHash ?? ethers.ZeroHash,
    fullConfig: {
      distrConfig: distrConfigToUse,
      paymentConfig: paymentConfigToUse,
    },
  };

  return createdConfig;
};

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
  ) : Promise<IDomainConfigForTest> {
    return createConfig(
      this.zns,
      args
    );
  }

  async createConfigs (
    args : Array<CreateConfigArgs>
  ) : Promise<Array<IDomainConfigForTest>> {
    const configs = [];

    for (const arg of args) {
      // For variance in length, if one is not specified
      // we create a random one of a random length
      if (!arg.domainLabel) {
        arg.domainLabel = await this.createLabel(Math.floor(Math.random() * 16) + 1);
      }

      configs.push(await createConfig(
        this.zns,
        arg
        // user,
        // arg.tokenOwner ?? arg.user.address,
        // arg.domainLabel ?? this.createLabel(),
        // arg.parentHash ?? this.hre.ethers.ZeroHash,
        // arg.distrConfig,
        // arg.paymentConfig
      ));
    }

    return configs;
  }

  async getDefaultFullConfigFixed (user : SignerWithAddress){
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
    };
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
  async createLabel (
    length ?: number
  ) : Promise<string> {
    let result = "";
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";

    // If no length specified use 16 as a default
    for (let i = 0; i < (length ?? 16); i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    if (await this.zns.registry.exists(result)) {
      // If the label already exists, recursively call to create a new one
      return this.createLabel(length);
    }

    return result;
  }
}
