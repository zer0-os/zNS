import * as hre from "hardhat";
import { IZNSContracts } from "../../../src/deploy/campaign/types";
import { IFullDomainConfig } from "./types";
import { IDistributionConfig, IPaymentConfig } from "../types";
import { CurvePriceConfig, FixedPriceConfig } from "../../../src/deploy/missions/types";
import { curvePriceConfigEmpty, distrConfigEmpty, fixedPriceConfigEmpty, paymentConfigEmpty } from "../constants";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { fundApprove } from "../register-setup";
import { ContractTransactionResponse } from "ethers";


export default class Domain {
  // TODO dom: need to make a class with a method for every possible feature of ZNS contracts
  zns : IZNSContracts;

  hash : string;

  isRoot : boolean;
  owner : SignerWithAddress;
  tokenOwner : string;
  label : string;
  parentHash : string;
  distrConfig : IDistributionConfig;
  priceConfig : CurvePriceConfig | FixedPriceConfig;
  paymentConfig : IPaymentConfig;
  domainContent : string;
  tokenURI : string;

  constructor ({
    zns,
    domainConfig,
  } : {
    zns : IZNSContracts;
    domainConfig : IFullDomainConfig;
  }) {
    this.zns = zns;

    this.owner = domainConfig.owner;
    this.parentHash = domainConfig.parentHash || hre.ethers.ZeroHash;
    this.isRoot = this.parentHash === hre.ethers.ZeroHash;
    this.label = domainConfig.label;
    this.distrConfig = domainConfig.distrConfig || distrConfigEmpty;
    this.tokenOwner = domainConfig.tokenOwner || hre.ethers.ZeroAddress;

    if (!domainConfig.priceConfig) {
      switch (this.distrConfig.pricerContract) {
      case zns.curvePricer.target:
        this.priceConfig = curvePriceConfigEmpty;
        break;
      case zns.fixedPricer.target:
        // TODO dom: fix this since with proper types casting is not needed
        this.priceConfig = fixedPriceConfigEmpty as FixedPriceConfig;
        break;
      default:
        this.priceConfig = {};
      }
    } else {
      this.priceConfig = domainConfig.priceConfig;
    }

    this.paymentConfig = domainConfig.paymentConfig || paymentConfigEmpty;
    this.domainContent = domainConfig.domainContent || this.owner.address;
    this.tokenURI = domainConfig.tokenURI || "https://example.com/token-uri";

    this.hash = "";
  }

  // to prevent writing the same if everywhere
  // TODO dom: needs to be checked
  private async validateHashBeforeCall<T> (call : (hash : string) => Promise<T>) : Promise<T> {
    if (this.hash === "") {
      throw new Error("Domain hash is not set. Please register the domain first.");
    }
    return call(this.hash);
  }

  async getDomainHashFromEvent () : Promise<string> {
    const latestBlock = await time.latestBlock();
    const filter = this.zns.rootRegistrar.filters.DomainRegistered(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      this.owner.address,
      this.tokenOwner === hre.ethers.ZeroAddress ? undefined : this.tokenOwner,
      undefined,
    );

    const events = await this.zns.rootRegistrar.queryFilter(filter, latestBlock - 2, latestBlock);
    const { args: { domainHash } } = events[events.length - 1];

    return domainHash;
  }

  async mintAndApproveForDomain (user ?: SignerWithAddress) : Promise<ContractTransactionResponse> {
    return fundApprove({
      zns: this.zns,
      parentHash: this.parentHash,
      user: user ? user : this.owner,
      domainLabel: this.label,
    });
  }

  async register (executor ?: SignerWithAddress) : Promise<string> {
    const {
      zns,
      owner,
      label,
      parentHash,
      distrConfig,
      priceConfig,
      paymentConfig,
      tokenURI,
      tokenOwner,
      domainContent,
    } = this;

    // mint and approve strict amount of tokens for domain registration
    await this.mintAndApproveForDomain(executor);

    if (this.isRoot) {
      await zns.rootRegistrar.connect(executor ? executor : owner).registerRootDomain({
        name: label,
        domainAddress: hre.ethers.isAddress(domainContent) ? domainContent : owner.address,
        tokenOwner,
        tokenURI,
        distrConfig,
        paymentConfig,
        priceConfig,
      });
    } else {
      await zns.subRegistrar.connect(executor ? executor : owner).registerSubdomain({
        parentHash,
        label,
        domainAddress: hre.ethers.isAddress(domainContent) ? domainContent : owner.address,
        tokenOwner,
        tokenURI,
        distrConfig,
        paymentConfig,
        priceConfig,
      });
    }

    this.hash = await this.getDomainHashFromEvent();

    return this.hash;
  }

  async revoke (executor ?: SignerWithAddress) : Promise<void> {
    await this.zns.rootRegistrar.connect(executor ? executor : this.owner).revokeDomain(this.hash);
  }

  async assignDomainToken (
    to : string,
    executor ?: SignerWithAddress
  ) : Promise<void> {
    await this.zns.rootRegistrar.connect(executor ? executor : this.owner).assignDomainToken(
      this.hash,
      to
    );
  }

  async setOperator (
    operator : string,
    allowed : boolean,
    executor ?: SignerWithAddress
  ) : Promise<void> {
    await this.zns.registry.connect(executor ? executor : this.owner).setOwnersOperator(operator, allowed);
  }

  async updateDomainRecord (
    resolverType : string,
    executor ?: SignerWithAddress
  ) : Promise<void> {
    await this.validateHashBeforeCall(async hash => {
      await this.zns.registry.connect(executor ? executor : this.owner).updateDomainRecord(
        this.hash,
        this.owner,
        resolverType,
      );
    });
  }

  async setDistributionConfigForDomain (
    distrConfig : IDistributionConfig,
    executor ?: SignerWithAddress
  ) : Promise<void> {
    await this.validateHashBeforeCall(async hash => {
      await this.zns.subRegistrar.connect(executor ? executor : this.owner).setDistributionConfigForDomain(
        this.hash,
        distrConfig,
      );
    });
  }

  async setPricerDataForDomain (
    priceConfig : CurvePriceConfig | FixedPriceConfig,
    pricerContract : string,
    executor ?: SignerWithAddress
  ) : Promise<void> {
    await this.validateHashBeforeCall(async hash => {
      await this.zns.subRegistrar.connect(executor ? executor : this.owner).setPricerDataForDomain(
        this.hash,
        priceConfig,
        pricerContract
      );
    });
  }

  async setPaymentTypeForDomain (
    paymentType : bigint,
    executor ?: SignerWithAddress
  ) : Promise<void> {
    await this.validateHashBeforeCall(async hash => {
      await this.zns.subRegistrar.connect(executor ? executor : this.owner).setPaymentTypeForDomain(
        this.hash,
        paymentType,
      );
    });
  }

  async setAccessTypeForDomain (
    accessType : bigint,
    executor ?: SignerWithAddress
  ) : Promise<void> {
    await this.validateHashBeforeCall(async hash => {
      await this.zns.subRegistrar.connect(executor ? executor : this.owner).setAccessTypeForDomain(
        this.hash,
        accessType,
      );
    });
  }

  async validateDomainExistence (ac) : Promise<void> {

    // TODO dom: 1. owner assinged, 2. token minted to correct owner
  }
}
