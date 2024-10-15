import * as hre from "hardhat";
import { getConfig } from "../../src/deploy/campaign/environments";
import { runZnsCampaign } from "../../src/deploy/zns-campaign";
import { IZNSCampaignConfig, IZNSContracts } from "../../src/deploy/campaign/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { registrationWithSetup } from "../helpers/register-setup";
import {
  AccessType, DEFAULT_PRICE_CONFIG, DEFAULT_TOKEN_URI,
  distrConfigEmpty,
  DISTRIBUTION_LOCKED_NOT_EXIST_ERR,
  fullDistrConfigEmpty, getCurvePrice, getStakingOrProtocolFee,
  NOT_AUTHORIZED_ERR,
  NOT_OWNER_OF_ERR, PaymentType,
} from "../helpers";
import { expect } from "chai";
import * as ethers from "ethers";
import {
  PolygonZkEVMBridgeV2Mock,
  PolygonZkEVMBridgeV2Mock__factory,
  ZNSChainResolver,
  ZNSChainResolver__factory, ZNSEthereumPortal,
  ZNSEthereumPortal__factory, ZNSPolygonZkEvmPortal,
  ZNSZChainPortal__factory,
} from "../../typechain";
import { getDomainHashFromEvent, getEvents } from "../helpers/events";
import { AddressLike, ContractTransactionReceipt } from "ethers";
import { PORTAL_ROLE, ResolverTypes } from "../../src/deploy/constants";


// TODO multi: move below code to appropriate places
//  some of these may be optional ??
export interface IZNSContractsExtended extends IZNSContracts {
  zPortal : ZNSPolygonZkEvmPortal;
  bridgeL1 : PolygonZkEVMBridgeV2Mock;
  ethPortal : ZNSEthereumPortal;
  bridgeL2 : PolygonZkEVMBridgeV2Mock;
}


export const NETWORK_ID_L1_DEFAULT = 1n;
export const NETWORK_ID_L2_DEFAULT = 369n;

const zChainID = 336699n;
const zChainName = "ZChain";


// TODO multi: add this to the Campaign properly !!!
export const deployCrossChainContracts = async ({
  deployer,
  znsL1,
  chainResolverAddressL1,
  znsL2,
  srcNetworkId = NETWORK_ID_L1_DEFAULT,
  destNetworkId = NETWORK_ID_L2_DEFAULT,
  wethTokenAddress = hre.ethers.ZeroAddress,
  destChainName = zChainName,
  destChainId = zChainID,
} : {
  deployer : SignerWithAddress;
  znsL1 : IZNSContracts;
  chainResolverAddressL1 : AddressLike;
  znsL2 : IZNSContracts;
  srcNetworkId ?: bigint;
  destNetworkId ?: bigint;
  wethTokenAddress ?: string;
  destChainName ?: string;
  destChainId ?: bigint;
}) => {
  const zPortalFact = new ZNSZChainPortal__factory(deployer);
  const ethPortalFact = new ZNSEthereumPortal__factory(deployer);
  const bridgeMockFact = new PolygonZkEVMBridgeV2Mock__factory(deployer);

  const bridgeL1 = await bridgeMockFact.deploy(
    srcNetworkId,
    wethTokenAddress,
  );
  await bridgeL1.waitForDeployment();
  const bridgeL2 = await bridgeMockFact.deploy(
    destNetworkId,
    wethTokenAddress,
  );
  await bridgeL2.waitForDeployment();

  const zPortal = await hre.upgrades.deployProxy(
    zPortalFact,
    [
      destNetworkId,
      destChainName,
      destChainId,
      bridgeL1.target,
      {
        accessController: znsL1.accessController.target,
        rootRegistrar: znsL1.rootRegistrar.target,
        subRegistrar: znsL1.subRegistrar.target,
        treasury: znsL1.treasury.target,
        chainResolver: chainResolverAddressL1,
        registry: znsL1.registry.target,
      },
    ],
    {
      kind: "uups",
    }
  ) as unknown as ZNSPolygonZkEvmPortal;
  await zPortal.waitForDeployment();

  const ethPortal = await hre.upgrades.deployProxy(
    ethPortalFact,
    [
      znsL2.accessController.target,
      bridgeL2.target,
      zPortal.target,
      znsL2.registry.target,
      znsL2.domainToken.target,
      znsL2.rootRegistrar.target,
      znsL2.subRegistrar.target,
    ],
    {
      kind: "uups",
    }
  ) as unknown as ZNSEthereumPortal;
  await ethPortal.waitForDeployment();

  // link portals
  await zPortal.connect(deployer).setDestZnsPortal(ethPortal.target);

  // give Role to the Portal on L2 to call special function
  await znsL2.accessController.connect(deployer).grantRole(
    PORTAL_ROLE,
    ethPortal.target
  );

  return {
    zPortal,
    ethPortal,
    bridgeL1,
    bridgeL2,
  };
};

