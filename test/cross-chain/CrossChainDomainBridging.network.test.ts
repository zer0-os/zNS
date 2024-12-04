import * as hre from "hardhat";
import { getConfig, getValidateRootPriceConfig } from "../../src/deploy/campaign/get-config";
import { runZnsCampaign } from "../../src/deploy/zns-campaign";
import {
  IZNSCampaignConfig,
  IZNSContracts,
} from "../../src/deploy/campaign/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { approveForDomain, registrationWithSetup } from "../helpers/register-setup";
import {
  AC_UNAUTHORIZED_ERR,
  AccessType,
  DEFAULT_PRICE_CONFIG,
  DEFAULT_TOKEN_URI, DEST_PORTAL_NOT_SET_ERR,
  distrConfigEmpty,
  DISTRIBUTION_LOCKED_NOT_EXIST_ERR,
  fullDistrConfigEmpty,
  getCurvePrice,
  getStakingOrProtocolFee,
  hashDomainLabel,
  INITIALIZED_ERR,
  INVALID_CALLER_ERR,
  MESSAGE_FAILED_ERR, NETWORK_ID_L1_TEST_DEFAULT, NETWORK_ID_L2_TEST_DEFAULT,
  NOT_AUTHORIZED_ERR,
  NOT_OWNER_OF_ERR,
  PaymentType, ZCHAIN_ID_TEST_DEFAULT,
  ZERO_ADDRESS_ERR,
} from "../helpers";
import { expect } from "chai";
import * as ethers from "ethers";
import { getDomainHashFromEvent, getEvents } from "../helpers/events";
import { ContractTransactionReceipt, Wallet } from "ethers";
import { SupportedChains } from "../../src/deploy/missions/contracts/cross-chain/portals/get-portal-dm";
import { MongoDBAdapter, resetMongoAdapter } from "@zero-tech/zdc";
import assert from "assert";
import { getConfirmationsNumber } from "../helpers/tx";
import { getClaimArgsFromApi } from "../helpers/cc-claim";
import { setDefaultEnvironment } from "../../src/environment/set-env";


