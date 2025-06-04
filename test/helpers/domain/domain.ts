import * as hre from "hardhat";
import { IZNSContracts } from "../../../src/deploy/campaign/types";
import { IFullDomainConfig } from "./types";
import { IDistributionConfig, IPaymentConfig } from "../types";
import { CurvePriceConfig, FixedPriceConfig } from "../../../src/deploy/missions/types";
import { curvePriceConfigEmpty, distrConfigEmpty, fixedPriceConfigEmpty, paymentConfigEmpty } from "../constants";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


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
    // TODO dom: convert to proper interfaces here when all props figured out
    zns : IZNSContracts;
    domainConfig : IFullDomainConfig;
  }) {
    this.zns = zns;

    this.owner = domainConfig.owner;
    this.parentHash = domainConfig.parentHash || hre.ethers.ZeroAddress;
    this.isRoot = this.parentHash === hre.ethers.ZeroAddress;
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

  async register () : Promise<string> {
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

    // TODO dom: (use logic from registerWithSetup):
    //  1. check if owner has enough funds, if not - mint token
    //  2. check if owner has approved enough funds to treasury, if not - approve

    if (this.isRoot) {
      await zns.rootRegistrar.connect(owner).registerRootDomain({
        name: label,
        domainAddress: hre.ethers.isAddress(domainContent) ? domainContent : owner.address,
        tokenOwner,
        tokenURI,
        distrConfig,
        paymentConfig,
        priceConfig,
      });
    } else {
      await zns.subRegistrar.connect(owner).registerSubdomain({
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

  async setOperator (operator : string, allowed : boolean) : Promise<void> {
    await this.zns.registry.connect(this.owner).setOwnersOperator(operator, allowed);
  }

  async updateDomainRecord (resolverType : string) : Promise<void> {
    if (this.hash === "") {
      throw new Error("Domain hash is not set. Please register the domain first.");
    }

    await this.zns.registry.connect(this.owner).updateDomainRecord(
      this.hash,
      this.owner,
      resolverType,
    );
  }

  async validateDomainExistence (ac) : Promise<void> {
    // TODO dom: 1. owner assinged, 2. token minted to correct owner
  }
}
