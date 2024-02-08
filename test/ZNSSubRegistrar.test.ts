import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Coupon, IDomainConfigForTest, IFixedPriceConfig, IPathRegResult, IZNSContractsLocal } from "./helpers/types";
import {
  AccessType,
  ADMIN_ROLE,
  DEFAULT_TOKEN_URI,
  deployZNS,
  distrConfigEmpty,
  DISTRIBUTION_LOCKED_NOT_EXIST_ERR,
  fullDistrConfigEmpty,
  getAccessRevertMsg,
  getPriceObject,
  getStakingOrProtocolFee,
  GOVERNOR_ROLE,
  INITIALIZED_ERR,
  INVALID_NAME_ERR,
  INVALID_TOKENID_ERC_ERR, NO_BENEFICIARY_ERR,
  ONLY_NAME_OWNER_REG_ERR, paymentConfigEmpty,
  PaymentType,
  DECAULT_PRECISION,
  DEFAULT_PRICE_CONFIG,
  validateUpgrade,
  INVALID_MINTLIST_CLAIM_ERR,
  createCouponSignature,
} from "./helpers";
import * as hre from "hardhat";
import * as ethers from "ethers";
import { expect } from "chai";
import { registerDomainPath, validatePathRegistration } from "./helpers/flows/registration";
import assert from "assert";
import { defaultSubdomainRegistration, registrationWithSetup } from "./helpers/register-setup";
import { getDomainHashFromEvent } from "./helpers/events";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
  CustomDecimalTokenMock,
  ZNSSubRegistrar,
  ZNSSubRegistrar__factory,
  ZNSSubRegistrarUpgradeMock,
  ZNSSubRegistrarUpgradeMock__factory,
} from "../typechain";
import { deployCustomDecToken } from "./helpers/deploy/mocks";
import { getProxyImplAddress } from "./helpers/utils";


