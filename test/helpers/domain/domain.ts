import * as hre from "hardhat";
import { IZNSContracts } from "../../../src/deploy/campaign/types";
import { IFullDomainConfig } from "./types";
import { IDistributionConfig, IPaymentConfig } from "../types";
import {
  ICurvePriceConfig,
  IFixedPriceConfig,
} from "../../../src/deploy/missions/types";
import { curvePriceConfigEmpty, distrConfigEmpty, fixedPriceConfigEmpty, paymentConfigEmpty } from "../constants";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { fundApprove } from "../register-setup";
import { ContractTransactionResponse } from "ethers";
import { expect } from "chai";
import { encodePriceConfig } from "../pricing";


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
  priceConfig : ICurvePriceConfig | IFixedPriceConfig;
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
    this.tokenOwner = domainConfig.tokenOwner || hre.ethers.ZeroAddress;
    this.distrConfig = domainConfig.distrConfig || distrConfigEmpty;

    if (!domainConfig.priceConfig) {
      switch (this.distrConfig.pricerContract) {
      case zns.curvePricer.target:
        this.priceConfig = curvePriceConfigEmpty;
        break;
      case zns.fixedPricer.target:
        this.priceConfig = fixedPriceConfigEmpty;
        break;
      default:
        this.priceConfig = {} as ICurvePriceConfig | IFixedPriceConfig;
      }
    } else {
      this.priceConfig = domainConfig.priceConfig;
    }

    this.paymentConfig = domainConfig.paymentConfig || paymentConfigEmpty;
    this.domainAddress = domainConfig.domainAddress || this.owner.address;
    this.tokenURI = domainConfig.tokenURI || "https://example.com/token-uri";

    this.hash = "";
  }

  get tokenId () : bigint {
    return BigInt(this.hash);
  }

  async ownerOfHash () : Promise<string> {
    return this.zns.registry.getDomainOwner(this.hash);
  }

  async ownerOfToken () : Promise<string> {
    return this.zns.domainToken.ownerOf(this.tokenId);
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
    return (fundApprove({
      zns: this.zns,
      parentHash: this.parentHash,
      user: user ? user : this.owner,
      domainLabel: this.label,
    }));
  }

  async register (executor ?: SignerWithAddress) : Promise<ContractTransactionResponse> {
    const {
      zns,
      owner,
      label,
      parentHash,
      distrConfig,
      paymentConfig,
      tokenURI,
      tokenOwner,
      domainAddress,
    } = this;

    const signer = !executor ? owner : executor;

    if (!distrConfig.priceConfig) {
      distrConfig.priceConfig = encodePriceConfig(this.priceConfig);
    }

    let txPromise : ContractTransactionResponse;

    // mint and approve strict amount of tokens for domain registration
    await this.mintAndApproveForDomain(signer);

    if (this.isRoot) {
      txPromise = await zns.rootRegistrar.connect(signer).registerRootDomain({
        name: label,
        domainAddress: hre.ethers.isAddress(domainAddress) ? domainAddress : owner.address,
        tokenOwner,
        tokenURI,
        distrConfig,
        paymentConfig,
      });
    } else {
      txPromise = await zns.subRegistrar.connect(signer).registerSubdomain({
        parentHash,
        label,
        domainAddress: hre.ethers.isAddress(domainAddress) ? domainAddress : owner.address,
        tokenOwner,
        tokenURI,
        distrConfig,
        paymentConfig,
      });
    }

    this.hash = await this.getDomainHashFromEvent(signer);

    return txPromise;
  }

  async revoke (executor ?: SignerWithAddress) : Promise<ContractTransactionResponse> {
    return this.zns.rootRegistrar.connect(executor ? executor : this.owner).revokeDomain(this.hash);
  }

  async assignDomainToken (
    to : string,
    executor ?: SignerWithAddress
  ) : Promise<ContractTransactionResponse> {
    return this.zns.rootRegistrar.connect(executor ? executor : this.owner).assignDomainToken(
      this.hash,
      to
    );
  }

  async updateDomainRecord (
    resolverType : string,
    executor ?: SignerWithAddress
  ) : Promise<ContractTransactionResponse> {
    return this.zns.registry.connect(executor ? executor : this.owner).updateDomainRecord(
      this.hash,
      this.owner,
      resolverType,
    );
  }

  async updateMintlistForDomain (
    candidates : Array<string>,
    allowed : Array<boolean>,
    executor ?: SignerWithAddress
  ) : Promise<ContractTransactionResponse> {
    if (candidates.length !== allowed.length)
      throw new Error("Domain Helper: Candidates and allowed arrays must have the same length");

    return this.zns.subRegistrar.connect(executor ? executor : this.owner).updateMintlistForDomain(
      this.hash,
      candidates,
      allowed,
    );
  }

  // ------------------------------------------------------
  // GETTERS
  // ------------------------------------------------------
  async getDomainRecord () : Promise<{
    owner : string;
    resolver : string;
  }> {
    return this.zns.registry.getDomainRecord(this.hash);
  }

  async getPaymentConfig () : Promise<IPaymentConfig> {
    return this.zns.treasury.paymentConfigs(this.hash);
  }

  // ------------------------------------------------------
  // SETTERS
  // ------------------------------------------------------
  async setOwnersOperator (
    operator : string,
    allowed : boolean,
    executor ?: SignerWithAddress
  ) : Promise<ContractTransactionResponse> {
    return this.zns.registry.connect(executor ? executor : this.owner).setOwnersOperator(operator, allowed);
  }

  async setDistributionConfigForDomain (
    executor ?: SignerWithAddress
  ) : Promise<ContractTransactionResponse> {
    return this.zns.subRegistrar.connect(executor ? executor : this.owner).setDistributionConfigForDomain(
      this.hash,
      this.distrConfig,
    );
  }

  async setPricerDataForDomain (
    priceConfig ?: ICurvePriceConfig | IFixedPriceConfig,
    pricerContract ?: string,
    executor ?: SignerWithAddress
  ) : Promise<ContractTransactionResponse> {
    return this.zns.subRegistrar.connect(executor ? executor : this.owner).setPricerDataForDomain(
      this.hash,
      priceConfig ? encodePriceConfig(priceConfig) : encodePriceConfig(this.priceConfig),
      pricerContract ? pricerContract : this.distrConfig.pricerContract
    );
  }

  async setPaymentTypeForDomain (
    paymentType : bigint,
    executor ?: SignerWithAddress
  ) : Promise<ContractTransactionResponse> {
    return this.zns.subRegistrar.connect(executor ? executor : this.owner).setPaymentTypeForDomain(
      this.hash,
      paymentType,
    );
  }

  async setAccessTypeForDomain (
    accessType : bigint,
    executor ?: SignerWithAddress
  ) : Promise<ContractTransactionResponse> {
    return this.zns.subRegistrar.connect(executor ? executor : this.owner).setAccessTypeForDomain(
      this.hash,
      accessType,
    );
  }

  async setPaymentTokenForDomain (
    tokenAddress : string,
    executor ?: SignerWithAddress
  ) : Promise<ContractTransactionResponse> {
    if (!hre.ethers.isAddress(tokenAddress)) {
      throw new Error("Domain Helper: Invalid token address provided");
    }

    return this.zns.treasury.connect(executor ? executor : this.owner).setPaymentToken(
      this.hash,
      tokenAddress
    );
  }

  // ------------------------------------------------------
  // VALIDATION
  // ------------------------------------------------------
  async validate (
    txPromise : ContractTransactionResponse,
    executor ?: SignerWithAddress
  ) {
    // check domain existence with event
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
        executor ? executor.address : this.owner.address,
        executor ? executor.address : this.owner.address,
        this.domainAddress
      );

    // check domain existence with registry
    const record = await this.zns.registry.getDomainRecord(this.hash);
    const resolverAddress = await this.zns.registry.getDomainResolver(this.hash);

    expect(
      await this.zns.registry.getDomainOwner(this.hash)
    ).to.equal(executor ? executor.address : this.owner.address);
    expect(record.owner).to.equal(executor ? executor.address : this.owner.address);
    expect(record.resolver).to.equal(resolverAddress);

    expect(
      await this.zns.domainToken.tokenURI(this.hash)
    ).to.equal(this.tokenURI);
  }

  async registerAndValidateDomain (
    executor ?: SignerWithAddress
  ) : Promise<void> {
    const txPromise = await this.register(executor ? executor : this.owner);

    await this.validate(txPromise, executor);
  }
}
