import * as hre from "hardhat";
import { getConfig } from "../../src/deploy/campaign/environments";
import { runZnsCampaign } from "../../src/deploy/zns-campaign";
import { IZNSCampaignConfig, IZNSContracts } from "../../src/deploy/campaign/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { registrationWithSetup } from "../helpers/register-setup";
import {
  AccessType, DEFAULT_TOKEN_URI,
  distrConfigEmpty,
  DISTRIBUTION_LOCKED_NOT_EXIST_ERR,
  fullDistrConfigEmpty,
  NOT_AUTHORIZED_ERR,
  NOT_OWNER_OF_ERR, paymentConfigEmpty, PaymentType, REGISTRAR_ROLE,
} from "../helpers";
import { expect } from "chai";
import * as ethers from "ethers";
import {
  PolygonZkEVMBridgeV2Mock,
  PolygonZkEVMBridgeV2Mock__factory,
  ZNSChainResolver,
  ZNSChainResolver__factory, ZNSEthereumPortal,
  ZNSEthereumPortal__factory, ZNSPolygonZkEvmPortal,
  ZNSPolygonZkEvmPortal__factory,
} from "../../typechain";
import { getDomainHashFromEvent } from "../helpers/events";


// TODO multi: move below code to appropriate places
//  some of these may be optional ??
export interface IZNSContractsExtended extends IZNSContracts {
  polyPortal : ZNSPolygonZkEvmPortal;
  bridgeL1 : PolygonZkEVMBridgeV2Mock;
  ethPortal : ZNSEthereumPortal;
  bridgeL2 : PolygonZkEVMBridgeV2Mock;
}


export const NETWORK_ID_L1_DEFAULT = 1n;
export const NETWORK_ID_L2_DEFAULT = 666n;

export const deployCrossChainContracts = async ({
  deployer,
  znsL1,
  znsL2,
  networkIdL1 = NETWORK_ID_L1_DEFAULT,
  networkIdL2 = NETWORK_ID_L2_DEFAULT,
  wethTokenAddress = hre.ethers.ZeroAddress,
} : {
  deployer : SignerWithAddress;
  znsL1 : IZNSContracts;
  znsL2 : IZNSContracts;
  networkIdL1 ?: bigint;
  networkIdL2 ?: bigint;
  wethTokenAddress ?: string;
}) => {
  const polyPortalFact = new ZNSPolygonZkEvmPortal__factory(deployer);
  const ethPortalFact = new ZNSEthereumPortal__factory(deployer);
  const bridgeMockFact = new PolygonZkEVMBridgeV2Mock__factory(deployer);

  const bridgeL1 = await bridgeMockFact.deploy(
    networkIdL1,
    wethTokenAddress,
  );
  await bridgeL1.waitForDeployment();
  const bridgeL2 = await bridgeMockFact.deploy(
    networkIdL2,
    wethTokenAddress,
  );
  await bridgeL2.waitForDeployment();

  const polyPortal = await hre.upgrades.deployProxy(
    polyPortalFact,
    [
      znsL1.accessController.target,
      networkIdL2,
      bridgeL1.target,
      znsL1.rootRegistrar.target,
      znsL1.subRegistrar.target,
      znsL1.treasury.target,
      znsL1.registry.target,
    ],
    {
      kind: "uups",
    }
  ) as unknown as ZNSPolygonZkEvmPortal;
  await polyPortal.waitForDeployment();

  const ethPortal = await hre.upgrades.deployProxy(
    ethPortalFact,
    [
      znsL2.accessController.target,
      bridgeL2.target,
      polyPortal.target,
      znsL2.rootRegistrar.target,
      znsL2.subRegistrar.target,
      znsL2.registry.target,
      znsL2.registry.target,
    ],
    {
      kind: "uups",
    }
  ) as unknown as ZNSEthereumPortal;
  await ethPortal.waitForDeployment();

  // link portals
  await polyPortal.connect(deployer).setL1PortalAddress(ethPortal.target);

  // give Role to the Portal on L2 to call special function
  await znsL2.accessController.connect(deployer).grantRole(
    REGISTRAR_ROLE,
    ethPortal.target
  );

  return {
    polyPortal,
    ethPortal,
    bridgeL1,
    bridgeL2,
  };
};