// TODO multi: add ChainResolver tests !!!
describe("Cross-Chain Domain Bridging Test [for local and test networks]", () => {
  let isRealNetwork = false;

  let znsL1 : IZNSContracts;
  let znsL2 : IZNSContracts;
  let dbAdapter1 : MongoDBAdapter;
  let dbAdapter2 : MongoDBAdapter;

  let deployAdmin : SignerWithAddress;
  let deployAdminL2 : Wallet | SignerWithAddress;
  let user : SignerWithAddress;
  let userL2 : Wallet | SignerWithAddress;
  let subUser : SignerWithAddress;
  let subUserL2 : Wallet | SignerWithAddress;

  let configL1 : IZNSCampaignConfig;
  let configL2 : IZNSCampaignConfig;

  const rootDomainLabel = "jeffbridges";
  const subdomainLabel = "beaubridges";
  const subParentLabel = "bridgess";

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
    depositCount : bigint;
  };

  // !!! The test network run test should always run on PREDEPLOYED contracts !!!
  //  and MONGO specific ENV vars should be set to the correct values so that the campaignL2
  //  can pick them up properly and not redeploy anything !
  before(async () => {
    const env = process.env.ENV_LEVEL;
    isRealNetwork = env === "test" && hre.network.name !== "hardhat";

    [ deployAdmin, user, subUser ] = await hre.ethers.getSigners();

    process.env.SRC_CHAIN_NAME = SupportedChains.eth;
    if (isRealNetwork) {
      assert.ok(
        !!process.env.MONGO_DB_VERSION,
        "Have to provide correct MONGO_DB_VERSION for running on test networks to use existing deployed contracts!"
      );
      assert.ok(
        !!process.env.MONGO_DB_NAME,
        "Have to provide correct MONGO_DB_NAME where SOURCE chain contracts are located!"
      );
      assert.ok(
        !!process.env.MONGO_DB_NAME_DEST,
        "Have to provide correct MONGO_DB_NAME_DEST where DESTINATION chain contracts are located!"
      );
      assert.ok(
        !!process.env.MONGO_DB_VERSION_DEST,
        "Have to provide correct MONGO_DB_VERSION_DEST where DESTINATION chain contracts are located!"
      );
      assert.ok(
        !!process.env.SEPOLIA_RPC_URL,
        "Have to provide correct SEPOLIA_RPC_URL for running on test networks!"
      );
      assert.ok(
        !!process.env.ZCHAINTEST_RPC_URL,
        "Have to provide correct ZCHAINTEST_RPC_URL for running on test networks!"
      );
    } else {
      // set ENV vars for the Ethereum ZNS deployment
      process.env.MOCK_ZKEVM_BRIDGE = "true";
      process.env.NETWORK_ID = NETWORK_ID_L1_TEST_DEFAULT.toString();
      process.env.DEST_NETWORK_ID = NETWORK_ID_L2_TEST_DEFAULT.toString();
      process.env.DEST_CHAIN_NAME = SupportedChains.z;
      process.env.DEST_CHAIN_ID = ZCHAIN_ID_TEST_DEFAULT.toString();
    }

    // TODO multi: create a proper test for zkEVM bridge when not mocked !!!

    // L1 run
    configL1 = await getConfig({
      deployer: deployAdmin,
      zeroVaultAddress: deployAdmin.address,
    });

    // TODO multi: add logger message to show which network is campaign running on !!!
    const campaignL1 = await runZnsCampaign({ config: configL1 });

    ({
      state: {
        contracts: znsL1,
      },
      dbAdapter: dbAdapter1,
    } = campaignL1);

    resetMongoAdapter();

    process.env.SRC_CHAIN_NAME = SupportedChains.z;

    if (!isRealNetwork) {
      // set vars for ZChain ZNS deployment
      process.env.SRC_ZNS_PORTAL = znsL1.zChainPortal.target as string;
      process.env.NETWORK_ID = NETWORK_ID_L2_TEST_DEFAULT.toString();
      process.env.MONGO_DB_NAME = "zns-l2";
      // TODO multi: create zkEVM bridge tests for predeployed bridge !!!
      deployAdminL2 = deployAdmin;
      userL2 = user;
      subUserL2 = subUser;
    } else {
      const zChainProvider = new ethers.JsonRpcProvider(process.env.ZCHAINTEST_RPC_URL);
      deployAdminL2 = new ethers.Wallet(`0x${process.env.TESTNET_PRIVATE_KEY_A}`, zChainProvider);
      userL2 = new ethers.Wallet(`0x${process.env.TESTNET_PRIVATE_KEY_B}`, zChainProvider);
      subUserL2 = new ethers.Wallet(`0x${process.env.TESTNET_PRIVATE_KEY_C}`, zChainProvider);
      // swap to another DB where L2 contracts are located
      process.env.MONGO_DB_NAME = process.env.MONGO_DB_NAME_DEST as string;
      process.env.MONGO_DB_VERSION = process.env.MONGO_DB_VERSION_DEST;
    }

    // L2 run
    configL2 = await getConfig({
      deployer: deployAdminL2,
      zeroVaultAddress: deployAdminL2.address,
    });

    // emulating L2 here by deploying to the same network
    const campaignL2 = await runZnsCampaign({ config: configL2 });

    ({
      state: {
        contracts: znsL2,
      },
      dbAdapter: dbAdapter2,
    } = campaignL2);
  });

  after(async () => {
    await dbAdapter1.dropDB();
    await dbAdapter2.dropDB();
    setDefaultEnvironment();
  });

  it("should NOT allow to register root domain on ZChain", async () => {
    await expect(
      registrationWithSetup({
        zns: znsL2,
        user: deployAdminL2,
        parentHash: hre.ethers.ZeroHash,
        domainLabel: "domainlabeltoberejected",
        fullConfig: fullDistrConfigEmpty,
      })
      // this function does not exist on the RootRegistrarBranch contract, so it fails with this error
    ).to.be.rejectedWith("registerRootDomain is not a function");
  });

  // TODO multi: Separate these into a different file that can work with real test networks and properly
  //  run one flow at a time (bridge vs claim) !!!
  //  And leave more regular tests here that can run on local Hardhat network !
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

          // register and bridge
          await approveForDomain({
            zns: znsL1,
            parentHash: parentHash as string,
            user,
            domainLabel: label,
            isBridging: true,
          });

          balanceBeforeBridge = await znsL1.meowToken.balanceOf(user.address);

          const tx = await znsL1.zChainPortal.connect(user).registerAndBridgeDomain(
            parentHash as string,
            label,
            DEFAULT_TOKEN_URI
          );
          const receipt = await tx.wait(getConfirmationsNumber()) as ContractTransactionReceipt;
          console.log(`Gas used for ${name} bridging: ${receipt.gasUsed.toString()}`);

          domainHash = await getDomainHashFromEvent({
            zns: znsL1,
            registrantAddress: znsL1.zChainPortal.target as string,
          });
        });

        // TODO multi: test all reverts and failures properly !!!
        describe("Bridge and Register on L1", () => {
          // eslint-disable-next-line max-len
          it("should register and set owners as ZkEvmPortal and fire DomainBridged and BridgeEvent events", async () => {
            // check if domain is registered on L1
            // check events
            const events = await getEvents({
              contract: znsL1.zChainPortal,
              eventName: "DomainBridged",
            });
            const event = events[events.length - 1];
            expect(event.args.domainHash).to.equal(domainHash);
            expect(event.args.destNetworkId).to.equal(NETWORK_ID_L2_TEST_DEFAULT);
            expect(event.args.destPortalAddress).to.equal(znsL2.ethPortal.target);
            expect(event.args.domainOwner).to.equal(user.address);

            const bridgeEvents = await getEvents({
              contract: znsL1.zkEvmBridge,
              eventName: "BridgeEvent",
            });
            ({ args: bridgedEventData } = bridgeEvents[bridgeEvents.length - 1]);

            // this is here so we can use this data to do an API call to get the proof
            if (isRealNetwork) console.log("Bridged Event Data:", bridgedEventData);

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

            expect(bridgedEventData.originNetwork).to.equal(NETWORK_ID_L1_TEST_DEFAULT);
            expect(bridgedEventData.originAddress).to.equal(znsL1.zChainPortal.target);
            expect(bridgedEventData.destinationNetwork).to.equal(NETWORK_ID_L2_TEST_DEFAULT);
            expect(bridgedEventData.destinationAddress).to.equal(znsL2.ethPortal.target);
            expect(bridgedEventData.amount).to.equal(0n);
            expect(bridgedEventData.metadata).to.equal(metadataRef);

            // check owner and resolver are set properly
            const {
              owner: ownerL1,
              resolver: resolverL1,
            } = await znsL1.registry.getDomainRecord(domainHash);
            expect(ownerL1).to.equal(znsL1.zChainPortal.target);
            expect(resolverL1).to.equal(znsL1.chainResolver.target);

            const tokenOwner = await znsL1.domainToken.ownerOf(BigInt(domainHash));
            expect(tokenOwner).to.equal(znsL1.zChainPortal.target);
          });

          it("should withdraw the correct amount of tokens from the caller", async () => {
            const balanceAfterBridge = await znsL1.meowToken.balanceOf(user.address);

            const priceConfig = isRealNetwork ? getValidateRootPriceConfig() : DEFAULT_PRICE_CONFIG;
            const priceRef = getCurvePrice(label, priceConfig);
            const protocolFeeRef = getStakingOrProtocolFee(priceRef);

            // TODO multi: error here!
            // AssertionError: expected 4524647947000000000000 to equal 9292717980000000000000.
            // + expected - actual
            //
            // -4524647947000000000000
            // +9292717980000000000000

            expect(balanceBeforeBridge - balanceAfterBridge).to.equal(priceRef + protocolFeeRef);
          });

          it("should set configs as empty during bridging", async () => {
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
            expect(chainData.chainId).to.equal(ZCHAIN_ID_TEST_DEFAULT);
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

        // TODO multi: for real network run add code to get the proof from the API!!!
        describe("Claim Bridged Domain on L2", () => {
          it("should #claimMessage() on the bridge successfully and fire a ClaimEvent", async () => {
            const claimArgs = !isRealNetwork
              ? [
                dummySmtProof,
                dummySmtProof,
                bridgedEventData.depositCount,
                dummySmtProof[0],
                dummySmtProof[1],
                bridgedEventData.originNetwork,
                bridgedEventData.originAddress,
                bridgedEventData.destinationNetwork,
                bridgedEventData.destinationAddress,
                bridgedEventData.amount,
                bridgedEventData.metadata,
              ]
              : await getClaimArgsFromApi({
                // when running on a real network provide this data to be able to run the test !
                // depositCnt: name === "Root Domain" ? "15" : "16",
              });

            // **NOTE** that we connect as `deployAdmin` here to show that it's not
            // required that this has to be called by the original owner,
            // it can be called by anyone

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const tx = await znsL2.zkEvmBridge.connect(deployAdminL2).claimMessage(...claimArgs);
            await tx.wait(getConfirmationsNumber());

            const events = await getEvents({
              contract: znsL2.zkEvmBridge,
              eventName: "ClaimEvent",
            });
            const event = events[events.length - 1];
            expect(event.args.originNetwork).to.equal(NETWORK_ID_L1_TEST_DEFAULT);
            expect(event.args.originAddress).to.equal(znsL1.zChainPortal.target);
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
            expect(event.args.srcNetworkId).to.equal(NETWORK_ID_L1_TEST_DEFAULT);
            expect(event.args.srcPortalAddress).to.equal(znsL1.zChainPortal.target);
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

            const confNum = getConfirmationsNumber();

            // set configs
            const distrConfigToSet = {
              accessType: AccessType.OPEN,
              paymentType: PaymentType.DIRECT,
              pricerContract: znsL2.fixedPricer.target,
            };
            let tx = await znsL2.subRegistrar.connect(userL2).setDistributionConfigForDomain(
              domainHash,
              distrConfigToSet,
            );
            await tx.wait(confNum);

            const paymentConfigToSet = {
              token: znsL2.meowToken.target,
              beneficiary: user.address,
            };
            tx = await znsL2.treasury.connect(userL2).setPaymentConfig(
              domainHash,
              paymentConfigToSet,
            );
            await tx.wait(confNum);

            const priceToSet = 100n;
            tx = await znsL2.fixedPricer.connect(userL2).setPrice(domainHash, priceToSet);
            await tx.wait(confNum);

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
            // make sure subdomains can be registered now
            const subdomainHash = await registrationWithSetup({
              zns: znsL2,
              user: subUserL2,
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
            expect(event.args.registrant).to.equal(subUserL2.address);
            expect(event.args.domainAddress).to.equal(subUserL2.address);

            // check if subdomain is registered
            const record = await znsL2.registry.getDomainRecord(subdomainHash);
            expect(record.owner).to.equal(subUserL2.address);
            expect(record.resolver).to.equal(znsL2.addressResolver.target);

            const tokenOwner = await znsL2.domainToken.ownerOf(BigInt(subdomainHash));
            expect(tokenOwner).to.equal(subUserL2.address);
          });
        });
      });
    });

  // TODO multi: separate all these into different files
  // We will only run this on local Hardhat network
  if (!isRealNetwork) {
    describe("Unit Tests", () => {
      describe("ZNSZChainPortal", () => {
        it("#initialize() should revert when trying to reinitialize", async () => {
          await expect(
            znsL1.zChainPortal.initialize(
              "1",
              "Z",
              "1",
              hre.ethers.ZeroAddress,
              {
                accessController: znsL1.accessController.target,
                registry: znsL1.registry.target,
                chainResolver: znsL1.chainResolver.target,
                treasury: znsL1.treasury.target,
                rootRegistrar: znsL1.rootRegistrar.target,
                subRegistrar: znsL1.subRegistrar.target,
              },
            )
          ).to.be.revertedWithCustomError(znsL1.zChainPortal, INITIALIZED_ERR);
        });

        it("#setDestZnsPortal() should revert when called by non-ADMIN", async () => {
          await expect(
            znsL1.zChainPortal.connect(user).setDestZnsPortal(znsL2.ethPortal.target)
          ).to.be.revertedWithCustomError(znsL1.accessController, AC_UNAUTHORIZED_ERR);
        });

        it("#setDestZnsPortal() should revert when setting 0x0 address", async () => {
          await expect(
            znsL1.zChainPortal.connect(deployAdmin).setDestZnsPortal(hre.ethers.ZeroAddress)
          ).to.be.revertedWithCustomError(znsL1.zChainPortal, ZERO_ADDRESS_ERR);
        });

        it("#setDestZnsPortal() should set the destination portal address", async () => {
          await znsL1.zChainPortal.connect(deployAdmin).setDestZnsPortal(user.address);

          const destPortal = await znsL1.zChainPortal.destZnsPortal();
          expect(destPortal).to.equal(user.address);

          // set back to L2 portal address
          await znsL1.zChainPortal.connect(deployAdmin).setDestZnsPortal(znsL2.ethPortal.target);
        });
      });

      describe("ZNSEthereumPortal", () => {
        it("#initialize() should revert when trying to reinitialize", async () => {
          await expect(
            znsL2.ethPortal.connect(deployAdmin).initialize(
              znsL2.accessController.target,
              znsL2.zkEvmBridge.target,
              znsL1.zChainPortal.target,
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
          // this will fail with MessageFailed error from the Bridge since it does a `.call()` internally
          await expect(
            // this will call onMessageReceived(), we have to do it like this to avoid
            // reverting on the `InvalidCaller` check
            znsL2.zkEvmBridge.claimMessage(
              dummySmtProof,
              dummySmtProof,
              bridgedEventData.depositCount,
              dummySmtProof[0],
              dummySmtProof[1],
              bridgedEventData.originNetwork,
              znsL2.registry.target,
              bridgedEventData.destinationNetwork,
              bridgedEventData.destinationAddress,
              bridgedEventData.amount,
              bridgedEventData.metadata,
            )
          ).to.be.revertedWithCustomError(znsL2.zkEvmBridge, MESSAGE_FAILED_ERR);
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
              bridgedEventData.depositCount,
              dummySmtProof[0],
              dummySmtProof[1],
              bridgedEventData.originNetwork,
              bridgedEventData.originAddress,
              bridgedEventData.destinationNetwork,
              bridgedEventData.destinationAddress,
              bridgedEventData.amount,
              wrongMetadata,
            )
          ).to.be.revertedWithCustomError(znsL2.zkEvmBridge, MESSAGE_FAILED_ERR);
        });
      });
    });
  }
});