describe("ZNSSubRegistrar", () => {
  let deployer: SignerWithAddress;
  let rootOwner: SignerWithAddress;
  let governor: SignerWithAddress;
  let admin: SignerWithAddress;
  let lvl2SubOwner: SignerWithAddress;
  let lvl3SubOwner: SignerWithAddress;
  let lvl4SubOwner: SignerWithAddress;
  let lvl5SubOwner: SignerWithAddress;
  let lvl6SubOwner: SignerWithAddress;
  let branchLvl1Owner: SignerWithAddress;
  let branchLvl2Owner: SignerWithAddress;
  let random: SignerWithAddress;
  let operator: SignerWithAddress;
  let multiOwner: SignerWithAddress;

  let zns: IZNSContractsLocal;
  let zeroVault: SignerWithAddress;

  describe("Single Subdomain Registration", () => {
    let rootHash: string;
    let rootWithMintlistHash: string;
    let rootPriceConfig: IFixedPriceConfig;
    const subTokenURI = "https://token-uri.com/8756a4b6f";

    // Address of the EIP712 helper contract
    let helperAddress: string;
    let eip712Domain: ethers.TypedDataDomain;
    let eip712Types: {
      [key: string]: Array<{ name: string, type: string }>;
    }

    beforeEach(async () => {
      [
        deployer,
        zeroVault,
        governor,
        admin,
        rootOwner,
        lvl2SubOwner,
        lvl3SubOwner
      ] = await hre.ethers.getSigners();
      // zeroVault address is used to hold the fee charged to the user when registering
      zns = await deployZNS({
        deployer,
        governorAddresses: [deployer.address, governor.address],
        adminAddresses: [admin.address],
        priceConfig: DEFAULT_PRICE_CONFIG,
        zeroVaultAddress: zeroVault.address,
      });
      // Give funds to users
      await Promise.all(
        [
          rootOwner,
          lvl2SubOwner,
          lvl3SubOwner,
        ].map(async ({ address }) =>
          zns.meowToken.mint(address, ethers.parseEther("100000000000")))
      );
      await zns.meowToken.connect(rootOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
      await zns.meowToken.connect(lvl3SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      rootPriceConfig = {
        price: ethers.parseEther("1375.612"),
        feePercentage: BigInt(0),
      };

      // register root domain
      rootHash = await registrationWithSetup({
        zns,
        user: rootOwner,
        domainLabel: "root",
        fullConfig: {
          distrConfig: {
            accessType: AccessType.OPEN,
            pricerContract: await zns.fixedPricer.getAddress(),
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
          priceConfig: rootPriceConfig,
        },
      });

      rootWithMintlistHash = await registrationWithSetup({
        zns,
        user: rootOwner,
        domainLabel: "root-mint",
        fullConfig: {
          distrConfig: {
            accessType: AccessType.MINTLIST,
            pricerContract: await zns.fixedPricer.getAddress(),
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
          priceConfig: rootPriceConfig,
        },
      });

      // TODO add helper contract to campaign, then can access as
      // `zns.eip712Helper.address`
      helperAddress = await zns.subRegistrar.getEIP712AHelperAddress();

    });

    it("Recovers the correct address with valid data", async () => {
      const coupon: Coupon = {
        parentHash: rootWithMintlistHash,
        registrantAddress: lvl2SubOwner.address,
        domainLabel: "label",
      }

      const signed = await createCouponSignature(
        coupon.parentHash,
        coupon.registrantAddress,
        coupon.domainLabel,
        helperAddress,
        rootOwner
      );

      const address = await zns.subRegistrar.recoverSigner(coupon, signed);
      expect(address).to.eq(rootOwner.address);
    });

    it("Registers a subdomain in a mintlist", async () => {
      const sub = "coupon-mintlist-label";
      const signed = await createCouponSignature(
        rootWithMintlistHash,
        lvl2SubOwner.address,
        sub,
        helperAddress,
        rootOwner
      );

      const tx = zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
        {
          parentHash: rootWithMintlistHash,
          label: sub,
          domainAddress: lvl2SubOwner.address,
          tokenURI: subTokenURI,
        },
        distrConfigEmpty,
        paymentConfigEmpty,
        signed
      );

      expect(await tx).to.not.be.reverted;

      const hash = await getDomainHashFromEvent({
        zns,
        user: lvl2SubOwner,
      });

      expect(await zns.registry.exists(hash)).to.be.true;
    });

    it("Fails to register when caller is not in signed typed data", async () => {
      const label = "failing-mintlist";

      const signed = await createCouponSignature(
        rootWithMintlistHash,
        lvl2SubOwner.address,
        label,
        helperAddress,
        rootOwner
      );

      // Users cannot use coupons that weren't signed for them
      const tx = zns.subRegistrar.connect(lvl3SubOwner).registerSubdomain(
        {
          parentHash: rootWithMintlistHash,
          label: label,
          domainAddress: lvl2SubOwner.address,
          tokenURI: subTokenURI,
        },
        distrConfigEmpty,
        paymentConfigEmpty,
        signed,
      );

      await expect(tx).to.be.revertedWith(INVALID_MINTLIST_CLAIM_ERR)
    });

    it("Fails to register when using a coupon that's already been used", async () => {
      const label = "my-mint-label"

      const signed = await createCouponSignature(
        rootWithMintlistHash,
        lvl2SubOwner.address,
        label,
        helperAddress,
        rootOwner,
      );

      const tx = zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
        {
          parentHash: rootWithMintlistHash,
          label: label,
          domainAddress: lvl2SubOwner.address,
          tokenURI: subTokenURI,
        },
        distrConfigEmpty,
        paymentConfigEmpty,
        signed
      );

      await expect(tx).to.not.be.reverted;

      // Try to register again with the coupon we just used for a new domain
      // The same domain label will fail because of the `registry.exists` check
      // already in place
      const txReuse = zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
        {
          parentHash: rootWithMintlistHash,
          label: "diff-new-label",
          domainAddress: lvl2SubOwner.address,
          tokenURI: subTokenURI,
        },
        distrConfigEmpty,
        paymentConfigEmpty,
        signed
      );

      await expect(txReuse).to.be.revertedWith(INVALID_MINTLIST_CLAIM_ERR);
    });

    it("Fails to register when using the wrong domain hash", async () => {
      const label = "uniquelabel";
      const signed = await createCouponSignature(
        rootHash,
        lvl2SubOwner.address,
        label,
        helperAddress,
        rootOwner,
      );

      const tx = zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
        {
          parentHash: rootWithMintlistHash,
          label: label,
          domainAddress: lvl2SubOwner.address,
          tokenURI: subTokenURI,
        },
        distrConfigEmpty,
        paymentConfigEmpty,
        signed
      );

      await expect(tx).to.be.revertedWith(INVALID_MINTLIST_CLAIM_ERR)
    });

    it("Fails to register when the parent domain is locked", async () => {

      await zns.subRegistrar.connect(rootOwner).setAccessTypeForDomain(rootWithMintlistHash, AccessType.LOCKED);

      const label = "moreuniquelabel";
      const signed = await createCouponSignature(
        rootWithMintlistHash,
        lvl2SubOwner.address,
        label,
        helperAddress,
        rootOwner,
      );

      const tx = zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
        {
          parentHash: rootWithMintlistHash,
          label: label,
          domainAddress: lvl2SubOwner.address,
          tokenURI: subTokenURI,
        },
        distrConfigEmpty,
        paymentConfigEmpty,
        signed
      );

      await expect(tx).to.be.revertedWith(DISTRIBUTION_LOCKED_NOT_EXIST_ERR);

      // Reset
      await zns.subRegistrar.connect(rootOwner).setAccessTypeForDomain(rootWithMintlistHash, AccessType.MINTLIST);
    });

    it("Fails to register when the parent domain has been revoked", async () => {
      await zns.rootRegistrar.connect(rootOwner).revokeDomain(rootWithMintlistHash);

      const label = "moreuniquelabel";
      const signed = await createCouponSignature(
        rootWithMintlistHash,
        lvl2SubOwner.address,
        label,
        helperAddress,
        rootOwner,
      );

      const tx = zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
        {
          parentHash: rootWithMintlistHash,
          label: label,
          domainAddress: lvl2SubOwner.address,
          tokenURI: subTokenURI,
        },
        distrConfigEmpty,
        paymentConfigEmpty,
        signed
      );

      await expect(tx).to.be.revertedWith(DISTRIBUTION_LOCKED_NOT_EXIST_ERR);

      // Reset by re-registering the domain
      rootWithMintlistHash = await registrationWithSetup({
        zns,
        user: rootOwner,
        domainLabel: "root-mint",
        fullConfig: {
          distrConfig: {
            accessType: AccessType.MINTLIST,
            pricerContract: await zns.fixedPricer.getAddress(),
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
          priceConfig: rootPriceConfig,
        },
      });
    });

    it("Owners of both can register in a mintlist without a valid coupon", async () => {
      const label = "owner-unique-sub";

      const tx = zns.subRegistrar.connect(rootOwner).registerSubdomain(
        {
          parentHash: rootWithMintlistHash,
          label: label,
          domainAddress: lvl2SubOwner.address,
          tokenURI: subTokenURI,
        },
        distrConfigEmpty,
        paymentConfigEmpty,
        ethers.ZeroHash
      );

      await expect(tx).to.not.be.reverted;
    });

    it("Sets the payment config when given", async () => {
      const subdomain = "world-subdomain";

      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      await zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
        {
          parentHash: rootHash,
          label: subdomain,
          domainAddress: lvl2SubOwner.address,
          tokenURI: subTokenURI,
        },
        distrConfigEmpty,
        {
          token: await zns.meowToken.getAddress(),
          beneficiary: lvl2SubOwner.address,
        },
        ethers.ZeroHash
      );

      const subHash = await zns.subRegistrar.hashWithParent(rootHash, subdomain);
      const config = await zns.treasury.paymentConfigs(subHash);
      expect(config.token).to.eq(await zns.meowToken.getAddress());
      expect(config.beneficiary).to.eq(lvl2SubOwner.address);
    });

    it("Does not set the payment config when the beneficiary is the zero address", async () => {
      const subdomain = "not-world-subdomain";
      await expect(
        zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
          {
            parentHash: rootHash,
            label: subdomain,
            domainAddress: lvl2SubOwner.address,
            tokenURI: subTokenURI,
          },
          distrConfigEmpty,
          paymentConfigEmpty,
          ethers.ZeroHash
        )
      );

      const subHash = await zns.subRegistrar.hashWithParent(rootHash, subdomain);
      const config = await zns.treasury.paymentConfigs(subHash);
      expect(config.token).to.eq(ethers.ZeroAddress);
      expect(config.beneficiary).to.eq(ethers.ZeroAddress);
    });

    // eslint-disable-next-line max-len
    it("should revert when trying to register a subdomain before parent has set it's config with FixedPricer", async () => {
      // register a new root domain
      const newRootHash = await registrationWithSetup({
        zns,
        user: rootOwner,
        domainLabel: "rootunsetfixed",
        setConfigs: false,
        fullConfig: {
          distrConfig: {
            accessType: AccessType.OPEN,
            pricerContract: await zns.fixedPricer.getAddress(),
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
          priceConfig: {
            price: BigInt(0),
            feePercentage: BigInt(0),
          },
        },
      });

      await expect(
        zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
          {
            parentHash: newRootHash,
            label: "subunset",
            domainAddress: lvl2SubOwner.address,
            tokenURI: subTokenURI,
          },
          distrConfigEmpty,
          {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
          ethers.ZeroHash
        )
      ).to.be.revertedWith(
        "ZNSFixedPricer: parent's price config has not been set properly through IZNSPricer.setPriceConfig()"
      );
    });

    // eslint-disable-next-line max-len
    it("should revert when trying to register a subdomain before parent has set it's config with CurvePricer", async () => {
      // register a new root domain
      const newRootHash = await registrationWithSetup({
        zns,
        user: rootOwner,
        domainLabel: "rootunsetcurve",
        setConfigs: false,
        fullConfig: {
          distrConfig: {
            accessType: AccessType.OPEN,
            pricerContract: await zns.curvePricer.getAddress(),
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
          priceConfig: DEFAULT_PRICE_CONFIG,
        },
      });

      await expect(
        zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
          {
            parentHash: newRootHash,
            label: "subunset",
            domainAddress: lvl2SubOwner.address,
            tokenURI: subTokenURI,
          },
          distrConfigEmpty,
          paymentConfigEmpty,
          ethers.ZeroHash
        )
      ).to.be.revertedWith(
        "ZNSCurvePricer: parent's price config has not been set properly through IZNSPricer.setPriceConfig()"
      );
    });

    it("should register subdomain with the correct tokenURI assigned to the domain token minted", async () => {
      const subHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "sub",
        tokenURI: subTokenURI,
        fullConfig: {
          distrConfig: {
            accessType: AccessType.OPEN,
            pricerContract: await zns.fixedPricer.getAddress(),
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
          priceConfig: {
            price: ethers.parseEther("777.325"),
            feePercentage: BigInt(0),
          },
        },
      });

      const tokenId = BigInt(subHash).toString();
      const tokenURI = await zns.domainToken.tokenURI(tokenId);
      expect(tokenURI).to.eq(subTokenURI);
    });

    it("Can register a subdomain with characters [a-z0-9]", async () => {
      const alphaNumeric = "0x0dwidler0x0";

      // Add allowance
      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      // While "to.not.be.reverted" isn't really a full "test"
      // we don't emit a custom event here, only in the `rootRegistrar.coreRegister`
      // call. So we can't use the `.to.emit` syntax

      const signed = await createCouponSignature(
        rootHash,
        lvl2SubOwner.address,
        alphaNumeric,
        helperAddress,
        rootOwner
      );

      await expect(defaultSubdomainRegistration(
        {
          user: lvl2SubOwner,
          zns,
          parentHash: rootHash,
          subdomainLabel: alphaNumeric,
          domainContent: lvl2SubOwner.address,
          tokenURI: subTokenURI,
          distrConfig: distrConfigEmpty,
          signature: signed,
        }
      )).to.not.be.reverted;
    });

    it("Fails for a subdomain that uses any invalid characters", async () => {
      const nameA = "WILDER";
      const nameB = "!?w1Id3r!?";
      const nameC = "!%$#^*?!#👍3^29";
      const nameD = "wo.rld";

      let signature = await createCouponSignature(
        rootHash,
        lvl2SubOwner.address,
        nameA,
        helperAddress,
        rootOwner
      );

      await expect(defaultSubdomainRegistration(
        {
          user: lvl2SubOwner,
          zns,
          parentHash: rootHash,
          subdomainLabel: nameA,
          domainContent: lvl2SubOwner.address,
          tokenURI: subTokenURI,
          distrConfig: distrConfigEmpty,
          signature
        }
      )).to.be.revertedWith(INVALID_NAME_ERR);

      signature = await createCouponSignature(
        rootHash,
        lvl2SubOwner.address,
        nameB,
        helperAddress,
        rootOwner
      );

      await expect(defaultSubdomainRegistration(
        {
          user: lvl2SubOwner,
          zns,
          parentHash: rootHash,
          subdomainLabel: nameB,
          domainContent: lvl2SubOwner.address,
          tokenURI: subTokenURI,
          distrConfig: distrConfigEmpty,
          signature
        }
      )).to.be.revertedWith(INVALID_NAME_ERR);

      signature = await createCouponSignature(
        rootHash,
        lvl2SubOwner.address,
        nameC,
        helperAddress,
        rootOwner
      );

      await expect(defaultSubdomainRegistration(
        {
          user: lvl2SubOwner,
          zns,
          parentHash: rootHash,
          subdomainLabel: nameC,
          domainContent: lvl2SubOwner.address,
          tokenURI: subTokenURI,
          distrConfig: distrConfigEmpty,
          signature
        }
      )).to.be.revertedWith(INVALID_NAME_ERR);

      signature = await createCouponSignature(
        rootHash,
        lvl2SubOwner.address,
        nameD,
        helperAddress,
        rootOwner
      );

      await expect(defaultSubdomainRegistration(
        {
          user: lvl2SubOwner,
          zns,
          parentHash: rootHash,
          subdomainLabel: nameD,
          domainContent: lvl2SubOwner.address,
          tokenURI: subTokenURI,
          distrConfig: distrConfigEmpty,
          signature
        }
      )).to.be.revertedWith(INVALID_NAME_ERR);
    });

    it("should revert when trying to register a subdomain under a non-existent parent", async () => {
      // check that 0x0 hash can NOT be passed as parentHash
      await expect(
        zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
          {
            parentHash: ethers.ZeroHash,
            label: "sub",
            domainAddress: lvl2SubOwner.address,
            tokenURI: subTokenURI,
          },
          distrConfigEmpty,
          paymentConfigEmpty,
          ethers.ZeroHash
        )
      ).to.be.revertedWith(
        DISTRIBUTION_LOCKED_NOT_EXIST_ERR
      );

      // check that a random non-existent hash can NOT be passed as parentHash
      const randomHash = ethers.keccak256(ethers.toUtf8Bytes("random"));
      await expect(
        zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
          {
            parentHash: randomHash,
            label: "sub",
            domainAddress: lvl2SubOwner.address,
            tokenURI: subTokenURI,
          },
          distrConfigEmpty,
          paymentConfigEmpty,
          ethers.ZeroHash
        )
      ).to.be.revertedWith(
        DISTRIBUTION_LOCKED_NOT_EXIST_ERR
      );
    });

    it("should register subdomain with a single char label", async () => {
      const subHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "a",
        tokenURI: subTokenURI,
        fullConfig: {
          distrConfig: {
            accessType: AccessType.OPEN,
            pricerContract: await zns.fixedPricer.getAddress(),
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
          priceConfig: {
            price: ethers.parseEther("777.325"),
            feePercentage: BigInt(0),
          },
        },
      });

      const tokenId = BigInt(subHash).toString();
      const tokenURI = await zns.domainToken.tokenURI(tokenId);
      expect(tokenURI).to.eq(subTokenURI);

      // check registry
      const dataFromReg = await zns.registry.getDomainRecord(subHash);
      expect(dataFromReg.owner).to.eq(lvl2SubOwner.address);
      expect(dataFromReg.resolver).to.eq(await zns.addressResolver.getAddress());
    });

    // ! this value can change based on the block gas limit !
    it("should register subdomain with a label length of 100000 chars", async () => {
      const subHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "a".repeat(100000),
        tokenURI: subTokenURI,
        fullConfig: fullDistrConfigEmpty,
      });

      const tokenId = BigInt(subHash).toString();
      const tokenURI = await zns.domainToken.tokenURI(tokenId);
      expect(tokenURI).to.eq(subTokenURI);

      // check registry
      const dataFromReg = await zns.registry.getDomainRecord(subHash);
      expect(dataFromReg.owner).to.eq(lvl2SubOwner.address);
      expect(dataFromReg.resolver).to.eq(await zns.addressResolver.getAddress());
    });

    it("should revert when user has insufficient funds", async () => {
      const label = "subinsufficientfunds";
      const { expectedPrice } = getPriceObject(label, rootPriceConfig);
      const userBalanceBefore = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const userBalanceAfter = userBalanceBefore - expectedPrice;
      await zns.meowToken.connect(lvl2SubOwner).transfer(deployer.address, userBalanceAfter);

      // add allowance
      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      await expect(
        zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
          {
            parentHash: rootHash,
            label: label,
            domainAddress: lvl2SubOwner.address,
            tokenURI: subTokenURI,
          },
          distrConfigEmpty,
          paymentConfigEmpty,
          ethers.ZeroHash
        )
      ).to.be.revertedWith(
        "ERC20: transfer amount exceeds balance"
      );

      // transfer back for other tests
      await zns.meowToken.connect(deployer).transfer(lvl2SubOwner.address, userBalanceAfter);
    });

    it("should revert when user has insufficient allowance", async () => {
      const label = "subinsufficientallowance";
      const { expectedPrice } = getPriceObject(label, rootPriceConfig);

      // add allowance
      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), expectedPrice - 1n);

      await expect(
        zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
          {
            parentHash: rootHash,
            label: label,
            domainAddress: lvl2SubOwner.address,
            tokenURI: subTokenURI,
          },
          distrConfigEmpty,
          paymentConfigEmpty,
          ethers.ZeroAddress
        )
      ).to.be.revertedWith(
        "ERC20: insufficient allowance"
      );
    });

    it("should revert on payment when parent's beneficiary has not yet been set and when stakeFee is > 0", async () => {
      // register a new parent with direct payment and no payment config
      const parentHash1 = await registrationWithSetup({
        zns,
        user: rootOwner,
        domainLabel: "parentnoconfigdirect",
        fullConfig: {
          distrConfig: {
            accessType: AccessType.OPEN,
            pricerContract: await zns.fixedPricer.getAddress(),
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: paymentConfigEmpty,
          priceConfig: rootPriceConfig,
        },
      });

      // set the token address
      await zns.treasury.connect(rootOwner).setPaymentToken(parentHash1, await zns.meowToken.getAddress());

      // register a new parent with stake payment and no payment config
      const parentHash2 = await registrationWithSetup({
        zns,
        user: rootOwner,
        domainLabel: "parentnoconfigstake",
        fullConfig: {
          distrConfig: {
            accessType: AccessType.OPEN,
            pricerContract: await zns.curvePricer.getAddress(),
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: paymentConfigEmpty,
          priceConfig: DEFAULT_PRICE_CONFIG,
        },
      });

      // set the token address
      await zns.treasury.connect(rootOwner).setPaymentToken(parentHash2, await zns.meowToken.getAddress());

      // register subdomains under new parents
      await expect(
        registrationWithSetup({
          zns,
          user: lvl2SubOwner,
          parentHash: parentHash1,
          domainLabel: "sub1",
        })
      ).to.be.revertedWith(NO_BENEFICIARY_ERR);

      await expect(
        registrationWithSetup({
          zns,
          user: lvl2SubOwner,
          parentHash: parentHash2,
          domainLabel: "sub2",
        })
      ).to.be.revertedWith(NO_BENEFICIARY_ERR);

      // change stakeFee to 0
      await zns.curvePricer.connect(rootOwner).setFeePercentage(
        parentHash2,
        BigInt(0)
      );

      // try register a subdomain again
      const subHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: parentHash2,
        domainLabel: "sub2",
      });

      await zns.registry.exists(subHash);
    });
  });

  describe("Operations within domain paths", () => {
    let domainConfigs: Array<IDomainConfigForTest>;
    let regResults: Array<IPathRegResult>;
    let helperAddress: string;

    const fixedPrice = ethers.parseEther("1375.612");
    const fixedFeePercentage = BigInt(200);

    before(async () => {
      [
        deployer,
        zeroVault,
        governor,
        admin,
        rootOwner,
        lvl2SubOwner,
        lvl3SubOwner,
        lvl4SubOwner,
        lvl5SubOwner,
        lvl6SubOwner,
        branchLvl1Owner,
        branchLvl2Owner,
        multiOwner,
      ] = await hre.ethers.getSigners();
      // zeroVault address is used to hold the fee charged to the user when registering
      zns = await deployZNS({
        deployer,
        governorAddresses: [deployer.address, governor.address],
        adminAddresses: [admin.address],
        priceConfig: DEFAULT_PRICE_CONFIG,
        zeroVaultAddress: zeroVault.address,
      });

      // Give funds to users
      await Promise.all(
        [
          rootOwner,
          lvl2SubOwner,
          lvl3SubOwner,
          lvl4SubOwner,
          lvl5SubOwner,
          lvl6SubOwner,
          branchLvl1Owner,
          branchLvl2Owner,
          multiOwner,
        ].map(async ({ address }) =>
          zns.meowToken.mint(address, ethers.parseEther("1000000")))
      );
      await zns.meowToken.connect(rootOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      helperAddress = await zns.subRegistrar.getEIP712AHelperAddress();

      domainConfigs = [
        {
          user: rootOwner,
          domainLabel: "root",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: rootOwner.address,
            },
            priceConfig: { price: fixedPrice, feePercentage: BigInt(0) },
          },
        },
        {
          user: lvl2SubOwner,
          domainLabel: "lvltwo",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.curvePricer.getAddress(),
              paymentType: PaymentType.STAKE,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: lvl2SubOwner.address,
            },
            priceConfig: DEFAULT_PRICE_CONFIG,
          },
        },
        {
          user: lvl3SubOwner,
          domainLabel: "lvlthree",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.curvePricer.getAddress(),
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: lvl3SubOwner.address,
            },
            priceConfig: DEFAULT_PRICE_CONFIG,
          },
        },
        {
          user: lvl4SubOwner,
          domainLabel: "lvlfour",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.curvePricer.getAddress(),
              paymentType: PaymentType.STAKE,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: lvl4SubOwner.address,
            },
            priceConfig: DEFAULT_PRICE_CONFIG,

          },
        },
        {
          user: lvl5SubOwner,
          domainLabel: "lvlfive",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: lvl5SubOwner.address,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },

          },
        },
        {
          user: lvl6SubOwner,
          domainLabel: "lvlsix",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.curvePricer.getAddress(),
              paymentType: PaymentType.STAKE,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: lvl6SubOwner.address,
            },
            priceConfig: DEFAULT_PRICE_CONFIG,
          },
        },
      ];

      regResults = await registerDomainPath({
        zns,
        domainConfigs,
      });

      assert.equal(regResults.length, domainConfigs.length);
    });

    it("should register a path of 6 domains with different configs", async () => {
      await validatePathRegistration({
        zns,
        domainConfigs,
        regResults,
      });
    });

    it("should be able to register multiple domains under multiple levels for the same owner", async () => {
      const configs = [
        {
          user: multiOwner,
          domainLabel: "multiownerdomone",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              accessType: AccessType.OPEN,
              paymentType: PaymentType.DIRECT,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: multiOwner.address,
            },
            priceConfig: { price: fixedPrice, feePercentage: BigInt(0) },
          },
        },
        {
          user: multiOwner,
          domainLabel: "multiownerdomtwo",
          parentHash: regResults[0].domainHash,
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.curvePricer.getAddress(),
              accessType: AccessType.LOCKED,
              paymentType: PaymentType.STAKE,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: zeroVault.address,
            },
            priceConfig: DEFAULT_PRICE_CONFIG,
          },
        },
        {
          user: multiOwner,
          domainLabel: "multiownerdomthree",
          parentHash: regResults[1].domainHash,
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.curvePricer.getAddress(),
              accessType: AccessType.MINTLIST,
              paymentType: PaymentType.DIRECT,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: multiOwner.address,
            },
            priceConfig: DEFAULT_PRICE_CONFIG,
          },
        },
        {
          user: multiOwner,
          domainLabel: "multiownerdomfour",
          parentHash: regResults[2].domainHash,
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              accessType: AccessType.OPEN,
              paymentType: PaymentType.STAKE,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: zeroVault.address,
            },
            priceConfig: { price: fixedPrice, feePercentage: BigInt(0) },
          },
        },
        {
          user: multiOwner,
          domainLabel: "multiownerdomfive",
          parentHash: regResults[3].domainHash,
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.curvePricer.getAddress(),
              accessType: AccessType.OPEN,
              paymentType: PaymentType.DIRECT,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: multiOwner.address,
            },
            priceConfig: DEFAULT_PRICE_CONFIG,
          },
        },
        {
          user: multiOwner,
          domainLabel: "multiownerdomsix",
          parentHash: regResults[4].domainHash,
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.curvePricer.getAddress(),
              accessType: AccessType.OPEN,
              paymentType: PaymentType.STAKE,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: zeroVault.address,
            },
            priceConfig: DEFAULT_PRICE_CONFIG,
          },
        },
        {
          user: multiOwner,
          domainLabel: "multiownerdomseven",
          parentHash: regResults[5].domainHash,
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              accessType: AccessType.OPEN,
              paymentType: PaymentType.DIRECT,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: multiOwner.address,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
          },
        },
      ];

      // prep
      await zns.meowToken.connect(multiOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      // register
      const domainHashes = await configs.reduce(
        async (
          acc: Promise<Array<string>>,
          {
            user,
            parentHash,
            domainLabel,
            fullConfig,
          }): Promise<Array<string>> => {
          const newAcc = await acc;

          const newHash = await registrationWithSetup({
            zns,
            user,
            parentHash,
            domainLabel,
            fullConfig,
          });

          return [...newAcc, newHash];
        }, Promise.resolve([])
      );

      // check
      await domainHashes.reduce(
        async (acc, domainHash, idx) => {
          await acc;
          const { owner, resolver } = await zns.registry.getDomainRecord(domainHash);
          expect(owner).to.eq(multiOwner.address);
          expect(resolver).to.eq(await zns.addressResolver.getAddress());

          const tokenId = BigInt(domainHash).toString();
          const tokenOwner = await zns.domainToken.ownerOf(tokenId);
          expect(tokenOwner).to.eq(multiOwner.address);

          const {
            pricerContract,
            accessType,
            paymentType,
          } = await zns.subRegistrar.distrConfigs(domainHash);
          expect(pricerContract).to.eq(configs[idx].fullConfig.distrConfig.pricerContract);
          expect(accessType).to.eq(configs[idx].fullConfig.distrConfig.accessType);
          expect(paymentType).to.eq(configs[idx].fullConfig.distrConfig.paymentType);

          const {
            token,
            beneficiary,
          } = await zns.treasury.paymentConfigs(domainHash);
          expect(token).to.eq(configs[idx].fullConfig.paymentConfig.token);
          expect(beneficiary).to.eq(configs[idx].fullConfig.paymentConfig.beneficiary);

          const domainAddress = await zns.addressResolver.resolveDomainAddress(domainHash);
          expect(domainAddress).to.eq(multiOwner.address);
        }, Promise.resolve()
      );
    });

    it("should revoke lvl 6 domain without refund and lock registration", async () => {
      const domainHash = regResults[5].domainHash;

      const userBalBefore = await zns.meowToken.balanceOf(lvl6SubOwner.address);

      await zns.rootRegistrar.connect(lvl6SubOwner).revokeDomain(
        domainHash,
      );

      const userBalAfter = await zns.meowToken.balanceOf(lvl6SubOwner.address);

      expect(userBalAfter - userBalBefore).to.eq(0);

      // make sure that accessType has been set to LOCKED
      // and nobody can register a subdomain under this domain
      const { accessType: accessTypeFromSC } = await zns.subRegistrar.distrConfigs(domainHash);
      expect(accessTypeFromSC).to.eq(AccessType.LOCKED);

      await expect(
        zns.subRegistrar.connect(lvl6SubOwner).registerSubdomain(
          {
            parentHash: domainHash,
            label: "newsubdomain",
            domainAddress: lvl6SubOwner.address,
            tokenURI: DEFAULT_TOKEN_URI,
          },
          distrConfigEmpty,
          paymentConfigEmpty,
          ethers.ZeroHash
        )
      ).to.be.revertedWith(
        DISTRIBUTION_LOCKED_NOT_EXIST_ERR
      );

      const dataFromReg = await zns.registry.getDomainRecord(domainHash);
      expect(dataFromReg.owner).to.eq(ethers.ZeroAddress);
      expect(dataFromReg.resolver).to.eq(ethers.ZeroAddress);

      const tokenId = BigInt(domainHash).toString();
      await expect(
        zns.domainToken.ownerOf(tokenId)
      ).to.be.revertedWith(
        INVALID_TOKENID_ERC_ERR
      );

      await expect(
        zns.registry.connect(lvl6SubOwner).updateDomainRecord(domainHash, rootOwner.address, lvl6SubOwner.address)
      ).to.be.revertedWith(ONLY_NAME_OWNER_REG_ERR);
    });

    it("should revoke lvl 5 domain with refund", async () => {
      const domainHash = regResults[4].domainHash;

      const userBalanceBefore = await zns.meowToken.balanceOf(lvl5SubOwner.address);
      const parentBalBefore = await zns.meowToken.balanceOf(lvl4SubOwner.address);
      const paymentContractBalBefore = await zns.meowToken.balanceOf(await zns.treasury.getAddress());

      const stake = await zns.treasury.stakedForDomain(domainHash);
      const protocolFee = getStakingOrProtocolFee(stake.amount);

      await zns.meowToken.connect(lvl5SubOwner).approve(await zns.treasury.getAddress(), protocolFee);

      await zns.rootRegistrar.connect(lvl5SubOwner).revokeDomain(domainHash);

      const userBalAfter = await zns.meowToken.balanceOf(lvl5SubOwner.address);
      const parentBalAfter = await zns.meowToken.balanceOf(lvl4SubOwner.address);
      const paymentContractBalAfter = await zns.meowToken.balanceOf(await zns.treasury.getAddress());

      const { expectedPrice } = getPriceObject(domainConfigs[4].domainLabel);

      expect(
        userBalAfter - userBalanceBefore
      ).to.eq(
        expectedPrice - protocolFee
      );
      expect(
        parentBalBefore - parentBalAfter
      ).to.eq(
        BigInt(0)
      );
      expect(
        paymentContractBalBefore - paymentContractBalAfter
      ).to.eq(
        expectedPrice
      );

      // make sure that accessType has been set to LOCKED
      // and nobody can register a subdomain under this domain
      const { accessType: accessTypeFromSC } = await zns.subRegistrar.distrConfigs(domainHash);
      expect(accessTypeFromSC).to.eq(AccessType.LOCKED);

      await expect(
        zns.subRegistrar.connect(lvl6SubOwner).registerSubdomain(
          {
            parentHash: domainHash,
            label: "newsubdomain",
            domainAddress: lvl6SubOwner.address,
            tokenURI: DEFAULT_TOKEN_URI,
          },
          distrConfigEmpty,
          paymentConfigEmpty,
          ethers.ZeroHash
        )
      ).to.be.revertedWith(
        DISTRIBUTION_LOCKED_NOT_EXIST_ERR
      );

      const dataFromReg = await zns.registry.getDomainRecord(domainHash);
      expect(dataFromReg.owner).to.eq(ethers.ZeroAddress);
      expect(dataFromReg.resolver).to.eq(ethers.ZeroAddress);

      const tokenId = BigInt(domainHash).toString();
      await expect(
        zns.domainToken.ownerOf(tokenId)
      ).to.be.revertedWith(
        INVALID_TOKENID_ERC_ERR
      );

      await expect(
        zns.registry.connect(lvl5SubOwner).updateDomainRecord(domainHash, rootOwner.address, lvl6SubOwner.address)
      ).to.be.revertedWith(ONLY_NAME_OWNER_REG_ERR);
    });

    it("should register a new 2 lvl path at lvl 3 of the existing path", async () => {
      const newConfigs = [
        {
          user: branchLvl1Owner,
          domainLabel: "lvlthreenew",
          parentHash: regResults[2].domainHash,
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: branchLvl1Owner.address,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
          },
        },
        {
          user: branchLvl2Owner,
          domainLabel: "lvlfournew",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.curvePricer.getAddress(),
              paymentType: PaymentType.STAKE,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: branchLvl2Owner.address,
            },
            priceConfig: DEFAULT_PRICE_CONFIG,
          },
        },
      ];

      const newRegResults = await registerDomainPath({
        zns,
        domainConfigs: newConfigs,
      });

      await validatePathRegistration({
        zns,
        domainConfigs: newConfigs,
        regResults: newRegResults,
      });
    });

    it("should revoke lvl 3 domain (child) with refund after lvl 2 (parent) has been revoked", async () => {
      const lvl2Hash = regResults[1].domainHash;
      const lvl3Hash = regResults[2].domainHash;

      const childExists = await zns.registry.exists(lvl3Hash);
      assert.ok(childExists);

      const stake = await zns.treasury.stakedForDomain(lvl2Hash);
      const protocolFee = getStakingOrProtocolFee(stake.amount);

      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), protocolFee);

      // revoke parent
      await zns.rootRegistrar.connect(lvl2SubOwner).revokeDomain(
        lvl2Hash,
      );

      // make sure all parent's distribution configs still exist
      const parentDistrConfig = await zns.subRegistrar.distrConfigs(lvl2Hash);
      const parentPaymentConfig = await zns.treasury.paymentConfigs(lvl2Hash);
      expect(parentDistrConfig.pricerContract).to.eq(domainConfigs[1].fullConfig.distrConfig.pricerContract);
      expect(
        parentDistrConfig.paymentType
      ).to.eq(
        domainConfigs[1].fullConfig.distrConfig.paymentType
      );
      expect(
        parentPaymentConfig.token
      ).to.eq(
        domainConfigs[1].fullConfig.paymentConfig.token
      );
      expect(
        parentPaymentConfig.beneficiary
      ).to.eq(
        domainConfigs[1].fullConfig.paymentConfig.beneficiary
      );

      expect(parentDistrConfig.pricerContract).to.eq(await zns.curvePricer.getAddress());

      // check a couple of fields from price config
      const priceConfig = await zns.curvePricer.priceConfigs(lvl2Hash);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if ("maxPrice" in domainConfigs[1].fullConfig.priceConfig!) {
        expect(priceConfig.maxPrice).to.eq(domainConfigs[1].fullConfig.priceConfig.maxPrice);
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if ("minPrice" in domainConfigs[1].fullConfig.priceConfig!) {
        expect(priceConfig.minPrice).to.eq(domainConfigs[1].fullConfig.priceConfig.minPrice);
      }

      // make sure the child's stake is still there
      const { amount: childStakedAmt } = await zns.treasury.stakedForDomain(lvl3Hash);
      const { expectedPrice } = getPriceObject(domainConfigs[2].domainLabel);

      expect(childStakedAmt).to.eq(expectedPrice);

      const userBalBefore = await zns.meowToken.balanceOf(lvl3SubOwner.address);

      const subStake = await zns.treasury.stakedForDomain(lvl3Hash);
      const subProtocolFee = getStakingOrProtocolFee(subStake.amount);

      await zns.meowToken.connect(lvl3SubOwner).approve(await zns.treasury.getAddress(), subProtocolFee);

      // revoke child
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        lvl3Hash,
      );

      const userBalAfter = await zns.meowToken.balanceOf(lvl3SubOwner.address);

      expect(userBalAfter - userBalBefore).to.eq(expectedPrice - subProtocolFee);

      const childExistsAfter = await zns.registry.exists(lvl3Hash);
      assert.ok(!childExistsAfter);

      const { amount: stakedAfterRevoke } = await zns.treasury.stakedForDomain(lvl3Hash);
      expect(stakedAfterRevoke).to.eq(0);

      const dataFromReg = await zns.registry.getDomainRecord(lvl3Hash);
      expect(dataFromReg.owner).to.eq(ethers.ZeroAddress);
      expect(dataFromReg.resolver).to.eq(ethers.ZeroAddress);

      const tokenId = BigInt(lvl3Hash).toString();
      await expect(
        zns.domainToken.ownerOf(tokenId)
      ).to.be.revertedWith(
        INVALID_TOKENID_ERC_ERR
      );

      await expect(
        zns.registry.connect(lvl3SubOwner).updateDomainRecord(lvl3Hash, rootOwner.address, lvl4SubOwner.address)
      ).to.be.revertedWith(ONLY_NAME_OWNER_REG_ERR);
    });

    it("should let anyone register a previously revoked domain", async () => {
      const lvl2Hash = regResults[1].domainHash;
      const parentHash = regResults[0].domainHash;

      const exists = await zns.registry.exists(lvl2Hash);
      if (!exists) {
        const newHash = await registrationWithSetup({
          zns,
          user: lvl2SubOwner,
          parentHash,
          domainLabel: domainConfigs[1].domainLabel,
          fullConfig: domainConfigs[1].fullConfig,
        });

        expect(newHash).to.eq(lvl2Hash);
      }

      // revoke subdomain
      await zns.rootRegistrar.connect(lvl2SubOwner).revokeDomain(
        lvl2Hash,
      );

      // someone else is taking it
      const newConfig = [
        {
          user: branchLvl1Owner,
          domainLabel: "lvltwonew",
          parentHash,
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: branchLvl1Owner.address,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
          },
        },
      ];

      const newResult = await registerDomainPath({
        zns,
        domainConfigs: newConfig,
      });

      await validatePathRegistration({
        zns,
        domainConfigs: newConfig,
        regResults: newResult,
      });
    });

    it("should NOT register a child (subdomain) under a parent (root domain) that has been revoked", async () => {
      const lvl1Hash = regResults[0].domainHash;

      // revoke parent
      await zns.rootRegistrar.connect(rootOwner).revokeDomain(
        lvl1Hash
      );

      const exists = await zns.registry.exists(lvl1Hash);
      assert.ok(!exists);

      await expect(
        zns.subRegistrar.connect(branchLvl1Owner).registerSubdomain(
          {
            parentHash: lvl1Hash,
            label: "newsubdomain",
            domainAddress: branchLvl1Owner.address,
            tokenURI: DEFAULT_TOKEN_URI,
          },
          distrConfigEmpty,
          paymentConfigEmpty,
          ethers.ZeroHash
        )
      ).to.be.revertedWith(DISTRIBUTION_LOCKED_NOT_EXIST_ERR);

      // register root back for other tests
      await registrationWithSetup({
        zns,
        user: rootOwner,
        parentHash: ethers.ZeroHash,
        domainLabel: domainConfigs[0].domainLabel,
        fullConfig: domainConfigs[0].fullConfig,
      });
    });

    it("should NOT register a child (subdomain) under a parent (subdomain) that has been revoked", async () => {
      const lvl4Hash = regResults[3].domainHash;

      // revoke parent
      await zns.rootRegistrar.connect(lvl4SubOwner).revokeDomain(
        lvl4Hash,
      );

      const exists = await zns.registry.exists(lvl4Hash);
      assert.ok(!exists);

      await expect(
        zns.subRegistrar.connect(branchLvl2Owner).registerSubdomain(
          {
            parentHash: lvl4Hash,
            label: "newsubdomain",
            domainAddress: branchLvl2Owner.address,
            tokenURI: DEFAULT_TOKEN_URI,
          },
          distrConfigEmpty,
          paymentConfigEmpty,
          ethers.ZeroHash
        )
      ).to.be.revertedWith(DISTRIBUTION_LOCKED_NOT_EXIST_ERR);
    });

    // eslint-disable-next-line max-len
    it("should allow setting a new config and start distributing subdomain when registering a previously revoked parent", async () => {
      if (!await zns.registry.exists(regResults[1].domainHash)) {
        await registrationWithSetup({
          zns,
          user: lvl2SubOwner,
          parentHash: regResults[0].domainHash,
          domainLabel: domainConfigs[1].domainLabel,
          fullConfig: domainConfigs[1].fullConfig,
        });
      }

      // revoke parent
      await zns.rootRegistrar.connect(lvl2SubOwner).revokeDomain(regResults[1].domainHash);

      expect(await zns.registry.exists(regResults[1].domainHash)).to.eq(false);

      // register again with new owner and config
      const newHash = await registrationWithSetup({
        zns,
        user: branchLvl1Owner,
        parentHash: regResults[0].domainHash,
        domainLabel: domainConfigs[1].domainLabel,
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            paymentType: PaymentType.DIRECT,
            accessType: AccessType.MINTLIST,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: branchLvl1Owner.address,
          },
          priceConfig: { price: fixedPrice, feePercentage: BigInt(0) },
        },
      });

      expect(newHash).to.eq(regResults[1].domainHash);


      const parentOwnerFromReg = await zns.registry.getDomainOwner(newHash);
      expect(parentOwnerFromReg).to.eq(branchLvl1Owner.address);

      const childBalBefore = await zns.meowToken.balanceOf(branchLvl2Owner.address);
      const label = "newchildddd"

      const signed = await createCouponSignature(
        newHash,
        branchLvl2Owner.address,
        label,
        helperAddress,
        rootOwner
      )

      // try register a new child under the new parent
      const newChildHash = await registrationWithSetup({ // TODO needs to give coupon data when fixed
        zns,
        user: branchLvl2Owner,
        parentHash: newHash,
        domainLabel: label,
        fullConfig: fullDistrConfigEmpty,
        signature: signed,
      });

      const childBalAfter = await zns.meowToken.balanceOf(branchLvl2Owner.address);

      // check that the new child has been registered
      const childOwnerFromReg = await zns.registry.getDomainOwner(newChildHash);
      expect(childOwnerFromReg).to.eq(branchLvl2Owner.address);

      const protocolFee = getStakingOrProtocolFee(fixedPrice);

      // make sure child payed based on the new parent config
      expect(childBalBefore - childBalAfter).to.eq(fixedPrice + protocolFee);
    });
  });

  describe("Token movements with different distr setups", () => {
    let rootHash: string;
    let fixedPrice: bigint;
    let feePercentage: bigint;
    let token2: CustomDecimalTokenMock;
    let token5: CustomDecimalTokenMock;
    let token8: CustomDecimalTokenMock;
    let token13: CustomDecimalTokenMock;
    let token18: CustomDecimalTokenMock;

    const decimalValues = {
      two: BigInt(2),
      five: BigInt(5),
      eight: BigInt(8),
      thirteen: BigInt(13),
      eighteen: BigInt(18),
    };

    before(async () => {
      [
        deployer,
        zeroVault,
        governor,
        admin,
        rootOwner,
        lvl2SubOwner,
        lvl3SubOwner,
        lvl4SubOwner,
        lvl5SubOwner,
        lvl6SubOwner,
        branchLvl1Owner,
        branchLvl2Owner,
      ] = await hre.ethers.getSigners();
      // zeroVault address is used to hold the fee charged to the user when registering
      zns = await deployZNS({
        deployer,
        governorAddresses: [deployer.address, governor.address],
        adminAddresses: [admin.address],
        priceConfig: DEFAULT_PRICE_CONFIG,
        zeroVaultAddress: zeroVault.address,
      });

      ([
        token2,
        token5,
        token8,
        token13,
        token18,
      ] = await Object.values(decimalValues).reduce(
        async (acc: Promise<Array<CustomDecimalTokenMock>>, decimals) => {
          const newAcc = await acc;

          const token = await deployCustomDecToken(deployer, decimals);

          return [...newAcc, token];
        }, Promise.resolve([])
      ));

      // Give funds to users
      await Promise.all(
        [
          rootOwner,
          lvl2SubOwner,
          lvl3SubOwner,
          lvl4SubOwner,
          lvl5SubOwner,
          lvl6SubOwner,
          branchLvl1Owner,
          branchLvl2Owner,
        ].map(async ({ address }) =>
          zns.meowToken.mint(address, ethers.parseEther("1000000")))
      );
      await zns.meowToken.connect(rootOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      // register root domain
      rootHash = await registrationWithSetup({
        zns,
        user: rootOwner,
        domainLabel: "root",
        fullConfig: {
          distrConfig: {
            accessType: AccessType.OPEN,
            pricerContract: await zns.fixedPricer.getAddress(),
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
          priceConfig: {
            price: ethers.parseEther("1375.612"),
            feePercentage: BigInt(0),
          },
        },
      });
    });

    it("FixedPricer - StakePayment - stake fee - 5 decimals", async () => {
      const decimals = await token5.decimals();
      expect(decimals).to.eq(decimalValues.five);

      fixedPrice = ethers.parseUnits("1375.17", decimalValues.five);
      feePercentage = BigInt(200);

      const priceConfig = {
        price: fixedPrice,
        feePercentage,
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "fixedstake",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            paymentType: PaymentType.STAKE,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await token5.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
          priceConfig,
        },
      });

      const label = "fixedstakechild";

      const {
        expectedPrice,
        stakeFee: stakeFee,
      } = getPriceObject(label, priceConfig);
      const protocolFee = getStakingOrProtocolFee(
        expectedPrice + stakeFee
      );

      // send future child some tokens
      await token5.connect(deployer).transfer(lvl3SubOwner.address, expectedPrice + stakeFee + (protocolFee * 2n));

      const contractBalBefore = await token5.balanceOf(await zns.treasury.getAddress());
      const parentBalBefore = await token5.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await token5.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await token5.balanceOf(zeroVault.address);

      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
        fullConfig: fullDistrConfigEmpty,
      });

      const parentBalAfter = await token5.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await token5.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await token5.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfter = await token5.balanceOf(zeroVault.address);

      expect(parentBalAfter - parentBalBefore).to.eq(stakeFee);
      expect(childBalBefore - childBalAfter).to.eq(expectedPrice + stakeFee + protocolFee);
      expect(contractBalAfter - contractBalBefore).to.eq(expectedPrice);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(protocolFee);

      const stake = await zns.treasury.stakedForDomain(childHash);
      const protocolFeeOut = getStakingOrProtocolFee(stake.amount);

      await token5.connect(lvl3SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        childHash,
      );

      // should offer refund !
      const contractBalAfterRevoke = await token5.balanceOf(await zns.treasury.getAddress());
      const childBalAfterRevoke = await token5.balanceOf(lvl3SubOwner.address);
      const parentBalAfterRevoke = await token5.balanceOf(lvl2SubOwner.address);
      const zeroVaultBalanceAfterRevoke = await token5.balanceOf(zeroVault.address);

      expect(contractBalAfter - contractBalAfterRevoke).to.eq(expectedPrice);
      expect(childBalAfterRevoke - childBalAfter).to.eq(expectedPrice - protocolFeeOut);
      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter - protocolFeeOut).to.eq(0);
    });

    it("Does not charge the owner of a parent domain when they revoke a subdomain", async () => {
      const subdomainHash = await registrationWithSetup({
        zns,
        user: rootOwner,
        parentHash: rootHash,
        domainLabel: "subdomain",
      });

      const balanceBefore = await zns.meowToken.balanceOf(rootOwner.address);

      await zns.rootRegistrar.connect(rootOwner).revokeDomain(subdomainHash);

      const balanceAfter = await zns.meowToken.balanceOf(rootOwner.address);
      expect(balanceBefore).to.eq(balanceAfter);
    });

    it("FixedPricer - StakePayment - no fee - 18 decimals", async () => {
      const priceConfig = {
        price: ethers.parseUnits("397.77", decimalValues.eighteen),
        feePercentage: BigInt(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "fixedstakenofee",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            token: await token18.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
          priceConfig,
        },
      });

      const label = "fixedstakenofeechild";

      const { expectedPrice } = getPriceObject(label, priceConfig);
      const protocolFee = getStakingOrProtocolFee(expectedPrice);

      // send future child some tokens
      await token18.connect(deployer).transfer(
        lvl3SubOwner.address,
        expectedPrice + (protocolFee * 2n)
      );

      const contractBalBefore = await token18.balanceOf(await zns.treasury.getAddress());
      const parentBalBefore = await token18.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await token18.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await token18.balanceOf(zeroVault.address);

      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
      });

      const parentBalAfter = await token18.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await token18.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await token18.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfter = await token18.balanceOf(zeroVault.address);

      expect(parentBalAfter - parentBalBefore).to.eq(0);
      expect(childBalBefore - childBalAfter).to.eq(expectedPrice + protocolFee);
      expect(contractBalAfter - contractBalBefore).to.eq(expectedPrice);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(protocolFee);

      await token18.connect(lvl3SubOwner).approve(await zns.treasury.getAddress(), protocolFee);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        childHash,
      );

      // should offer refund !
      const contractBalAfterRevoke = await token18.balanceOf(await zns.treasury.getAddress());
      const childBalAfterRevoke = await token18.balanceOf(lvl3SubOwner.address);
      const parentBalAfterRevoke = await token18.balanceOf(lvl2SubOwner.address);
      const zeroVaultBalanceAfterRevoke = await token18.balanceOf(zeroVault.address);

      expect(contractBalAfter - contractBalAfterRevoke).to.eq(expectedPrice);
      expect(childBalAfterRevoke - childBalAfter).to.eq(expectedPrice - protocolFee);
      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter - protocolFee).to.eq(0);
    });

    it("FixedPricer - DirectPayment - no fee - 8 decimals", async () => {
      const priceConfig = {
        price: ethers.parseUnits("11.371", decimalValues.eight),
        feePercentage: BigInt(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "fixeddirectnofee",
        fullConfig: {
          distrConfig: {
            paymentType: PaymentType.DIRECT,
            pricerContract: await zns.fixedPricer.getAddress(),
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await token8.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
          priceConfig,
        },
      });

      const label = "fixeddirectnofeechild";
      const { expectedPrice } = getPriceObject(label, priceConfig);
      const protocolFee = getStakingOrProtocolFee(expectedPrice);

      // send future child some tokens
      await token8.connect(deployer).transfer(
        lvl3SubOwner.address,
        expectedPrice + protocolFee
      );

      const parentBalBefore = await token8.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await token8.balanceOf(lvl3SubOwner.address);
      const contractBalBefore = await token8.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceBefore = await token8.balanceOf(zeroVault.address);


      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
        fullConfig: fullDistrConfigEmpty,
      });

      const parentBalAfter = await token8.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await token8.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await token8.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfter = await token8.balanceOf(zeroVault.address);


      expect(parentBalAfter - parentBalBefore).to.eq(expectedPrice);
      expect(childBalBefore - childBalAfter).to.eq(expectedPrice + protocolFee);
      expect(contractBalAfter - contractBalBefore).to.eq(0);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(protocolFee);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        childHash,
      );

      // should NOT offer refund !
      const parentBalAfterRevoke = await token8.balanceOf(lvl2SubOwner.address);
      const childBalAfterRevoke = await token8.balanceOf(lvl3SubOwner.address);
      const contractBalAfterRevoke = await token8.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfterRevoke = await token8.balanceOf(zeroVault.address);

      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(childBalAfterRevoke - childBalAfter).to.eq(0);
      expect(contractBalAfterRevoke - contractBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter).to.eq(0);
    });

    it("CurvePricer - StakePayment - stake fee - 13 decimals", async () => {
      const priceConfig = {
        maxPrice: ethers.parseUnits("30000.93", decimalValues.thirteen),
        minPrice: ethers.parseUnits("2000.11", decimalValues.thirteen),
        maxLength: BigInt(50),
        baseLength: BigInt(4),
        precisionMultiplier: BigInt(10) ** (
          decimalValues.thirteen - DECAULT_PRECISION
        ),
        feePercentage: BigInt(185),
        isSet: true,
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "asympstake",
        fullConfig: {
          distrConfig: {
            paymentType: PaymentType.STAKE,
            pricerContract: await zns.curvePricer.getAddress(),
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await token13.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
          priceConfig,
        },
      });

      const label = "curvestakechild";

      const {
        expectedPrice,
        stakeFee: stakeFee,
      } = getPriceObject(label, priceConfig);
      const protocolFee = getStakingOrProtocolFee(
        expectedPrice + stakeFee
      );

      // send future child some tokens
      await token13.connect(deployer).transfer(
        lvl3SubOwner.address,
        expectedPrice + stakeFee + (protocolFee * 2n)
      );

      const contractBalBefore = await token13.balanceOf(await zns.treasury.getAddress());
      const parentBalBefore = await token13.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await token13.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await token13.balanceOf(zeroVault.address);

      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
        fullConfig: fullDistrConfigEmpty,
      });

      const contractBalAfter = await token13.balanceOf(await zns.treasury.getAddress());
      const parentBalAfter = await token13.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await token13.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceAfter = await token13.balanceOf(zeroVault.address);

      expect(parentBalAfter - parentBalBefore).to.eq(stakeFee);
      expect(childBalBefore - childBalAfter).to.eq(expectedPrice + protocolFee + stakeFee);
      expect(contractBalAfter - contractBalBefore).to.eq(expectedPrice);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(protocolFee);

      const protocolFeeOut = getStakingOrProtocolFee(expectedPrice);
      await token13.connect(lvl3SubOwner).approve(await zns.treasury.getAddress(), protocolFeeOut);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(childHash);

      // should offer refund !
      const contractBalAfterRevoke = await token13.balanceOf(await zns.treasury.getAddress());
      const childBalAfterRevoke = await token13.balanceOf(lvl3SubOwner.address);
      const parentBalAfterRevoke = await token13.balanceOf(lvl2SubOwner.address);
      const zeroVaultBalanceAfterRevoke = await token13.balanceOf(zeroVault.address);

      expect(contractBalAfter - contractBalAfterRevoke).to.eq(expectedPrice);
      expect(childBalAfterRevoke - childBalAfter).to.eq(expectedPrice - protocolFeeOut);
      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter - protocolFeeOut).to.eq(0);
    });

    it("CurvePricer - StakePayment - no fee - 2 decimals", async () => {
      const priceConfig = {
        maxPrice: ethers.parseUnits("234.46", decimalValues.two),
        minPrice: ethers.parseUnits("3.37", decimalValues.two),
        maxLength: BigInt(20),
        baseLength: BigInt(2),
        precisionMultiplier: BigInt(1),
        feePercentage: BigInt(0),
        isSet: true,
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "curvestakenofee",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            token: await token2.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
          priceConfig,
        },
      });

      const label = "curvestakenofeechild";

      const { expectedPrice } = getPriceObject(label, priceConfig);
      const protocolFee = getStakingOrProtocolFee(expectedPrice);

      // send future child some tokens
      await token2.connect(deployer).transfer(
        lvl3SubOwner.address,
        expectedPrice + (protocolFee * 2n)
      );

      const contractBalBefore = await token2.balanceOf(await zns.treasury.getAddress());
      const parentBalBefore = await token2.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await token2.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await token2.balanceOf(zeroVault.address);

      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
      });

      const contractBalAfter = await token2.balanceOf(await zns.treasury.getAddress());
      const parentBalAfter = await token2.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await token2.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceAfter = await token2.balanceOf(zeroVault.address);

      expect(parentBalAfter - parentBalBefore).to.eq(0);
      expect(childBalBefore - childBalAfter).to.eq(expectedPrice + protocolFee);
      expect(contractBalAfter - contractBalBefore).to.eq(expectedPrice);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(protocolFee);

      await token2.connect(lvl3SubOwner).approve(await zns.treasury.getAddress(), protocolFee);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        childHash,
      );

      // should offer refund !
      const contractBalAfterRevoke = await token2.balanceOf(await zns.treasury.getAddress());
      const childBalAfterRevoke = await token2.balanceOf(lvl3SubOwner.address);
      const parentBalAfterRevoke = await token2.balanceOf(lvl2SubOwner.address);
      const zeroVaultBalanceAfterRevoke = await token2.balanceOf(zeroVault.address);

      expect(contractBalAfter - contractBalAfterRevoke).to.eq(expectedPrice);
      expect(childBalAfterRevoke - childBalAfter).to.eq(expectedPrice - protocolFee);
      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter - protocolFee).to.eq(0);
    });

    it("CurvePricer - DirectPayment - no fee - 18 decimals", async () => {
      const priceConfig = {
        ...DEFAULT_PRICE_CONFIG,
        feePercentage: BigInt(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "curvedirectnofee",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            // zero has 18 decimals
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
          priceConfig,
        },
      });

      const label = "asdirectnofeechild";

      const contractBalBefore = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const parentBalBefore = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.meowToken.balanceOf(zeroVault.address);

      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
      });

      const parentBalAfter = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfter = await zns.meowToken.balanceOf(zeroVault.address);

      const { expectedPrice } = getPriceObject(label, priceConfig);
      const protocolFee = getStakingOrProtocolFee(expectedPrice);

      expect(parentBalAfter - parentBalBefore).to.eq(expectedPrice);
      expect(childBalBefore - childBalAfter).to.eq(expectedPrice + protocolFee);
      expect(contractBalAfter - contractBalBefore).to.eq(0);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(protocolFee);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        childHash,
      );

      // should NOT offer refund !
      const parentBalAfterRevoke = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfterRevoke = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfterRevoke = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfterRevoke = await zns.meowToken.balanceOf(zeroVault.address);

      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(childBalAfterRevoke - childBalAfter).to.eq(0);
      expect(contractBalAfterRevoke - contractBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter).to.eq(0);
    });

    it("FixedPricer + DirectPayment with price = 0 - should NOT perform any transfers", async () => {
      const priceConfig = {
        price: BigInt(0),
        feePercentage: BigInt(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "zeroprice",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
          priceConfig,
        },
      });

      const contractBalBefore = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const parentBalBefore = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.meowToken.balanceOf(zeroVault.address);

      const label = "zeropricechild";
      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
      });

      const parentBalAfter = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfter = await zns.meowToken.balanceOf(zeroVault.address);

      expect(parentBalAfter - parentBalBefore).to.eq(0);
      expect(childBalBefore - childBalAfter).to.eq(0);
      expect(contractBalAfter - contractBalBefore).to.eq(0);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(0);

      // validate transfer events are not happenning
      const latestBlock = await time.latestBlock();
      const transferFilterToParent = zns.meowToken.filters.Transfer(lvl3SubOwner.address, lvl2SubOwner.address);
      const transferFilterToTreasury = zns.meowToken.filters.Transfer(
        lvl3SubOwner.address,
        await zns.treasury.getAddress()
      );
      const transfersToParent = await zns.meowToken.queryFilter(
        transferFilterToParent,
        latestBlock - 3,
        latestBlock
      );
      const transfersToTreasury = await zns.meowToken.queryFilter(
        transferFilterToTreasury,
        latestBlock - 3,
        latestBlock
      );
      expect(transfersToParent.length).to.eq(0);
      expect(transfersToTreasury.length).to.eq(0);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        childHash,
      );

      // should NOT offer refund !
      const parentBalAfterRevoke = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfterRevoke = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfterRevoke = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfterRevoke = await zns.meowToken.balanceOf(zeroVault.address);

      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(childBalAfterRevoke - childBalAfter).to.eq(0);
      expect(contractBalAfterRevoke - contractBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter).to.eq(0);
    });

    it("CurvePricer + DirectPayment with price = 0 - should NOT perform any transfers", async () => {
      const priceConfig = {
        ...DEFAULT_PRICE_CONFIG,
        maxPrice: BigInt(0),
        minPrice: BigInt(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "zeropricead",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
          priceConfig,
        },
      });

      const contractBalBefore = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const parentBalBefore = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.meowToken.balanceOf(zeroVault.address);

      const label = "zeropricechildad";
      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
      });

      const parentBalAfter = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfter = await zns.meowToken.balanceOf(zeroVault.address);

      expect(parentBalAfter - parentBalBefore).to.eq(0);
      expect(childBalBefore - childBalAfter).to.eq(0);
      expect(contractBalAfter - contractBalBefore).to.eq(0);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(0);

      // validate transfer events are not happenning
      const latestBlock = await time.latestBlock();
      const transferFilterToParent = zns.meowToken.filters.Transfer(
        lvl3SubOwner.address,
        lvl2SubOwner.address
      );
      const transferFilterToTreasury = zns.meowToken.filters.Transfer(
        lvl3SubOwner.address,
        await zns.treasury.getAddress()
      );
      const transfersToParent = await zns.meowToken.queryFilter(
        transferFilterToParent,
        latestBlock - 3,
        latestBlock
      );
      const transfersToTreasury = await zns.meowToken.queryFilter(
        transferFilterToTreasury,
        latestBlock - 3,
        latestBlock
      );
      expect(transfersToParent.length).to.eq(0);
      expect(transfersToTreasury.length).to.eq(0);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        childHash,
      );

      // should NOT offer refund !
      const parentBalAfterRevoke = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfterRevoke = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfterRevoke = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfterRevoke = await zns.meowToken.balanceOf(zeroVault.address);

      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(childBalAfterRevoke - childBalAfter).to.eq(0);
      expect(contractBalAfterRevoke - contractBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter).to.eq(0);
    });

    it("CurvePricer + StakePayment with price = 0 - should NOT perform any transfers", async () => {
      const priceConfig = {
        ...DEFAULT_PRICE_CONFIG,
        maxPrice: BigInt(0),
        minPrice: BigInt(0),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "zeropriceas",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
          priceConfig,
        },
      });

      const contractBalBefore = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const parentBalBefore = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.meowToken.balanceOf(zeroVault.address);

      const label = "zeropricechildas";
      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
      });

      const parentBalAfter = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfter = await zns.meowToken.balanceOf(zeroVault.address);

      expect(parentBalAfter - parentBalBefore).to.eq(0);
      expect(childBalBefore - childBalAfter).to.eq(0);
      expect(contractBalAfter - contractBalBefore).to.eq(0);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(0);

      // validate transfer events are not happenning
      const latestBlock = await time.latestBlock();
      const transferFilterToParent = zns.meowToken.filters.Transfer(lvl3SubOwner.address, lvl2SubOwner.address);
      const transferFilterToTreasury = zns.meowToken.filters.Transfer(
        lvl3SubOwner.address,
        await zns.treasury.getAddress()
      );
      const transfersToParent = await zns.meowToken.queryFilter(
        transferFilterToParent,
        latestBlock - 3,
        latestBlock
      );
      const transfersToTreasury = await zns.meowToken.queryFilter(
        transferFilterToTreasury,
        latestBlock - 3,
        latestBlock
      );
      expect(transfersToParent.length).to.eq(0);
      expect(transfersToTreasury.length).to.eq(0);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        childHash,
      );

      // should NOT offer refund !
      const parentBalAfterRevoke = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfterRevoke = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfterRevoke = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfterRevoke = await zns.meowToken.balanceOf(zeroVault.address);

      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(childBalAfterRevoke - childBalAfter).to.eq(0);
      expect(contractBalAfterRevoke - contractBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter).to.eq(0);
    });

    it("FixedPricer + StakePayment with price = 0 - should NOT perform any transfers", async () => {
      const priceConfig = {
        price: BigInt(0),
        // we are trying to set a feePercentage, but that should still result to 0 fee
        // since fee is based on price
        feePercentage: BigInt(5),
      };

      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "zeropricefs",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
          priceConfig,
        },
      });

      const contractBalBefore = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const parentBalBefore = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalBefore = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const zeroVaultBalanceBefore = await zns.meowToken.balanceOf(zeroVault.address);

      const label = "zeropricechildfs";
      const childHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
      });

      const parentBalAfter = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfter = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfter = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfter = await zns.meowToken.balanceOf(zeroVault.address);

      expect(parentBalAfter - parentBalBefore).to.eq(0);
      expect(childBalBefore - childBalAfter).to.eq(0);
      expect(contractBalAfter - contractBalBefore).to.eq(0);
      expect(zeroVaultBalanceAfter - zeroVaultBalanceBefore).to.eq(0);

      // validate transfer events are not happenning
      const latestBlock = await time.latestBlock();
      const transferFilterToParent = zns.meowToken.filters.Transfer(lvl3SubOwner.address, lvl2SubOwner.address);
      const transferFilterToTreasury = zns.meowToken.filters.Transfer(
        lvl3SubOwner.address,
        await zns.treasury.getAddress()
      );
      const transfersToParent = await zns.meowToken.queryFilter(
        transferFilterToParent,
        latestBlock - 3,
        latestBlock
      );
      const transfersToTreasury = await zns.meowToken.queryFilter(
        transferFilterToTreasury,
        latestBlock - 3,
        latestBlock
      );
      expect(transfersToParent.length).to.eq(0);
      expect(transfersToTreasury.length).to.eq(0);

      // revoke
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        childHash,
      );

      // should NOT offer refund !
      const parentBalAfterRevoke = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      const childBalAfterRevoke = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      const contractBalAfterRevoke = await zns.meowToken.balanceOf(await zns.treasury.getAddress());
      const zeroVaultBalanceAfterRevoke = await zns.meowToken.balanceOf(zeroVault.address);

      expect(parentBalAfterRevoke - parentBalAfter).to.eq(0);
      expect(childBalAfterRevoke - childBalAfter).to.eq(0);
      expect(contractBalAfterRevoke - contractBalAfter).to.eq(0);
      expect(zeroVaultBalanceAfterRevoke - zeroVaultBalanceAfter).to.eq(0);
    });

    it("Setting price config in incorrect decimals triggers incorrect pricing", async () => {
      // we will use token with 5 decimals, but set prices in 18 decimals
      const priceConfigIncorrect = {
        maxPrice: ethers.parseUnits("234.46", decimalValues.eighteen),
        minPrice: ethers.parseUnits("3.37", decimalValues.eighteen),
        maxLength: BigInt(20),
        baseLength: BigInt(2),
        precisionMultiplier: BigInt(1),
        feePercentage: BigInt(111),
        isSet: true,
      };

      // see `token` in paymentConfig
      const subdomainParentHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: rootHash,
        domainLabel: "incorrectparent",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            accessType: AccessType.OPEN,
            paymentType: PaymentType.STAKE,
          },
          paymentConfig: {
            // ! this token has 5 decimals !
            token: await token5.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
          priceConfig: priceConfigIncorrect,
        },
      });

      const label = "incorrectchild";

      const priceConfigCorrect = {
        ...priceConfigIncorrect,
        maxPrice: ethers.parseUnits("234.46", decimalValues.five),
        minPrice: ethers.parseUnits("3.37", decimalValues.five),
      };

      // calc prices off-chain
      const {
        expectedPrice: priceIncorrect,
        stakeFee: stakeFeeIncorrect,
      } = getPriceObject(label, priceConfigIncorrect);
      const protocolFeeIncorrect = getStakingOrProtocolFee(priceIncorrect + stakeFeeIncorrect);

      const {
        expectedPrice: priceCorrect,
        stakeFee: stakeFeeCorrect,
      } = getPriceObject(label, priceConfigCorrect);
      const protocolFeeCorrect = getStakingOrProtocolFee(priceCorrect + stakeFeeCorrect);

      // get prices from SC
      const {
        price: priceFromSC,
        stakeFee: feeFromSC,
      } = await zns.curvePricer.getPriceAndFee(
        subdomainParentHash,
        label,
        true
      );
      const protocolFeeFromSC = await zns.curvePricer.getFeeForPrice(
        ethers.ZeroHash,
        priceFromSC + feeFromSC
      );

      expect(priceFromSC).to.not.eq(priceCorrect);
      expect(priceFromSC).to.eq(priceIncorrect);
      expect(feeFromSC).to.not.eq(stakeFeeCorrect);
      expect(feeFromSC).to.eq(stakeFeeIncorrect);
      expect(protocolFeeFromSC).to.not.eq(protocolFeeCorrect);
      expect(protocolFeeFromSC).to.eq(protocolFeeIncorrect);

      const priceDiff = priceIncorrect - priceCorrect;
      // the difference should be very large
      expect(priceDiff).to.be.gt(
        BigInt(10) ** decimalValues.eighteen
      );

      // let's see how much a user actually paid

      // we sending him 10^20 tokens
      await token5.connect(deployer).transfer(
        lvl3SubOwner.address,
        ethers.parseUnits("10000000000000000000", decimalValues.five)
      );

      // client tx approving the correct price will fail
      await token5.connect(lvl3SubOwner).approve(
        await zns.treasury.getAddress(),
        priceCorrect + stakeFeeCorrect + protocolFeeCorrect
      );

      await expect(
        zns.subRegistrar.registerSubdomain(
          {
            parentHash: subdomainParentHash,
            label: label,
            domainAddress: lvl3SubOwner.address,
            tokenURI: DEFAULT_TOKEN_URI,
          },
          distrConfigEmpty,
          paymentConfigEmpty,
          ethers.ZeroHash
        )
      ).to.be.revertedWith("ERC20: insufficient allowance");

      // let's try to buy with the incorrect price
      const userBalanceBefore = await token5.balanceOf(lvl3SubOwner.address);

      await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: subdomainParentHash,
        domainLabel: label,
      });

      const userBalanceAfter = await token5.balanceOf(lvl3SubOwner.address);

      // user should have paid the incorrect price
      expect(userBalanceBefore - userBalanceAfter).to.eq(
        priceIncorrect + stakeFeeIncorrect + protocolFeeIncorrect
      );
    });
  });

  describe("Registration access", () => {
    let fixedPrice: bigint;
    let domainConfigs: Array<IDomainConfigForTest>;
    let regResults: Array<IPathRegResult>;
    let fixedFeePercentage: bigint;
    let helperAddress: string;

    before(async () => {
      [
        deployer,
        zeroVault,
        governor,
        admin,
        rootOwner,
        operator,
        lvl2SubOwner,
        lvl3SubOwner,
        lvl4SubOwner,
        lvl5SubOwner,
        lvl6SubOwner,
      ] = await hre.ethers.getSigners();
      // zeroVault address is used to hold the fee charged to the user when registering
      zns = await deployZNS({
        deployer,
        governorAddresses: [deployer.address, governor.address],
        adminAddresses: [admin.address],
        priceConfig: DEFAULT_PRICE_CONFIG,
        zeroVaultAddress: zeroVault.address,
      });

      helperAddress = await zns.subRegistrar.getEIP712AHelperAddress();

      fixedPrice = ethers.parseEther("397");
      fixedFeePercentage = BigInt(200);

      await Promise.all(
        [
          rootOwner,
          lvl2SubOwner,
          lvl3SubOwner,
          lvl4SubOwner,
          lvl5SubOwner,
          lvl6SubOwner,
        ].map(async ({ address }) =>
          zns.meowToken.mint(address, ethers.parseEther("1000000")))
      );
      await zns.meowToken.connect(rootOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      // register root domain and 1 subdomain
      domainConfigs = [
        {
          user: rootOwner,
          domainLabel: "root",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: rootOwner.address,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
          },
        },
        {
          user: lvl2SubOwner,
          domainLabel: "levelone",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: lvl2SubOwner.address,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
          },
        },
      ];

      regResults = await registerDomainPath({
        zns,
        domainConfigs,
      });
    });

    it("should allow parent owner to register a subdomain under himself even if accessType is LOCKED", async () => {
      await zns.subRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.LOCKED,
      );

      const balBefore = await zns.meowToken.balanceOf(lvl2SubOwner.address);

      const hash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        parentHash: regResults[1].domainHash,
        domainLabel: "ownercheck",
      });

      const latestBlock = await time.latestBlock();
      // look for an event where user pays himself
      const filter = zns.meowToken.filters.Transfer(lvl2SubOwner.address, lvl2SubOwner.address);
      const events = await zns.meowToken.queryFilter(
        filter,
        latestBlock - 50,
        latestBlock
      );
      // this means NO transfers have been executed, which is what we need
      expect(events.length).to.eq(0);

      const balAfter = await zns.meowToken.balanceOf(lvl2SubOwner.address);
      // the diff is 0 because user should not pay himself
      expect(balAfter - balBefore).to.eq(0);

      // check registry
      const dataFromReg = await zns.registry.getDomainRecord(hash);
      expect(dataFromReg.owner).to.eq(lvl2SubOwner.address);
      expect(dataFromReg.resolver).to.eq(await zns.addressResolver.getAddress());

      // check domain token
      const tokenId = BigInt(hash).toString();
      const tokenOwner = await zns.domainToken.ownerOf(tokenId);
      expect(tokenOwner).to.eq(lvl2SubOwner.address);

      // revert back to OPEN
      await zns.subRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.OPEN,
      );
    });

    it("should NOT allow others to register a domain when parent's accessType is LOCKED", async () => {
      // register parent with locked access
      const res = await registerDomainPath({
        zns,
        domainConfigs: [
          {
            user: lvl3SubOwner,
            domainLabel: "leveltwo",
            parentHash: regResults[1].domainHash,
            // when we do not specify accessType or config, it defaults to LOCKED
            // we can also set it as 0 specifically if setting a config
            fullConfig: fullDistrConfigEmpty,
          },
        ],
      });

      // try to register child
      await expect(
        zns.subRegistrar.connect(lvl5SubOwner).registerSubdomain(
          {
            parentHash: res[0].domainHash,
            label: "tobedenied",
            domainAddress: ethers.ZeroAddress,
            tokenURI: DEFAULT_TOKEN_URI,
          },
          distrConfigEmpty,
          paymentConfigEmpty,
          ethers.ZeroHash
        )
      ).to.be.revertedWith(
        DISTRIBUTION_LOCKED_NOT_EXIST_ERR
      );
    });

    it("should allow anyone to register a domain when parent's accessType is OPEN", async () => {
      const { domainHash: parentHash } = regResults[1];
      const domainLabel = "alloweded";

      const {
        expectedPrice,
      } = getPriceObject(
        domainLabel,
        domainConfigs[1].fullConfig.priceConfig
      );

      const protocolFee = getStakingOrProtocolFee(expectedPrice);
      // approve direct payment
      await zns.meowToken.connect(lvl5SubOwner).approve(
        await zns.treasury.getAddress(),
        expectedPrice + protocolFee
      );

      await zns.subRegistrar.connect(lvl5SubOwner).registerSubdomain(
        {
          parentHash: parentHash,
          label: domainLabel,
          domainAddress: ethers.ZeroAddress,
          tokenURI: DEFAULT_TOKEN_URI,
        },
        distrConfigEmpty,
        paymentConfigEmpty,
        ethers.ZeroHash
      );

      const hash = await getDomainHashFromEvent({
        zns,
        user: lvl5SubOwner,
      });

      // check registry
      const dataFromReg = await zns.registry.getDomainRecord(hash);
      expect(dataFromReg.owner).to.eq(lvl5SubOwner.address);
      expect(dataFromReg.resolver).to.eq(ethers.ZeroAddress);

      // check domain token
      const tokenId = BigInt(hash).toString();
      const tokenOwner = await zns.domainToken.ownerOf(tokenId);
      expect(tokenOwner).to.eq(lvl5SubOwner.address);
    });

    // eslint-disable-next-line max-len
    it("should ONLY allow mintlisted addresses and NOT allow other ones to register a domain when parent's accessType is MINTLIST", async () => {
      // approve direct payment
      await zns.meowToken.connect(lvl3SubOwner).approve(await zns.treasury.getAddress(), fixedPrice);
      // register parent with mintlisted access
      const parentHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: regResults[1].domainHash,
        domainLabel: "mintlistparent",
        fullConfig: {
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            paymentType: PaymentType.DIRECT,
            accessType: AccessType.MINTLIST,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl3SubOwner.address,
          },
          priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
        },
      });

      const label = "mintlisted";
      const signature = await createCouponSignature(
        parentHash,
        lvl4SubOwner.address,
        label,
        helperAddress,
        rootOwner
      )

      // recreated coupon
      const coupon = {
        parentHash: parentHash,
        registrantAddress: lvl4SubOwner.address,
        domainLabel: label,
      }

      // register child
      const hash = await registrationWithSetup({
        zns,
        user: lvl4SubOwner,
        parentHash,
        domainLabel: label,
        signature,
      });

      // check registry
      const dataFromReg = await zns.registry.getDomainRecord(hash);
      expect(dataFromReg.owner).to.eq(lvl4SubOwner.address);
      expect(dataFromReg.resolver).to.eq(await zns.addressResolver.getAddress());

      // check domain token
      const tokenId = BigInt(hash).toString();
      const tokenOwner = await zns.domainToken.ownerOf(tokenId);
      expect(tokenOwner).to.eq(lvl4SubOwner.address);

      // try to register child with non-mintlisted user
      await expect(
        zns.subRegistrar.connect(lvl5SubOwner).registerSubdomain(
          {
            parentHash: parentHash,
            label: "notmintlisted",
            domainAddress: ethers.ZeroAddress,
            tokenURI: DEFAULT_TOKEN_URI,
          },
          distrConfigEmpty,
          paymentConfigEmpty,
          signature
        )
      ).to.be.revertedWith(
        INVALID_MINTLIST_CLAIM_ERR
      );

      // try to register again
      await expect(
        zns.subRegistrar.connect(lvl4SubOwner).registerSubdomain(
          {
            parentHash: parentHash,
            label: "notmintlistednow",
            domainAddress: ethers.ZeroAddress,
            tokenURI: DEFAULT_TOKEN_URI,
          },
          distrConfigEmpty,
          paymentConfigEmpty,
          signature
        )
      ).to.be.revertedWith(
        INVALID_MINTLIST_CLAIM_ERR
      );
    });

    it("should switch accessType for existing parent domain", async () => {
      await zns.subRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.LOCKED
      );

      const notAllowedLabel = "notallowed";

      await expect(
        zns.subRegistrar.connect(lvl5SubOwner).registerSubdomain(
          {
            parentHash: regResults[1].domainHash,
            label: notAllowedLabel,
            domainAddress: ethers.ZeroAddress,
            tokenURI: DEFAULT_TOKEN_URI,
          },
          distrConfigEmpty,
          paymentConfigEmpty,
          ethers.ZeroHash
        )
      ).to.be.revertedWith(
        DISTRIBUTION_LOCKED_NOT_EXIST_ERR
      );

      // switch to mintlist
      await zns.subRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.MINTLIST
      );

      const label = "alloweddddd";

      // approve
      const {
        expectedPrice,
        stakeFee,
      } = getPriceObject(
        notAllowedLabel,
        domainConfigs[1].fullConfig.priceConfig
      );
      const paymentToParent = domainConfigs[1].fullConfig.distrConfig.paymentType === PaymentType.STAKE
        ? expectedPrice + stakeFee
        : expectedPrice;

      const protocolFee = getStakingOrProtocolFee(paymentToParent);
      await zns.meowToken.connect(lvl5SubOwner).approve(
        await zns.treasury.getAddress(),
        paymentToParent + protocolFee
      );

      const signature = await createCouponSignature(
        regResults[1].domainHash,
        lvl5SubOwner.address,
        label,
        helperAddress,
        rootOwner
      )
      // register, TODO fails here
      await zns.subRegistrar.connect(lvl5SubOwner).registerSubdomain(
        {
          parentHash: regResults[1].domainHash,
          label: label,
          domainAddress: ethers.ZeroAddress,
          tokenURI: DEFAULT_TOKEN_URI,
        },
        distrConfigEmpty,
        paymentConfigEmpty,
        signature
      );

      const hash = await getDomainHashFromEvent({
        zns,
        user: lvl5SubOwner,
      });

      // check registry
      const dataFromReg = await zns.registry.getDomainRecord(hash);
      expect(dataFromReg.owner).to.eq(lvl5SubOwner.address);

      // switch back to open
      await zns.subRegistrar.connect(lvl2SubOwner).setAccessTypeForDomain(
        regResults[1].domainHash,
        AccessType.OPEN
      );
    });

    // eslint-disable-next-line max-len
    it("should NOT allow to register subdomains under the parent that hasn't set up his distribution config", async () => {
      const parentHash = await registrationWithSetup({
        zns,
        user: lvl3SubOwner,
        parentHash: regResults[1].domainHash,
        domainLabel: "parentnoconfig",
        fullConfig: fullDistrConfigEmpty, // accessType is 0 when supplying empty config
      });

      await expect(
        zns.subRegistrar.connect(lvl4SubOwner).registerSubdomain(
          {
            parentHash: parentHash,
            label: "notallowed",
            domainAddress: ethers.ZeroAddress,
            tokenURI: DEFAULT_TOKEN_URI,
          },
          distrConfigEmpty,
          paymentConfigEmpty,
          ethers.ZeroHash
        )
      ).to.be.revertedWith(
        DISTRIBUTION_LOCKED_NOT_EXIST_ERR
      );
    });
  });

  describe("Existing subdomain ops", () => {
    let fixedPrice: bigint;
    let domainConfigs: Array<IDomainConfigForTest>;
    let regResults: Array<IPathRegResult>;
    let fixedFeePercentage: bigint;

    before(async () => {
      [
        deployer,
        zeroVault,
        governor,
        admin,
        operator,
        rootOwner,
        lvl2SubOwner,
        lvl3SubOwner,
        lvl4SubOwner,
        lvl5SubOwner,
        lvl6SubOwner,
      ] = await hre.ethers.getSigners();
      // zeroVault address is used to hold the fee charged to the user when registering
      zns = await deployZNS({
        deployer,
        governorAddresses: [deployer.address, governor.address],
        adminAddresses: [admin.address],
        priceConfig: DEFAULT_PRICE_CONFIG,
        zeroVaultAddress: zeroVault.address,
      });

      fixedPrice = ethers.parseEther("397");
      fixedFeePercentage = BigInt(200);

      await Promise.all(
        [
          rootOwner,
          lvl2SubOwner,
          lvl3SubOwner,
          lvl4SubOwner,
          lvl5SubOwner,
          lvl6SubOwner,
        ].map(async ({ address }) =>
          zns.meowToken.mint(address, ethers.parseEther("1000000")))
      );
      await zns.meowToken.connect(rootOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      // register root domain and 1 subdomain
      domainConfigs = [
        {
          user: rootOwner,
          domainLabel: "root",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              paymentType: PaymentType.STAKE,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: rootOwner.address,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
          },
        },
        {
          user: lvl2SubOwner,
          domainLabel: "leveltwo",
          tokenURI: "http://example.com/leveltwo",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.fixedPricer.getAddress(),
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: lvl2SubOwner.address,
            },
            priceConfig: { price: fixedPrice, feePercentage: fixedFeePercentage },
          },
        },
        {
          user: lvl3SubOwner,
          domainLabel: "lvlthree",
          tokenURI: "http://example.com/lvlthree",
          fullConfig: {
            distrConfig: {
              pricerContract: await zns.curvePricer.getAddress(),
              paymentType: PaymentType.DIRECT,
              accessType: AccessType.OPEN,
            },
            paymentConfig: {
              token: await zns.meowToken.getAddress(),
              beneficiary: lvl3SubOwner.address,
            },
            priceConfig: DEFAULT_PRICE_CONFIG,
          },
        },
      ];

      regResults = await registerDomainPath({
        zns,
        domainConfigs,
      });
    });

    it("should NOT allow to register an existing subdomain that has not been revoked", async () => {
      await expect(
        zns.subRegistrar.connect(lvl2SubOwner).registerSubdomain(
          {
            parentHash: regResults[0].domainHash,
            label: domainConfigs[1].domainLabel,
            domainAddress: lvl2SubOwner.address,
            tokenURI: DEFAULT_TOKEN_URI,
          },
          domainConfigs[1].fullConfig.distrConfig,
          paymentConfigEmpty,
          ethers.ZeroHash
        )
      ).to.be.revertedWith(
        "ZNSSubRegistrar: Subdomain already exists"
      );
    });

    it("should NOT allow revoking when the caller is NOT an owner of both Name and Token", async () => {
      // change owner of the domain
      await zns.registry.connect(lvl2SubOwner).updateDomainOwner(
        regResults[1].domainHash,
        rootOwner.address
      );

      // fail
      await expect(
        zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
          regResults[1].domainHash,
        )
      ).to.be.revertedWith(
        "ZNSRootRegistrar: Not the owner of both Name and Token"
      );

      // change owner back
      await zns.registry.connect(rootOwner).updateDomainOwner(
        regResults[1].domainHash,
        lvl2SubOwner.address
      );

      // tranfer token
      await zns.domainToken.connect(lvl2SubOwner).transferFrom(
        lvl2SubOwner.address,
        lvl3SubOwner.address,
        regResults[1].domainHash
      );

      // fail again
      await expect(
        zns.rootRegistrar.connect(lvl2SubOwner).revokeDomain(
          regResults[1].domainHash,
        )
      ).to.be.revertedWith(
        "ZNSRootRegistrar: Not the owner of both Name and Token"
      );

      // give token back
      await zns.domainToken.connect(lvl3SubOwner).transferFrom(
        lvl3SubOwner.address,
        lvl2SubOwner.address,
        regResults[1].domainHash
      );
    });

    it("should allow to UPDATE domain data for subdomain", async () => {
      const dataFromReg = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromReg.owner).to.eq(lvl2SubOwner.address);
      expect(dataFromReg.resolver).to.eq(await zns.addressResolver.getAddress());

      await zns.registry.connect(lvl2SubOwner).updateDomainRecord(
        regResults[1].domainHash,
        lvl3SubOwner.address,
        ethers.ZeroAddress,
      );

      const dataFromRegAfter = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromRegAfter.owner).to.eq(lvl3SubOwner.address);
      expect(dataFromRegAfter.resolver).to.eq(ethers.ZeroAddress);

      // reclaim to switch ownership back to original owner
      await zns.rootRegistrar.connect(lvl2SubOwner).reclaimDomain(
        regResults[1].domainHash,
      );

      const dataFromRegAfterReclaim = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromRegAfterReclaim.owner).to.eq(lvl2SubOwner.address);
      expect(dataFromRegAfterReclaim.resolver).to.eq(ethers.ZeroAddress);
    });

    describe("#setDistributionConfigForDomain()", () => {
      it("should re-set distribution config for an existing subdomain", async () => {
        const domainHash = regResults[2].domainHash;

        const distrConfigBefore = await zns.subRegistrar.distrConfigs(domainHash);
        expect(distrConfigBefore.accessType).to.not.eq(AccessType.MINTLIST);
        expect(distrConfigBefore.pricerContract).to.not.eq(await zns.fixedPricer.getAddress());
        expect(
          distrConfigBefore.paymentType
        ).to.not.eq(
          PaymentType.STAKE
        );

        const newConfig = {
          pricerContract: await zns.fixedPricer.getAddress(),
          paymentType: PaymentType.STAKE,
          accessType: AccessType.MINTLIST,
        };

        await zns.subRegistrar.connect(lvl3SubOwner).setDistributionConfigForDomain(
          domainHash,
          newConfig,
        );

        const distrConfigAfter = await zns.subRegistrar.distrConfigs(domainHash);
        expect(distrConfigAfter.accessType).to.eq(newConfig.accessType);
        expect(distrConfigAfter.pricerContract).to.eq(newConfig.pricerContract);
        expect(distrConfigAfter.paymentType).to.eq(newConfig.paymentType);

        // assign operator in registry
        await zns.registry.connect(lvl3SubOwner).setOwnersOperator(
          operator.address,
          true,
        );

        // reset it back
        await zns.subRegistrar.connect(operator).setDistributionConfigForDomain(
          domainHash,
          domainConfigs[2].fullConfig.distrConfig,
        );
        const origConfigAfter = await zns.subRegistrar.distrConfigs(domainHash);
        expect(origConfigAfter.accessType).to.eq(domainConfigs[2].fullConfig.distrConfig.accessType);
        expect(origConfigAfter.pricerContract).to.eq(domainConfigs[2].fullConfig.distrConfig.pricerContract);
        expect(
          origConfigAfter.paymentType
        ).to.eq(
          domainConfigs[2].fullConfig.distrConfig.paymentType
        );

        // remove operator
        await zns.registry.connect(lvl3SubOwner).setOwnersOperator(
          operator.address,
          false,
        );
      });

      it("should NOT allow to set distribution config for a non-authorized account", async () => {
        const domainHash = regResults[1].domainHash;

        const newConfig = {
          pricerContract: await zns.curvePricer.getAddress(),
          paymentType: PaymentType.STAKE,
          accessType: AccessType.MINTLIST,
        };

        await expect(
          zns.subRegistrar.connect(lvl3SubOwner).setDistributionConfigForDomain(
            domainHash,
            newConfig,
          )
        ).to.be.revertedWith(
          "ZNSSubRegistrar: Not authorized"
        );
      });

      it("should revert if pricerContract is passed as 0x0 address", async () => {
        const domainHash = regResults[2].domainHash;

        const newConfig = {
          pricerContract: ethers.ZeroAddress,
          paymentType: PaymentType.STAKE,
          accessType: AccessType.MINTLIST,
        };

        await expect(
          zns.subRegistrar.connect(lvl3SubOwner).setDistributionConfigForDomain(
            domainHash,
            newConfig,
          )
        ).to.be.revertedWith(
          "ZNSSubRegistrar: pricerContract can not be 0x0 address"
        );
      });
    });

    describe("#setPricerContractForDomain()", () => {
      it("should re-set pricer contract for an existing subdomain", async () => {
        const domainHash = regResults[2].domainHash;

        const pricerContractBefore = await zns.subRegistrar.distrConfigs(domainHash);
        expect(pricerContractBefore.pricerContract).to.eq(domainConfigs[2].fullConfig.distrConfig.pricerContract);

        await zns.subRegistrar.connect(lvl3SubOwner).setPricerContractForDomain(
          domainHash,
          await zns.curvePricer.getAddress(),
        );

        const pricerContractAfter = await zns.subRegistrar.distrConfigs(domainHash);
        expect(pricerContractAfter.pricerContract).to.eq(await zns.curvePricer.getAddress());

        // reset it back
        await zns.subRegistrar.connect(lvl3SubOwner).setPricerContractForDomain(
          domainHash,
          domainConfigs[2].fullConfig.distrConfig.pricerContract,
        );
      });

      it("should NOT allow setting for non-authorized account", async () => {
        const domainHash = regResults[2].domainHash;

        await expect(
          zns.subRegistrar.connect(lvl2SubOwner).setPricerContractForDomain(
            domainHash,
            await zns.curvePricer.getAddress(),
          )
        ).to.be.revertedWith(
          "ZNSSubRegistrar: Not authorized"
        );
      });

      it("should NOT set pricerContract to 0x0 address", async () => {
        const domainHash = regResults[2].domainHash;

        await expect(
          zns.subRegistrar.connect(lvl3SubOwner).setPricerContractForDomain(
            domainHash,
            ethers.ZeroAddress,
          )
        ).to.be.revertedWith(
          "ZNSSubRegistrar: pricerContract can not be 0x0 address"
        );
      });
    });

    describe("#setPaymentTypeForDomain()", () => {
      it("should re-set payment type for an existing subdomain", async () => {
        const domainHash = regResults[2].domainHash;

        const { paymentType: paymentTypeBefore } = await zns.subRegistrar.distrConfigs(domainHash);
        expect(paymentTypeBefore).to.eq(domainConfigs[2].fullConfig.distrConfig.paymentType);

        await zns.subRegistrar.connect(lvl3SubOwner).setPaymentTypeForDomain(
          domainHash,
          PaymentType.STAKE,
        );

        const { paymentType: paymentTypeAfter } = await zns.subRegistrar.distrConfigs(domainHash);
        expect(paymentTypeAfter).to.eq(PaymentType.STAKE);

        // reset it back
        await zns.subRegistrar.connect(lvl3SubOwner).setPaymentTypeForDomain(
          domainHash,
          domainConfigs[2].fullConfig.distrConfig.paymentType,
        );
      });

      it("should NOT allow setting for non-authorized account", async () => {
        const domainHash = regResults[2].domainHash;

        await expect(
          zns.subRegistrar.connect(lvl2SubOwner).setPaymentTypeForDomain(
            domainHash,
            PaymentType.STAKE,
          )
        ).to.be.revertedWith(
          "ZNSSubRegistrar: Not authorized"
        );
      });

      it("should emit #PaymentTypeSet event with correct params", async () => {
        const domainHash = regResults[2].domainHash;

        await expect(
          zns.subRegistrar.connect(lvl3SubOwner).setPaymentTypeForDomain(
            domainHash,
            PaymentType.STAKE,
          )
        ).to.emit(zns.subRegistrar, "PaymentTypeSet").withArgs(
          domainHash,
          PaymentType.STAKE,
        );

        // reset back
        await zns.subRegistrar.connect(lvl3SubOwner).setPaymentTypeForDomain(
          domainHash,
          domainConfigs[2].fullConfig.distrConfig.paymentType,
        );
      });
    });

    // eslint-disable-next-line max-len
    it("should TRANSFER ownership of a subdomain and let the receiver RECLAIM and then revoke with REFUND", async () => {
      const tokenId = BigInt(regResults[1].domainHash).toString();

      const { amount: stakedBefore } = await zns.treasury.stakedForDomain(regResults[1].domainHash);

      await zns.domainToken.connect(lvl2SubOwner).transferFrom(
        lvl2SubOwner.address,
        lvl3SubOwner.address,
        tokenId
      );

      // Verify owner in registry
      const dataFromReg = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromReg.owner).to.eq(lvl2SubOwner.address);

      // reclaim
      await zns.rootRegistrar.connect(lvl3SubOwner).reclaimDomain(
        regResults[1].domainHash,
      );

      // Verify domain token is still owned
      const tokenOwner = await zns.domainToken.ownerOf(tokenId);
      expect(tokenOwner).to.eq(lvl3SubOwner.address);

      // Verify owner in registry
      const dataFromRegAfter = await zns.registry.getDomainRecord(regResults[1].domainHash);
      expect(dataFromRegAfter.owner).to.eq(lvl3SubOwner.address);

      // verify stake still existing
      const { amount: stakedAfter } = await zns.treasury.stakedForDomain(regResults[1].domainHash);
      expect(stakedAfter).to.eq(stakedBefore);

      const userBalbefore = await zns.meowToken.balanceOf(lvl3SubOwner.address);

      const protocolFee = getStakingOrProtocolFee(stakedAfter);

      await zns.meowToken.connect(lvl3SubOwner).approve(await zns.treasury.getAddress(), protocolFee);
      // try revoking
      await zns.rootRegistrar.connect(lvl3SubOwner).revokeDomain(
        regResults[1].domainHash,
      );

      // verify that refund has been acquired by the new owner
      const userBalAfter = await zns.meowToken.balanceOf(lvl3SubOwner.address);
      expect(userBalAfter - userBalbefore).to.eq(fixedPrice - protocolFee);
    });
  });

  describe("State setters", () => {
    before(async () => {
      [
        deployer,
        admin,
        random,
      ] = await hre.ethers.getSigners();

      zns = await deployZNS({
        deployer,
        governorAddresses: [deployer.address],
        adminAddresses: [admin.address],
      });
    });

    it("Should NOT let initialize the implementation contract", async () => {
      const factory = new ZNSSubRegistrar__factory(deployer);
      const impl = await getProxyImplAddress(await zns.subRegistrar.getAddress());
      const implContract = factory.attach(impl) as ZNSSubRegistrar;

      await expect(
        implContract.initialize(
          deployer.address,
          deployer.address,
          deployer.address,
        )
      ).to.be.revertedWith(INITIALIZED_ERR);
    });

    it("#setRootRegistrar() should set the new root registrar correctly and emit #RootRegistrarSet event", async () => {
      const tx = await zns.subRegistrar.connect(admin).setRootRegistrar(random.address);

      await expect(tx).to.emit(zns.subRegistrar, "RootRegistrarSet").withArgs(random.address);

      expect(await zns.subRegistrar.rootRegistrar()).to.equal(random.address);
    });

    it("#setRootRegistrar() should NOT be callable by anyone other than ADMIN_ROLE", async () => {
      await expect(
        zns.subRegistrar.connect(random).setRootRegistrar(random.address),
      ).to.be.revertedWith(
        getAccessRevertMsg(random.address, ADMIN_ROLE),
      );
    });

    it("#setRootRegistrar should NOT set registrar as 0x0 address", async () => {
      await expect(
        zns.subRegistrar.connect(admin).setRootRegistrar(ethers.ZeroAddress),
      ).to.be.revertedWith(
        "ZNSSubRegistrar: _registrar can not be 0x0 address",
      );
    });

    it("#setRegistry() should set the new registry correctly and emit #RegistrySet event", async () => {
      const tx = await zns.subRegistrar.connect(admin).setRegistry(random.address);

      await expect(tx).to.emit(zns.subRegistrar, "RegistrySet").withArgs(random.address);

      expect(await zns.subRegistrar.registry()).to.equal(random.address);
    });

    it("#setRegistry() should not be callable by anyone other than ADMIN_ROLE", async () => {
      await expect(
        zns.subRegistrar.connect(random).setRegistry(random.address),
      ).to.be.revertedWith(
        getAccessRevertMsg(random.address, ADMIN_ROLE),
      );
    });

    it("#setAccessController() should not be callable by anyone other than ADMIN_ROLE", async () => {
      await expect(
        zns.subRegistrar.connect(random).setAccessController(random.address),
      ).to.be.revertedWith(
        getAccessRevertMsg(random.address, ADMIN_ROLE),
      );
    });

    it("#getAccessController() should return the correct access controller", async () => {
      expect(
        await zns.subRegistrar.getAccessController()
      ).to.equal(await zns.accessController.getAddress());
    });

    // eslint-disable-next-line max-len
    it("#setAccessController() should set the new access controller correctly and emit #AccessControllerSet event", async () => {
      const tx = await zns.subRegistrar.connect(admin).setAccessController(random.address);

      await expect(tx).to.emit(zns.subRegistrar, "AccessControllerSet").withArgs(random.address);

      expect(await zns.subRegistrar.getAccessController()).to.equal(random.address);
    });
  });

  describe("UUPS", () => {
    let fixedPrice: bigint;
    let rootHash: string;

    beforeEach(async () => {
      [
        deployer,
        zeroVault,
        governor,
        admin,
        rootOwner,
        lvl2SubOwner,
      ] = await hre.ethers.getSigners();
      // zeroVault address is used to hold the fee charged to the user when registering
      zns = await deployZNS({
        deployer,
        governorAddresses: [deployer.address, governor.address],
        adminAddresses: [admin.address],
        priceConfig: DEFAULT_PRICE_CONFIG,
        zeroVaultAddress: zeroVault.address,
      });

      // Give funds to users
      await Promise.all(
        [
          rootOwner,
          lvl2SubOwner,
        ].map(async ({ address }) =>
          zns.meowToken.mint(address, ethers.parseEther("1000000")))
      );
      await zns.meowToken.connect(rootOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      fixedPrice = ethers.parseEther("397.13");
      // register root domain
      rootHash = await registrationWithSetup({
        zns,
        user: rootOwner,
        domainLabel: "root",
        fullConfig: {
          distrConfig: {
            accessType: AccessType.OPEN,
            pricerContract: await zns.fixedPricer.getAddress(),
            paymentType: PaymentType.DIRECT,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
          priceConfig: {
            price: fixedPrice,
            feePercentage: BigInt(0),
          },
        },
      });
    });

    it("Allows an authorized user to upgrade the contract", async () => {
      // SubRegistrar to upgrade to
      const factory = new ZNSSubRegistrarUpgradeMock__factory(deployer);
      const newRegistrar = await factory.deploy();
      await newRegistrar.waitForDeployment();

      // Confirm the deployer is a governor, as set in `deployZNS` helper
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const tx = zns.subRegistrar.connect(deployer).upgradeTo(await newRegistrar.getAddress());
      await expect(tx).to.not.be.reverted;

      await expect(
        zns.subRegistrar.connect(deployer).initialize(
          await zns.accessController.getAddress(),
          await zns.registry.getAddress(),
          await zns.rootRegistrar.getAddress(),
        )
      ).to.be.revertedWith(INITIALIZED_ERR);
    });

    it("Fails to upgrade if the caller is not authorized", async () => {
      // SubRegistrar to upgrade to
      const factory = new ZNSSubRegistrarUpgradeMock__factory(deployer);
      const newRegistrar = await factory.deploy();
      await newRegistrar.waitForDeployment();

      // Confirm the account is not a governor
      await expect(zns.accessController.checkGovernor(lvl2SubOwner.address)).to.be.reverted;

      const tx = zns.subRegistrar.connect(lvl2SubOwner).upgradeTo(await newRegistrar.getAddress());

      await expect(tx).to.be.revertedWith(
        getAccessRevertMsg(lvl2SubOwner.address, GOVERNOR_ROLE)
      );
    });

    it("Verifies that variable values are not changed in the upgrade process", async () => {
      // Confirm deployer has the correct role first
      await expect(zns.accessController.checkGovernor(deployer.address)).to.not.be.reverted;

      const registrarFactory = new ZNSSubRegistrarUpgradeMock__factory(deployer);
      const registrar = await registrarFactory.deploy();
      await registrar.waitForDeployment();

      const domainLabel = "world";

      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);
      await zns.meowToken.mint(lvl2SubOwner.address, ethers.parseEther("1000000"));

      const domainHash = await registrationWithSetup({
        zns,
        user: lvl2SubOwner,
        domainLabel,
        parentHash: rootHash,
        fullConfig: {
          distrConfig: {
            accessType: AccessType.OPEN,
            pricerContract: await zns.fixedPricer.getAddress(),
            paymentType: PaymentType.DIRECT,
          },
          priceConfig: {
            price: fixedPrice,
            feePercentage: BigInt(0),
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
      });

      await zns.subRegistrar.setRootRegistrar(lvl2SubOwner.address);

      const contractCalls = [
        zns.subRegistrar.getAccessController(),
        zns.subRegistrar.registry(),
        zns.subRegistrar.rootRegistrar(),
        zns.registry.exists(domainHash),
        zns.treasury.stakedForDomain(domainHash),
        zns.domainToken.name(),
        zns.domainToken.symbol(),
        zns.fixedPricer.getPrice(rootHash, domainLabel, false),
      ];

      await validateUpgrade(deployer, zns.subRegistrar, registrar, registrarFactory, contractCalls);
    });

    it("Allows to add more fields to the existing struct in a mapping", async () => {
      // SubRegistrar to upgrade to
      const factory = new ZNSSubRegistrarUpgradeMock__factory(deployer);

      const rootConfigBefore = await zns.subRegistrar.distrConfigs(rootHash);

      expect(rootConfigBefore.accessType).to.eq(AccessType.OPEN);
      expect(rootConfigBefore.pricerContract).to.eq(await zns.fixedPricer.getAddress());
      expect(rootConfigBefore.paymentType).to.eq(PaymentType.DIRECT);

      const tx = await hre.upgrades.upgradeProxy(
        await zns.subRegistrar.getAddress(),
        factory,
        {
          kind: "uups"
        }
      );

      // New instance from OZ helper above is still typed as the ZNSSubregistrar, not the new upgrade mock
      const newSubRegistrar = await tx.waitForDeployment() as unknown as ZNSSubRegistrarUpgradeMock
      
      // Verify change to `dist config` struct is not present even though we upgrade successfully
      expect((await zns.subRegistrar.distrConfigs(rootHash)).length).to.eq(3);
      expect((await newSubRegistrar.distrConfigs(rootHash)).length).to.eq(5);

      // Check values in storage
      const rootConfigAfter = await newSubRegistrar.distrConfigs(rootHash);

      expect(rootConfigAfter.accessType).to.eq(AccessType.OPEN);
      expect(rootConfigAfter.pricerContract).to.eq(await zns.fixedPricer.getAddress());
      expect(rootConfigAfter.paymentType).to.eq(PaymentType.DIRECT);

      // New values are present in the config type
      expect(rootConfigAfter.newAddress).to.eq(ethers.ZeroAddress);
      expect(rootConfigAfter.newUint).to.eq(BigInt(0));

      await zns.meowToken.mint(lvl2SubOwner.address, ethers.parseEther("1000000"));
      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), ethers.parseEther("1000000"));

      const subDistConfig = {
        accessType: AccessType.MINTLIST,
        pricerContract: await zns.curvePricer.getAddress(),
        paymentType: PaymentType.STAKE,
        newAddress: lvl2SubOwner.address,
        newUint: BigInt(1912171236),
      };

      const label = "subbb";

      // register a subdomain with new logic
      await newSubRegistrar.connect(lvl2SubOwner).registerSubdomain(
        {
          parentHash: rootHash,
          label: label,
          domainAddress: lvl2SubOwner.address,
          tokenURI: DEFAULT_TOKEN_URI,
        },
        subDistConfig,
        paymentConfigEmpty,
        ethers.ZeroHash
      );

      const subHash = await getDomainHashFromEvent({
        zns,
        user: lvl2SubOwner,
      });

      const subConfig = await newSubRegistrar.distrConfigs(subHash);

      expect(subConfig.accessType).to.eq(subDistConfig.accessType);
      expect(subConfig.pricerContract).to.eq(subDistConfig.pricerContract);
      expect(subConfig.paymentType).to.eq(subDistConfig.paymentType);
      expect(subConfig.newAddress).to.eq(subDistConfig.newAddress);
      expect(subConfig.newUint).to.eq(subDistConfig.newUint);

      // check that crucial state vars stayed the same
      expect(await newSubRegistrar.getAccessController()).to.eq(await zns.accessController.getAddress());
      expect(await newSubRegistrar.registry()).to.eq(await zns.registry.getAddress());
      expect(await newSubRegistrar.rootRegistrar()).to.eq(await zns.rootRegistrar.getAddress());
    });
  });
});
