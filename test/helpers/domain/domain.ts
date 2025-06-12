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
import { hashDomainLabel } from "../hashing";
import { expect } from "chai";


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
  domainAddress : string;
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
    this.domainAddress = domainConfig.domainAddress || this.owner.address;
    this.tokenURI = domainConfig.tokenURI || "https://example.com/token-uri";

    this.hash = "";
  }

  async getDomainHashFromEvent (domainOwner ?: SignerWithAddress) : Promise<string> {
    const latestBlock = await time.latestBlock();
    const filter = this.zns.rootRegistrar.filters.DomainRegistered(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      domainOwner ? domainOwner : this.owner.address,
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

  async register (executor ?: SignerWithAddress) : Promise<ContractTransactionResponse> {
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
      domainAddress,
    } = this;

    let txPromise : ContractTransactionResponse;

    // mint and approve strict amount of tokens for domain registration
    await this.mintAndApproveForDomain(executor);

    if (this.isRoot) {
      txPromise = await zns.rootRegistrar.connect(executor ? executor : owner).registerRootDomain({
        name: label,
        domainAddress: hre.ethers.isAddress(domainAddress) ? domainAddress : owner.address,
        tokenOwner,
        tokenURI,
        distrConfig,
        paymentConfig,
        priceConfig,
      });
    } else {
      txPromise = await zns.subRegistrar.connect(executor ? executor : owner).registerSubdomain({
        parentHash,
        label,
        domainAddress: hre.ethers.isAddress(domainAddress) ? domainAddress : owner.address,
        tokenOwner,
        tokenURI,
        distrConfig,
        paymentConfig,
        priceConfig,
      });
    }

    this.hash = await this.getDomainHashFromEvent(executor);

    return txPromise;
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
    await this.zns.registry.connect(executor ? executor : this.owner).updateDomainRecord(
      this.hash,
      this.owner,
      resolverType,
    );
  }

  async updateMintlistForDomain (
    candidates : Array<string>,
    allowed : Array<boolean>,
    executor ?: SignerWithAddress
  ) : Promise<void> {
    if (candidates.length !== allowed.length)
      throw new Error("Domain Helper: Candidates and allowed arrays must have the same length");

    await this.zns.subRegistrar.connect(executor ? executor : this.owner).updateMintlistForDomain(
      this.hash,
      candidates ? candidates : [this.owner.address],
      allowed ? allowed : [true],
    );
  }

  async setDistributionConfigForDomain (
    executor ?: SignerWithAddress
  ) : Promise<void> {
    await this.zns.subRegistrar.connect(executor ? executor : this.owner).setDistributionConfigForDomain(
      this.hash,
      this.distrConfig,
    );
  }

  async setPricerDataForDomain (
    executor ?: SignerWithAddress
  ) : Promise<void> {
    await this.zns.subRegistrar.connect(executor ? executor : this.owner).setPricerDataForDomain(
      this.hash,
      this.priceConfig,
      this.distrConfig.pricerContract
    );
  }

  async setPaymentTypeForDomain (
    paymentType : bigint,
    executor ?: SignerWithAddress
  ) : Promise<void> {
    await this.zns.subRegistrar.connect(executor ? executor : this.owner).setPaymentTypeForDomain(
      this.hash,
      paymentType,
    );
  }

  async setAccessTypeForDomain (
    accessType : bigint,
    executor ?: SignerWithAddress
  ) : Promise<void> {
    await this.zns.subRegistrar.connect(executor ? executor : this.owner).setAccessTypeForDomain(
      this.hash,
      accessType,
    );
  }

  async setOwnersOperator (
    operator : string,
    allowed : boolean,
    executor ?: SignerWithAddress
  ) : Promise<void> {
    await this.zns.registry.connect(executor ? executor : this.owner).setOwnersOperator(
      operator,
      allowed
    );
  }

  async getResolverAddressByLabel (label : string) : Promise<string> {
    const hash = hashDomainLabel(label);
    return this.zns.registry.getDomainResolver(hash);
  }

  // ------------------------------------------------------
  // VALIDATION
  // ------------------------------------------------------
  async validateDomainHash (expectedHash : string) : Promise<void> {

  }

  async registerAndValidateDomain (
    executor ?: SignerWithAddress
  ) : Promise<void> {
  // mint and approve strict amount of tokens for domain registration
    await this.mintAndApproveForDomain(executor);

    const txPromise = await this.register(executor);

    await expect(txPromise)
      .to.emit(
        this.zns.rootRegistrar,
        "DomainRegistered"
      ).withArgs(
        this.parentHash,
        this.hash,
        this.label,
        BigInt(this.hash),
        this.tokenURI,
        this.owner,
        executor ? executor.address : this.owner.address,
        this.domainAddress
      );

    const record = await this.zns.registry.getDomainRecord(this.hash);
    const resolverAddress = await this.getResolverAddressByLabel(this.label);
    expect(record.owner).to.equal(this.owner);
    expect(record.resolver).to.equal(resolverAddress);
  }
}