describe.only("MultiZNS", () => {
  let znsL1 : IZNSContractsExtended;
  let znsL2 : IZNSContractsExtended;

  let deployAdmin : SignerWithAddress;
  let user : SignerWithAddress;
  let subUser : SignerWithAddress;

  let config : IZNSCampaignConfig<SignerWithAddress>;

  const rootDomainLabel = "jeffbridges";
  const subdomainLabel = "beaubridges";
  const subParentLabel = "bridges";

  let balanceBeforeBridge : bigint;

  let bridgedEventData : {
    leafType : bigint;
    originNetwork : bigint;
    originAddress : string;
    destinationNetwork : bigint;
    destinationAddress : string;
    amount : bigint;
    metadata : string;
    globalIndex : bigint;
  };

  let chainResolver : ZNSChainResolver;

  before(async () => {
    [ deployAdmin, user, subUser ] = await hre.ethers.getSigners();

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

    // TODO multi: add constants/enums for Resolver Types and possibly to Registry as well !!!
    await znsL1.registry.connect(deployAdmin).addResolverType(ResolverTypes.chain, chainResolver.target);

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
      zPortal,
      ethPortal,
      bridgeL1,
      bridgeL2,
    } = await deployCrossChainContracts({
      deployer: deployAdmin,
      znsL1,
      chainResolverAddressL1: chainResolver.target,
      znsL2,
    });

    znsL1 = {
      ...znsL1,
      zPortal,
      bridgeL1,
    };

    znsL2 = {
      ...znsL2,
      ethPortal,
      bridgeL2,
    };

    await znsL1.meowToken.mint(deployAdmin.address, 1000000000000000000000n);
    await znsL1.meowToken.connect(deployAdmin).approve(znsL1.zPortal.target, ethers.MaxUint256);
    await znsL1.meowToken.connect(deployAdmin).approve(znsL1.treasury.target, ethers.MaxUint256);

    await znsL1.meowToken.mint(user.address, hre.ethers.parseEther("100000000000000"));
    await znsL1.meowToken.connect(user).approve(znsL1.zPortal.target, ethers.MaxUint256);
  });

  [
    {
      name: "Root Domain",
      parentHash: hre.ethers.ZeroHash,
      label: rootDomainLabel,
      subdomainChildLabel: "rootsub",
    },
    {
      name: "Subdomain",
      parentHash: undefined,
      label: subdomainLabel,
      subdomainChildLabel: "subsub",
    },
  ].forEach(
    ({
      name,
      parentHash,
      label,
      subdomainChildLabel,
    } : {
      name : string;
      parentHash : string | undefined;
      label : string;
      subdomainChildLabel : string;
    }) => {
      let domainHash : string;

      describe(`${name} Bridging`, () => {
        before(async () => {
          if (name === "Subdomain") {
            // register root regularly on L1 first
            parentHash = await registrationWithSetup({
              zns: znsL1,
              user: deployAdmin,
              domainLabel: subParentLabel,
              fullConfig: {
                distrConfig: {
                  accessType: AccessType.OPEN,
                  paymentType: PaymentType.DIRECT,
                  pricerContract: znsL1.curvePricer.target,
                },
                paymentConfig: {
                  token: znsL1.meowToken.target,
                  beneficiary: deployAdmin.address,
                },
                priceConfig: DEFAULT_PRICE_CONFIG,
              },
            });
          }

          balanceBeforeBridge = await znsL1.meowToken.balanceOf(user.address);

          // register and bridge
          const tx = await znsL1.zPortal.connect(user).registerAndBridgeDomain(
            parentHash as string,
            label,
            DEFAULT_TOKEN_URI
          );
          const receipt = await tx.wait() as ContractTransactionReceipt;
          console.log(`Gas used for ${name} bridging: ${receipt.gasUsed.toString()}`);

          domainHash = await getDomainHashFromEvent({
            zns: znsL1,
            registrantAddress: znsL1.zPortal.target as string,
          });
        });

        // TODO multi: test all reverts and failures properly !!!
        describe("Bridge and Register on L1", () => {
          // eslint-disable-next-line max-len
          it("should register and set owners as ZkEvmPortal and fire DomainBridged and BridgeEvent events", async () => {
            // check if domain is registered on L1
            // check events
            const events = await getEvents({
              contract: znsL1.zPortal,
              eventName: "DomainBridged",
            });
            const event = events[events.length - 1];
            expect(event.args.domainHash).to.equal(domainHash);
            expect(event.args.destNetworkId).to.equal(NETWORK_ID_L2_DEFAULT);
            expect(event.args.destPortalAddress).to.equal(znsL2.ethPortal.target);
            expect(event.args.domainOwner).to.equal(user.address);

            const bridgeEvents = await getEvents({
              contract: znsL1.bridgeL1,
              eventName: "BridgeEvent",
            });
            ({ args: bridgedEventData } = bridgeEvents[bridgeEvents.length - 1]);

            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const metadataRef = abiCoder.encode(
              ["tuple(bytes32,bytes32,string,address,string)"],
              [[
                domainHash,
                parentHash,
                label,
                user.address,
                DEFAULT_TOKEN_URI,
              ]]
            );

            expect(bridgedEventData.originNetwork).to.equal(NETWORK_ID_L1_DEFAULT);
            expect(bridgedEventData.originAddress).to.equal(znsL1.zPortal.target);
            expect(bridgedEventData.destinationNetwork).to.equal(NETWORK_ID_L2_DEFAULT);
            expect(bridgedEventData.destinationAddress).to.equal(znsL2.ethPortal.target);
            expect(bridgedEventData.amount).to.equal(0n);
            expect(bridgedEventData.metadata).to.equal(metadataRef);

            // check owner and resolver are set properly
            const {
              owner: ownerL1,
              resolver: resolverL1,
            } = await znsL1.registry.getDomainRecord(domainHash);
            expect(ownerL1).to.equal(znsL1.zPortal.target);
            expect(resolverL1).to.equal(chainResolver.target);

            const tokenOwner = await znsL1.domainToken.ownerOf(BigInt(domainHash));
            expect(tokenOwner).to.equal(znsL1.zPortal.target);
          });

          it("should withdraw the correct amount of tokens from the caller", async () => {
            const balanceAfterBridge = await znsL1.meowToken.balanceOf(user.address);

            const priceRef = getCurvePrice(label);
            const protocolFeeRef = getStakingOrProtocolFee(priceRef);

            expect(balanceBeforeBridge - balanceAfterBridge).to.equal(priceRef + protocolFeeRef);
          });

          it("should set configs as empty", async () => {
            // should be LOCKED with no configs
            const distrConfig = await znsL1.subRegistrar.distrConfigs(domainHash);
            expect(distrConfig.accessType).to.equal(AccessType.LOCKED);
            expect(distrConfig.paymentType).to.equal(PaymentType.DIRECT);
            expect(distrConfig.pricerContract).to.equal(hre.ethers.ZeroAddress);

            const paymentConfig = await znsL1.treasury.paymentConfigs(domainHash);
            expect(paymentConfig.token).to.equal(hre.ethers.ZeroAddress);
            expect(paymentConfig.beneficiary).to.equal(hre.ethers.ZeroAddress);
          });

          it("should properly set data in ChainResolver", async () => {
            const chainData = await chainResolver.resolveChainDataStruct(domainHash);
            expect(chainData.chainId).to.equal(zChainID);
            expect(chainData.chainName).to.equal(zChainName);
            expect(chainData.znsRegistryOnChain).to.equal(hre.ethers.ZeroAddress);
            expect(chainData.auxData).to.equal("");
          });

          it("should NOT allow owner to access any domain functions after bridge", async () => {
            // make sure NO domain related functions are available to the domain creator now
            await expect(
              znsL1.registry.connect(user).updateDomainOwner(
                domainHash,
                user.address
              )
            ).to.be.revertedWithCustomError(znsL1.registry, NOT_AUTHORIZED_ERR);

            await expect(
              znsL1.addressResolver.connect(user).setAddress(
                domainHash,
                user.address
              )
            ).to.be.revertedWithCustomError(znsL1.registry, NOT_AUTHORIZED_ERR);

            await expect(
              znsL1.subRegistrar.connect(user).setDistributionConfigForDomain(
                domainHash,
                {
                  ...distrConfigEmpty,
                  accessType: AccessType.OPEN,
                }
              )
            ).to.be.revertedWithCustomError(znsL1.registry, NOT_AUTHORIZED_ERR);

            // can't Revoke or Reclaim domain
            await expect(
              znsL1.rootRegistrar.connect(user).revokeDomain(domainHash)
            ).to.be.revertedWithCustomError(znsL1.rootRegistrar, NOT_OWNER_OF_ERR);

            await expect(
              znsL1.rootRegistrar.connect(user).reclaimDomain(domainHash)
            ).to.be.revertedWithCustomError(znsL1.rootRegistrar, NOT_OWNER_OF_ERR);
          });

          it("should NOT allow registration of subdomains", async () => {
            // make sure no one can register subdomains
            await expect(
              registrationWithSetup({
                zns: znsL1,
                user,
                parentHash: domainHash,
                domainLabel: "test",
                fullConfig: fullDistrConfigEmpty,
              })
            ).to.be.revertedWithCustomError(znsL1.subRegistrar, DISTRIBUTION_LOCKED_NOT_EXIST_ERR);
          });
        });

        describe("Claim Bridged Domain on L2", () => {
          const dummySmtProof = Array.from({ length: 32 }, () => hre.ethers.randomBytes(32));

          it("should #claimMessage() on the bridge successfully and fire a ClaimEvent", async () => {
            // **NOTE** that we connect as `deployAdmin` here to show that it's not
            // required that this has to be called by the original owner,
            // it can be called by anyone
            await znsL2.bridgeL2.connect(deployAdmin).claimMessage(
              dummySmtProof,
              dummySmtProof,
              bridgedEventData.globalIndex,
              dummySmtProof[0],
              dummySmtProof[1],
              bridgedEventData.originNetwork,
              bridgedEventData.originAddress,
              bridgedEventData.destinationNetwork,
              bridgedEventData.destinationAddress,
              bridgedEventData.amount,
              bridgedEventData.metadata,
            );

            const events = await getEvents({
              contract: znsL2.bridgeL2,
              eventName: "ClaimEvent",
            });
            const event = events[events.length - 1];
            expect(event.args.originNetwork).to.equal(NETWORK_ID_L1_DEFAULT);
            expect(event.args.originAddress).to.equal(znsL1.zPortal.target);
            expect(event.args.destinationAddress).to.equal(znsL2.ethPortal.target);
            expect(event.args.amount).to.equal(0n);
          });

          // eslint-disable-next-line max-len
          it("should register domain on L2, set owners as original L1 caller and fire DomainClaimed event", async () => {
            // check if domain is registered on L2
            // check events
            const events = await getEvents({
              contract: znsL2.ethPortal,
              eventName: "DomainClaimed",
            });
            const event = events[events.length - 1];
            expect(event.args.srcNetworkId).to.equal(NETWORK_ID_L1_DEFAULT);
            expect(event.args.srcPortalAddress).to.equal(znsL1.zPortal.target);
            expect(event.args.domainHash).to.equal(domainHash);
            expect(event.args.domainOwner).to.equal(user.address);

            // check owner and resolver are set properly
            const {
              owner: ownerL2,
            } = await znsL2.registry.getDomainRecord(domainHash);
            expect(ownerL2).to.equal(user.address);

            const tokenOwner = await znsL2.domainToken.ownerOf(BigInt(domainHash));
            expect(tokenOwner).to.equal(user.address);
          });

          it("should set configs as empty and allow original caller to set these configs", async () => {
            // should be LOCKED with no configs
            const distrConfig = await znsL2.subRegistrar.distrConfigs(domainHash);
            expect(distrConfig.accessType).to.equal(AccessType.LOCKED);
            expect(distrConfig.paymentType).to.equal(PaymentType.DIRECT);
            expect(distrConfig.pricerContract).to.equal(hre.ethers.ZeroAddress);

            const paymentConfig = await znsL2.treasury.paymentConfigs(domainHash);
            expect(paymentConfig.token).to.equal(hre.ethers.ZeroAddress);
            expect(paymentConfig.beneficiary).to.equal(hre.ethers.ZeroAddress);

            // set configs
            const distrConfigToSet = {
              accessType: AccessType.OPEN,
              paymentType: PaymentType.DIRECT,
              pricerContract: znsL2.fixedPricer.target,
            };
            await znsL2.subRegistrar.connect(user).setDistributionConfigForDomain(
              domainHash,
              distrConfigToSet,
            );

            const paymentConfigToSet = {
              token: znsL2.meowToken.target,
              beneficiary: user.address,
            };
            await znsL2.treasury.connect(user).setPaymentConfig(
              domainHash,
              paymentConfigToSet,
            );

            const priceToSet = 100n;
            await znsL2.fixedPricer.connect(user).setPrice(domainHash, priceToSet);

            // check configs are set properly
            const distrConfigAfter = await znsL2.subRegistrar.distrConfigs(domainHash);
            expect(distrConfigAfter.accessType).to.equal(distrConfigToSet.accessType);
            expect(distrConfigAfter.paymentType).to.equal(distrConfigToSet.paymentType);
            expect(distrConfigAfter.pricerContract).to.equal(distrConfigToSet.pricerContract);

            const paymentConfigAfter = await znsL2.treasury.paymentConfigs(domainHash);
            expect(paymentConfigAfter.token).to.equal(paymentConfigToSet.token);
            expect(paymentConfigAfter.beneficiary).to.equal(paymentConfigToSet.beneficiary);

            const priceAfter = await znsL2.fixedPricer.getPrice(domainHash, "test", true);
            expect(priceAfter).to.equal(priceToSet);
          });

          it("should allow creating subdomains under the rules of newly set configs", async () => {
            await znsL2.meowToken.mint(subUser.address, 1000000000000000000000n);
            await znsL2.meowToken.connect(subUser).approve(znsL2.treasury.target, ethers.MaxUint256);

            // make sure subdomains can be registered now
            const subdomainHash = await registrationWithSetup({
              zns: znsL2,
              user: subUser,
              parentHash: domainHash,
              domainLabel: subdomainChildLabel,
              fullConfig: fullDistrConfigEmpty,
            });

            const events = await getEvents({
              contract: znsL2.rootRegistrar,
              eventName: "DomainRegistered",
            });
            const event = events[events.length - 1];
            expect(event.args.parentHash).to.equal(domainHash);
            expect(event.args.domainHash).to.equal(subdomainHash);
            expect(event.args.label).to.equal(subdomainChildLabel);
            expect(event.args.tokenURI).to.equal(DEFAULT_TOKEN_URI);
            expect(event.args.registrant).to.equal(subUser.address);
            expect(event.args.domainAddress).to.equal(subUser.address);

            // check if subdomain is registered
            const record = await znsL2.registry.getDomainRecord(subdomainHash);
            expect(record.owner).to.equal(subUser.address);
            expect(record.resolver).to.equal(znsL2.addressResolver.target);

            const tokenOwner = await znsL2.domainToken.ownerOf(BigInt(subdomainHash));
            expect(tokenOwner).to.equal(subUser.address);
          });
        });
      });
    });
});
