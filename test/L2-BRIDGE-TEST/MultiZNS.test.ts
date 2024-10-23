import * as hre from "hardhat";
import { getConfig } from "../../src/deploy/campaign/environments";
import { runZnsCampaign } from "../../src/deploy/zns-campaign";
import {
  IZNSCampaignConfig,
  IZNSContracts,
  IZNSEthCrossConfig,
  IZNSZChainCrossConfig,
} from "../../src/deploy/campaign/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { registrationWithSetup } from "../helpers/register-setup";
import {
  AccessType,
  DEFAULT_PRICE_CONFIG,
  DEFAULT_TOKEN_URI,
  distrConfigEmpty,
  DISTRIBUTION_LOCKED_NOT_EXIST_ERR,
  DOMAIN_HASH_NO_MATCH_ERR,
  fullDistrConfigEmpty,
  getCurvePrice,
  getStakingOrProtocolFee,
  hashDomainLabel,
  INITIALIZED_ERR,
  INVALID_CALLER_ERR,
  INVALID_ORIGIN_ERR,
  NOT_AUTHORIZED_ERR,
  NOT_OWNER_OF_ERR,
  PaymentType,
  ZERO_ADDRESS_ERR,
} from "../helpers";
import { expect } from "chai";
import * as ethers from "ethers";
import { getDomainHashFromEvent, getEvents } from "../helpers/events";
import { ContractTransactionReceipt } from "ethers";
import { SupportedChains } from "../../src/deploy/missions/contracts/cross-chain/portals/get-portal-dm";
import { resetMongoAdapter } from "@zero-tech/zdc";


export const NETWORK_ID_L1_DEFAULT = 1n;
export const NETWORK_ID_L2_DEFAULT = 369n;

const zChainID = 336699n;


const resetEnvVars = () => {
  delete process.env.SRC_CHAIN_NAME;
  delete process.env.MOCK_ZKEVM_BRIDGE;
  delete process.env.NETWORK_ID;
  delete process.env.DEST_NETWORK_ID;
  delete process.env.DEST_CHAIN_NAME;
  delete process.env.DEST_CHAIN_ID;
  delete process.env.SRC_ZNS_PORTAL;
};