describe.only("MultiZNS", () => {
  let znsL1 : IZNSContractsExtended;
  let znsL2 : IZNSContractsExtended;

  let deployAdmin : SignerWithAddress;

  let config : IZNSCampaignConfig<SignerWithAddress>;

  const rootDomainLabel = "jeffbridges";
  let rootDomainHash : string;

  let chainResolver : ZNSChainResolver;

  before(async () => {
    [ deployAdmin ] = await hre.ethers.getSigners();

    config = await getConfig({
      deployer: deployAdmin,
      zeroVaultAddress: deployAdmin.address,
    });

    const campaignL1 = await runZnsCampaign({ config });

    znsL1 = campaignL1.state.contracts;

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

    config = await getConfig({
      deployer: deployAdmin,
      zeroVaultAddress: deployAdmin.address,
    });

    // emulating L2 here by deploying to the same network
    const campaignL2 = await runZnsCampaign({ config });

    znsL2 = campaignL2.state.contracts;

    await znsL2.meowToken.mint(deployAdmin.address, 1000000000000000000000n);
    await znsL2.meowToken.connect(deployAdmin).approve(znsL2.treasury.target, ethers.MaxUint256);

    const {
      polyPortal,
      ethPortal,
      bridgeL1,
      bridgeL2,
    } = await deployCrossChainContracts({
      deployer: deployAdmin,
      znsL1,
      znsL2,
    });

    znsL1 = {
      ...znsL1,
      polyPortal,
      bridgeL1,
    };

    znsL2 = {
      ...znsL2,
      ethPortal,
      bridgeL2,
    };

    await znsL1.meowToken.mint(deployAdmin.address, 1000000000000000000000n);
    await znsL1.meowToken.connect(deployAdmin).approve(znsL1.polyPortal.target, ethers.MaxUint256);
  });

  describe("Bridge and Register on L1", () => {
    before(async () => {
      // register and bridge
      await znsL1.polyPortal.connect(deployAdmin).registerAndBridgeDomain(
        hre.ethers.ZeroHash,
        rootDomainLabel,
        DEFAULT_TOKEN_URI,
      );
      rootDomainHash = await getDomainHashFromEvent({
        zns: znsL1,
        registrantAddress: znsL1.polyPortal.target as string,
      });
    });

    it("should register and set owners as ZkEvmPortal and fire DomainBridged event", async () => {
      // check if domain is registered on L1
      // check events
      const filter = znsL1.polyPortal.filters.DomainBridged(
        undefined,
        undefined,
        rootDomainHash,
        undefined,
      );
      const events = await znsL1.polyPortal.queryFilter(filter);
      const [event] = events;
      expect(event.args.domainHash).to.equal(rootDomainHash);
      expect(event.args.destNetworkId).to.equal(666n);
      expect(event.args.destPortalAddress).to.equal(znsL2.ethPortal.target);
      expect(event.args.domainOwner).to.equal(deployAdmin.address);

      // check owner and resolver are set properly
      const {
        owner: ownerL1,
        resolver: resolverL1,
      } = await znsL1.registry.getDomainRecord(rootDomainHash);
      expect(ownerL1).to.equal(znsL1.polyPortal.target);
      // TODO multi: unblock below code when logic added to contract
      // expect(resolverL1).to.equal(chainResolver.target);

      const tokenOwner = await znsL1.domainToken.ownerOf(BigInt(rootDomainHash));
      expect(tokenOwner).to.equal(znsL1.polyPortal.target);
    });

    it("should set configs as empty", async () => {
      // should be LOCKED with no configs
      const distrConfig = await znsL1.subRegistrar.distrConfigs(rootDomainHash);
      expect(distrConfig.accessType).to.equal(AccessType.LOCKED);
      expect(distrConfig.paymentType).to.equal(PaymentType.DIRECT);
      expect(distrConfig.pricerContract).to.equal(hre.ethers.ZeroAddress);

      const paymentConfig = await znsL1.treasury.paymentConfigs(rootDomainHash);
      expect(paymentConfig.token).to.equal(hre.ethers.ZeroAddress);
      expect(paymentConfig.beneficiary).to.equal(hre.ethers.ZeroAddress);
    });

    it("should properly set data in ChainResolver", async () => {
      // TODO multi: unblock below code when logic added to contract
      // check resolver data
      // const resolverData = await chainResolver.resolveChainDataStruct(chainDomainHash);
      // expect(resolverData.chainId).to.equal(chainId);
      // expect(resolverData.chainName).to.equal(chainName);
      // expect(resolverData.znsRegistryOnChain).to.equal(znsRegistryOnChain);
      // expect(resolverData.auxData).to.equal(auxData);
    });

    it("should NOT allow owner to access any domain functions after bridge", async () => {
      // make sure NO domain related functions are available to the domain creator now
      await expect(
        znsL1.registry.connect(deployAdmin).updateDomainOwner(
          rootDomainHash,
          deployAdmin.address
        )
      ).to.be.revertedWithCustomError(znsL1.registry, NOT_AUTHORIZED_ERR);

      await expect(
        znsL1.addressResolver.connect(deployAdmin).setAddress(
          rootDomainHash,
          deployAdmin.address
        )
      ).to.be.revertedWithCustomError(znsL1.registry, NOT_AUTHORIZED_ERR);

      await expect(
        znsL1.subRegistrar.connect(deployAdmin).setDistributionConfigForDomain(
          rootDomainHash,
          {
            ...distrConfigEmpty,
            accessType: AccessType.OPEN,
          }
        )
      ).to.be.revertedWithCustomError(znsL1.registry, NOT_AUTHORIZED_ERR);

      // can't Revoke or Reclaim domain
      await expect(
        znsL1.rootRegistrar.connect(deployAdmin).revokeDomain(rootDomainHash)
      ).to.be.revertedWithCustomError(znsL1.rootRegistrar, NOT_OWNER_OF_ERR);

      await expect(
        znsL1.rootRegistrar.connect(deployAdmin).reclaimDomain(rootDomainHash)
      ).to.be.revertedWithCustomError(znsL1.rootRegistrar, NOT_OWNER_OF_ERR);
    });

    it("should NOT allow registration of subdomains", async () => {
      // make sure no one can register subdomains
      await expect(
        registrationWithSetup({
          zns: znsL1,
          user: deployAdmin,
          parentHash: rootDomainHash,
          domainLabel: "test",
          fullConfig: fullDistrConfigEmpty,
        })
      ).to.be.revertedWithCustomError(znsL1.subRegistrar, DISTRIBUTION_LOCKED_NOT_EXIST_ERR);
    });
  });
});
