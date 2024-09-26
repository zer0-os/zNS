import * as hre from "hardhat";
import { getConfig } from "../../src/deploy/campaign/environments";
import { runZnsCampaign } from "../../src/deploy/zns-campaign";
import { IZNSCampaignConfig, IZNSContracts } from "../../src/deploy/campaign/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { registrationWithSetup } from "../helpers/register-setup";
import {
  AccessType,
  distrConfigEmpty,
  DISTRIBUTION_LOCKED_NOT_EXIST_ERR,
  fullDistrConfigEmpty, hashDomainLabel,
  NOT_AUTHORIZED_ERR,
  NOT_OWNER_OF_ERR,
} from "../helpers";
import { expect } from "chai";
import * as ethers from "ethers";
import { ZNSChainResolver, ZNSChainResolver__factory } from "../../typechain";


describe.only("MultiZNS", () => {
  let znsL1 : IZNSContracts;
  let znsL2 : IZNSContracts;

  let deployAdmin : SignerWithAddress;
  let registryMock : SignerWithAddress;

  let campaignConfig : IZNSCampaignConfig<SignerWithAddress>;

  const chainDomainLabel = "zchain";
  let chainDomainHash : string;
  let rootDomainL2Hash : string;

  let chainResolver : ZNSChainResolver;

  before(async () => {
    [ deployAdmin, registryMock ] = await hre.ethers.getSigners();

    campaignConfig = await getConfig({
      deployer: deployAdmin,
      zeroVaultAddress: deployAdmin.address,
      chainRootHash: ethers.ZeroHash,
    });

    const campaign = await runZnsCampaign({ config: campaignConfig });

    znsL1 = campaign.state.contracts;

    await znsL1.meowToken.mint(deployAdmin.address, 1000000000000000000000n);
    await znsL1.meowToken.connect(deployAdmin).approve(znsL1.treasury.target, ethers.MaxUint256);

    // TODO multi: add deploy mission for ChainResolver if decided to leave it!
    const chainResFact = new ZNSChainResolver__factory(deployAdmin);
    chainResolver = await hre.upgrades.deployProxy(
      chainResFact,
      [
        znsL1.accessController.target,
        znsL1.registry.target,
      ],
      {
        kind: "uups",
      }
    ) as unknown as ZNSChainResolver;
    await chainResolver.waitForDeployment();
  });

  describe("Bridging Single Chain Specific Domain", () => {
    it("should register a new root domain for a chain regularly", async () => {
      chainDomainHash = await registrationWithSetup({
        zns: znsL1,
        user: deployAdmin,
        domainLabel: chainDomainLabel,
        fullConfig: fullDistrConfigEmpty,
      });

      expect(chainDomainHash).to.equal(hashDomainLabel(chainDomainLabel));

      // should be LOCKED to not allow any subdomains on L1
      const { accessType } = await znsL1.subRegistrar.distrConfigs(chainDomainHash);
      expect(accessType).to.equal(0n);

      // set ChainResolver ?!?!?!
      const chainId = 1668201165n;
      const chainName = "ZChain";
      const znsRegistryOnChain = registryMock.address;
      const auxData = "ZChain Root Domain";

      await chainResolver.connect(deployAdmin).setChainData(
        chainDomainHash,
        chainId,
        chainName,
        znsRegistryOnChain,
        auxData
      );

      // transfer Domain Token to ZNSRegistry. It CAN NOT be transfered back! This is a final immutable operation!
      await znsL1.domainToken.connect(deployAdmin).transferFrom(
        deployAdmin.address,
        znsL1.registry.target,
        BigInt(chainDomainHash)
      );

      // [AS A LAST OPERATION] change owner to ZNSRegistry to signify that a domain is on another network
      await znsL1.registry.connect(deployAdmin).updateDomainOwner(chainDomainHash, znsL1.registry.target);

      // make sure no domain related functions are available to the domain creator now
      await expect(
        znsL1.registry.connect(deployAdmin).updateDomainOwner(
          chainDomainHash,
          deployAdmin.address
        )
      ).to.be.revertedWithCustomError(znsL1.registry, NOT_AUTHORIZED_ERR);

      await expect(
        znsL1.addressResolver.connect(deployAdmin).setAddress(
          chainDomainHash,
          deployAdmin.address
        )
      ).to.be.revertedWithCustomError(znsL1.registry, NOT_AUTHORIZED_ERR);

      await expect(
        znsL1.subRegistrar.connect(deployAdmin).setDistributionConfigForDomain(
          chainDomainHash,
          {
            ...distrConfigEmpty,
            accessType: AccessType.OPEN,
          }
        )
      ).to.be.revertedWithCustomError(znsL1.registry, NOT_AUTHORIZED_ERR);

      // can't Revoke or Reclaim domain
      await expect(
        znsL1.rootRegistrar.connect(deployAdmin).revokeDomain(chainDomainHash)
      ).to.be.revertedWithCustomError(znsL1.rootRegistrar, NOT_OWNER_OF_ERR);

      await expect(
        znsL1.rootRegistrar.connect(deployAdmin).reclaimDomain(chainDomainHash)
      ).to.be.revertedWithCustomError(znsL1.rootRegistrar, NOT_OWNER_OF_ERR);

      // make sure no one can register subdomains
      await expect(
        registrationWithSetup({
          zns: znsL1,
          user: deployAdmin,
          parentHash: chainDomainHash,
          domainLabel: "test",
          fullConfig: fullDistrConfigEmpty,
        })
      ).to.be.revertedWithCustomError(znsL1.subRegistrar, DISTRIBUTION_LOCKED_NOT_EXIST_ERR);

      const record = await znsL1.registry.getDomainRecord(chainDomainHash);
      expect(record.owner).to.equal(znsL1.registry.target);
      expect(record.resolver).to.equal(znsL1.addressResolver.target);

      // check resolver data
      const resolverData = await chainResolver.resolveChainDataStruct(chainDomainHash);
      expect(resolverData.chainId).to.equal(chainId);
      expect(resolverData.chainName).to.equal(chainName);
      expect(resolverData.znsRegistryOnChain).to.equal(znsRegistryOnChain);
      expect(resolverData.auxData).to.equal(auxData);
    });

    it("deploy ZNS L2", async () => {
      campaignConfig = {
        ...campaignConfig,
        chainRootHash: chainDomainHash,
      };
      const campaignL2 = await runZnsCampaign({ config: campaignConfig });

      znsL2 = campaignL2.state.contracts;

      await znsL2.meowToken.mint(deployAdmin.address, 1000000000000000000000n);
      await znsL2.meowToken.connect(deployAdmin).approve(znsL2.treasury.target, ethers.MaxUint256);
    });

    it("should set up ZNS L2 with proper domain as root", async () => {
      // check that the domain is properly set up
      const chainRootHash = await znsL2.registry.CHAIN_ROOT_HASH();
      expect(chainRootHash).to.equal(chainDomainHash);

      // check pricer setup
      const distrConfigFromL2 = await znsL2.curvePricer.priceConfigs(chainRootHash);
      expect(distrConfigFromL2.maxPrice).to.deep.equal(campaignConfig.rootPriceConfig.maxPrice);
      expect(distrConfigFromL2.minPrice).to.deep.equal(campaignConfig.rootPriceConfig.minPrice);
      expect(distrConfigFromL2.maxLength).to.equal(campaignConfig.rootPriceConfig.maxLength);
      expect(distrConfigFromL2.baseLength).to.equal(campaignConfig.rootPriceConfig.baseLength);
      expect(distrConfigFromL2.precisionMultiplier).to.equal(campaignConfig.rootPriceConfig.precisionMultiplier);
      expect(distrConfigFromL2.feePercentage).to.equal(campaignConfig.rootPriceConfig.feePercentage);
      expect(distrConfigFromL2.isSet).to.equal(true);

      // check treasury setup
      const paymentConfigFromL2 = await znsL2.treasury.paymentConfigs(chainRootHash);
      expect(paymentConfigFromL2.token).to.equal(znsL2.meowToken.target);
      expect(paymentConfigFromL2.beneficiary).to.equal(campaignConfig.zeroVaultAddress);
    });

    it("should register a new root domain on L2", async () => {
      const rootDomainL2Label = "wilderworld";
      rootDomainL2Hash = await registrationWithSetup({
        zns: znsL2,
        user: deployAdmin,
        domainLabel: rootDomainL2Label,
        // TODO multi: add a config here to check later in test
        fullConfig: fullDistrConfigEmpty,
      });

      // validate it hashed properly
      const chainRootHash = await znsL2.registry.CHAIN_ROOT_HASH();
      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "bytes32"],
        [chainRootHash, hashDomainLabel(rootDomainL2Label)]
      );
      const rootDomainHashRef = ethers.solidityPackedKeccak256(
        ["bytes"],
        [encoded]
      );

      expect(rootDomainL2Hash).to.equal(rootDomainHashRef);

      // check owner and domain token
      const record = await znsL2.registry.getDomainRecord(rootDomainL2Hash);
      expect(record.owner).to.equal(deployAdmin.address);
      expect(record.resolver).to.equal(znsL2.addressResolver.target);

      const domainTokenOwner = await znsL2.domainToken.ownerOf(BigInt(rootDomainL2Hash));
      expect(domainTokenOwner).to.equal(deployAdmin.address);
    });

    it("should register a subdomain on L2", async () => {
      const subDomainLabel = "wheels";
      const subDomainHash = await registrationWithSetup({
        zns: znsL2,
        user: deployAdmin,
        parentHash: rootDomainL2Hash,
        domainLabel: subDomainLabel,
        fullConfig: fullDistrConfigEmpty,
      });

      // validate hashing
      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "bytes32"],
        [rootDomainL2Hash, hashDomainLabel(subDomainLabel)]
      );
      const subDomainHashRef = ethers.solidityPackedKeccak256(
        ["bytes"],
        [encoded]
      );

      expect(subDomainHash).to.equal(subDomainHashRef);

      // check owner and domain token
      const record = await znsL2.registry.getDomainRecord(subDomainHash);
      expect(record.owner).to.equal(deployAdmin.address);
      expect(record.resolver).to.equal(znsL2.addressResolver.target);

      const domainTokenOwner = await znsL2.domainToken.ownerOf(BigInt(subDomainHash));
      expect(domainTokenOwner).to.equal(deployAdmin.address);
    });
  });
});