describe.only("MultiZNS", () => {
  let znsL1 : IZNSContracts;
  let znsL2 : IZNSContracts;

  let deployAdmin : SignerWithAddress;
  let user : SignerWithAddress;
  let subUser : SignerWithAddress;

  let config : IZNSCampaignConfig<SignerWithAddress>;

  const rootDomainLabel = "jeffbridges";
  const subdomainLabel = "beaubridges";
  const subParentLabel = "bridges";

  const dummySmtProof = Array.from({ length: 32 }, () => hre.ethers.randomBytes(32));

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

  before(async () => {
    [ deployAdmin, user, subUser ] = await hre.ethers.getSigners();

    // set ENV vars for the Ethereum ZNS deployment
    process.env.SRC_CHAIN_NAME = SupportedChains.eth;
    process.env.MOCK_ZKEVM_BRIDGE = "true";
    process.env.NETWORK_ID = NETWORK_ID_L1_DEFAULT.toString();
    process.env.DEST_NETWORK_ID = NETWORK_ID_L2_DEFAULT.toString();
    process.env.DEST_CHAIN_NAME = SupportedChains.z;
    process.env.DEST_CHAIN_ID = zChainID.toString();

    config = await getConfig({
      deployer: deployAdmin,
      zeroVaultAddress: deployAdmin.address,
    });

    const campaignL1 = await runZnsCampaign({ config });

    znsL1 = campaignL1.state.contracts;

    resetMongoAdapter();

    // set vars for ZChain ZNS deployment
    process.env.SRC_CHAIN_NAME = SupportedChains.z;
    process.env.SRC_ZNS_PORTAL = znsL1.zPortal.target as string;
    process.env.NETWORK_ID = NETWORK_ID_L2_DEFAULT.toString();
    process.env.MONGO_DB_NAME = "zns-l2";

    config = await getConfig({
      deployer: deployAdmin,
      zeroVaultAddress: deployAdmin.address,
    });

    // emulating L2 here by deploying to the same network
    const campaignL2 = await runZnsCampaign({ config });

    znsL2 = campaignL2.state.contracts;

    // set L2 portal address on L1
    await znsL1.zPortal.connect(deployAdmin).setDestZnsPortal(znsL2.ethPortal.target);

    await znsL2.meowToken.mint(deployAdmin.address, 1000000000000000000000n);
    await znsL2.meowToken.connect(deployAdmin).approve(znsL2.treasury.target, ethers.MaxUint256);

    await znsL1.meowToken.mint(deployAdmin.address, 1000000000000000000000n);
    await znsL1.meowToken.connect(deployAdmin).approve(znsL1.zPortal.target, ethers.MaxUint256);
    await znsL1.meowToken.connect(deployAdmin).approve(znsL1.treasury.target, ethers.MaxUint256);

    await znsL1.meowToken.mint(user.address, hre.ethers.parseEther("100000000000000"));
    await znsL1.meowToken.connect(user).approve(znsL1.zPortal.target, ethers.MaxUint256);
  });

  after(async () => {
    resetEnvVars();
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
              contract: znsL1.zkEvmBridge,
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
            expect(resolverL1).to.equal(znsL1.chainResolver.target);

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
            const chainData = await znsL1.chainResolver.resolveChainDataStruct(domainHash);
            expect(chainData.chainId).to.equal(zChainID);
            expect(chainData.chainName).to.equal(SupportedChains.z);
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
          it("should #claimMessage() on the bridge successfully and fire a ClaimEvent", async () => {
            // **NOTE** that we connect as `deployAdmin` here to show that it's not
            // required that this has to be called by the original owner,
            // it can be called by anyone
            await znsL2.zkEvmBridge.connect(deployAdmin).claimMessage(
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
              contract: znsL2.zkEvmBridge,
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

  describe("Unit Tests", () => {
    describe("ZNSZChainPortal", () => {
      it.only("#initialize() should revert when trying to reinitialize", async () => {
        const {
          destNetworkId,
          destChainName,
          destChainId,
        } = config.crosschain as IZNSEthCrossConfig;

        await expect(
          znsL1.zPortal.connect(deployAdmin).initialize(
            destNetworkId,
            destChainName,
            destChainId,
            await znsL1.zkEvmBridge.getAddress(),
            {
              accessController: await znsL1.accessController.getAddress(),
              registry: await znsL1.registry.getAddress(),
              chainResolver: await znsL1.chainResolver.getAddress(),
              treasury: await znsL1.treasury.getAddress(),
              rootRegistrar: await znsL1.rootRegistrar.getAddress(),
              subRegistrar: await znsL1.subRegistrar.getAddress(),
            }
          )
        ).to.be.revertedWithCustomError(znsL1.zPortal, INITIALIZED_ERR);
      });

      it("#initialize() should revert when passing 0x0 addresses", async () => {
        const {
          destNetworkId,
          destChainName,
          destChainId,
        } = config.crosschain as IZNSEthCrossConfig;

        await expect(
          znsL1.zPortal.connect(deployAdmin).initialize(
            destNetworkId,
            destChainName,
            destChainId,
            hre.ethers.ZeroAddress,
            {
              accessController: znsL1.accessController.target,
              registry: znsL1.registry.target,
              chainResolver: znsL1.chainResolver.target,
              rootRegistrar: znsL1.rootRegistrar.target,
              subRegistrar: znsL1.subRegistrar.target,
              treasury: znsL1.treasury.target,
            }
          )
        ).to.be.revertedWithCustomError(znsL1.zPortal, ZERO_ADDRESS_ERR);
      });

      it("#setDestZnsPortal() should revert when called by non-ADMIN", async () => {
        await expect(
          znsL1.zPortal.connect(user).setDestZnsPortal(znsL2.ethPortal.target)
        ).to.be.revertedWithCustomError(znsL1.zPortal, NOT_AUTHORIZED_ERR);
      });

      it("#setDestZnsPortal() should revert when setting 0x0 address", async () => {
        await expect(
          znsL1.zPortal.connect(deployAdmin).setDestZnsPortal(hre.ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(znsL1.zPortal, ZERO_ADDRESS_ERR);
      });

      it("#setDestZnsPortal() should set the destination portal address", async () => {
        await znsL1.zPortal.connect(deployAdmin).setDestZnsPortal(user.address);

        const destPortal = await znsL1.zPortal.destZnsPortal();
        expect(destPortal).to.equal(user.address);

        // set back to L2 portal address
        await znsL1.zPortal.connect(deployAdmin).setDestZnsPortal(znsL2.ethPortal.target);
      });
    });

    describe("ZNSEthereumPortal", () => {
      it("#initialize() should revert when trying to reinitialize", async () => {
        const {
          srcZnsPortal,
        } = config.crosschain as IZNSZChainCrossConfig;

        await expect(
          znsL2.ethPortal.connect(deployAdmin).initialize(
            znsL2.accessController.target,
            znsL2.zkEvmBridge.target,
            srcZnsPortal,
            znsL2.registry.target,
            znsL2.domainToken.target,
            znsL2.rootRegistrar.target,
            znsL2.subRegistrar.target,
          )
        ).to.be.revertedWithCustomError(znsL2.ethPortal, INITIALIZED_ERR);
      });

      it("#onMessageReceived() should revert when called by non-ZkEvmBridge", async () => {
        await expect(
          znsL2.ethPortal.connect(deployAdmin).onMessageReceived(
            znsL2.zkEvmBridge.target,
            1n,
            hre.ethers.ZeroHash,
          )
        ).to.be.revertedWithCustomError(znsL2.ethPortal, INVALID_CALLER_ERR);
      });

      it("#onMessageReceived() should revert when `originAddress` is something OTHER than ZChainPortal", async () => {
        await expect(
          // this will call onMessageReceived(), we have to do it like this to avoid
          // reverting on the `InvalidCaller` check
          znsL2.zkEvmBridge.claimMessage(
            dummySmtProof,
            dummySmtProof,
            bridgedEventData.globalIndex,
            dummySmtProof[0],
            dummySmtProof[1],
            bridgedEventData.originNetwork,
            znsL2.registry.target,
            bridgedEventData.destinationNetwork,
            bridgedEventData.destinationAddress,
            bridgedEventData.amount,
            bridgedEventData.metadata,
          )
        ).to.be.revertedWithCustomError(znsL2.ethPortal, INVALID_ORIGIN_ERR);
      });

      it("#onMessageReceived() should revert when proof's `domainHash` is incorrect", async () => {
        // make wrong metadata
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const wrongMetadata = abiCoder.encode(
          ["tuple(bytes32,bytes32,string,address,string)"],
          [[
            hashDomainLabel("wrong"), // this hashes a different label from the one below
            hre.ethers.ZeroHash,
            "right",
            user.address,
            DEFAULT_TOKEN_URI,
          ]]
        );

        await expect(
          znsL2.zkEvmBridge.claimMessage(
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
            wrongMetadata,
          )
        ).to.be.revertedWithCustomError(znsL2.ethPortal, DOMAIN_HASH_NO_MATCH_ERR);
      });
    });
  });
});
