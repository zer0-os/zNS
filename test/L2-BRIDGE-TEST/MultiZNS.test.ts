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
  fullDistrConfigEmpty,
  NOT_AUTHORIZED_ERR,
  NOT_OWNER_OF_ERR,
} from "../helpers";
import { expect } from "chai";
import * as ethers from "ethers";
import { ZNSChainResolver, ZNSChainResolver__factory } from "../../typechain";


describe("MultiZNS", () => {
  let zns : IZNSContracts;

  let deployAdmin : SignerWithAddress;
  let registryMock : SignerWithAddress;

  let config : IZNSCampaignConfig<SignerWithAddress>;

  const chainDomainLabel = "zchain";
  let chainDomainHash : string;

  let chainResolver : ZNSChainResolver;

  before(async () => {
    [ deployAdmin, registryMock ] = await hre.ethers.getSigners();

    config = await getConfig({
      deployer: deployAdmin,
      zeroVaultAddress: deployAdmin.address,
    });

    const campaign = await runZnsCampaign({ config });

    zns = campaign.state.contracts;

    await zns.meowToken.mint(deployAdmin.address, 1000000000000000000000n);
    await zns.meowToken.connect(deployAdmin).approve(zns.treasury.target, ethers.MaxUint256);

    // TODO multi: add deploy mission for ChainResolver if decided to leave it!
    const chainResFact = new ZNSChainResolver__factory(deployAdmin);
    chainResolver = await hre.upgrades.deployProxy(
      chainResFact,
      [
        zns.accessController.target,
        zns.registry.target,
      ],
      {
        kind: "uups",
      }
    ) as unknown as ZNSChainResolver;
    await chainResolver.waitForDeployment();
  });

  describe("Bridging Single Chain Specific Domain", () => {
    it.only("should register a new root domain for a chain regularly", async () => {
      chainDomainHash = await registrationWithSetup({
        zns,
        user: deployAdmin,
        domainLabel: chainDomainLabel,
        fullConfig: fullDistrConfigEmpty,
      });

      // should be LOCKED to not allow any subdomains on L1
      const { accessType } = await zns.subRegistrar.distrConfigs(chainDomainHash);
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
      await zns.domainToken.connect(deployAdmin).transferFrom(
        deployAdmin.address,
        zns.registry.target,
        BigInt(chainDomainHash)
      );

      // [AS A LAST OPERATION] change owner to ZNSRegistry to signify that a domain is on another network
      await zns.registry.connect(deployAdmin).updateDomainOwner(chainDomainHash, zns.registry.target);

      // make sure no domain related functions are available to the domain creator now
      await expect(
        zns.registry.connect(deployAdmin).updateDomainOwner(
          chainDomainHash,
          deployAdmin.address
        )
      ).to.be.revertedWithCustomError(zns.registry, NOT_AUTHORIZED_ERR);

      await expect(
        zns.addressResolver.connect(deployAdmin).setAddress(
          chainDomainHash,
          deployAdmin.address
        )
      ).to.be.revertedWithCustomError(zns.registry, NOT_AUTHORIZED_ERR);

      await expect(
        zns.subRegistrar.connect(deployAdmin).setDistributionConfigForDomain(
          chainDomainHash,
          {
            ...distrConfigEmpty,
            accessType: AccessType.OPEN,
          }
        )
      ).to.be.revertedWithCustomError(zns.registry, NOT_AUTHORIZED_ERR);

      // can't Revoke or Reclaim domain
      await expect(
        zns.rootRegistrar.connect(deployAdmin).revokeDomain(chainDomainHash)
      ).to.be.revertedWithCustomError(zns.rootRegistrar, NOT_OWNER_OF_ERR);

      await expect(
        zns.rootRegistrar.connect(deployAdmin).reclaimDomain(chainDomainHash)
      ).to.be.revertedWithCustomError(zns.rootRegistrar, NOT_OWNER_OF_ERR);

      // make sure no one can register subdomains
      await expect(
        registrationWithSetup({
          zns,
          user: deployAdmin,
          parentHash: chainDomainHash,
          domainLabel: "test",
          fullConfig: fullDistrConfigEmpty,
        })
      ).to.be.revertedWithCustomError(zns.subRegistrar, DISTRIBUTION_LOCKED_NOT_EXIST_ERR);

      const record = await zns.registry.getDomainRecord(chainDomainHash);
      expect(record.owner).to.equal(zns.registry.target);
      expect(record.resolver).to.equal(zns.addressResolver.target);

      // check resolver data
      const resolverData = await chainResolver.resolveChainDataStruct(chainDomainHash);
      expect(resolverData.chainId).to.equal(chainId);
      expect(resolverData.chainName).to.equal(chainName);
      expect(resolverData.znsRegistryOnChain).to.equal(znsRegistryOnChain);
      expect(resolverData.auxData).to.equal(auxData);
    });
  });
});
