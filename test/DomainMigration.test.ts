import * as hre from "hardhat";
import { getConfig } from "../src/deploy/campaign/get-config";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { Domain } from "../src/utils/migration/types";
import { ROOT_COLL_NAME, SUB_COLL_NAME } from "../src/utils/migration/constants";
import { distrConfigEmpty, IZNSContractsLocal, paymentConfigEmpty } from "./helpers";
import { migration } from "../src/utils/migration/02_registration";
import { connectToDb, getSubdomainParentHash } from "../src/utils/migration/helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ZeroAddress } from "ethers";
import { expect } from "chai";


let deployer : SignerWithAddress;
let zeroVault : SignerWithAddress;
let safe : SignerWithAddress;
let governor : SignerWithAddress;
let admin : SignerWithAddress;

let userBalanceInitial : bigint;

let zns : IZNSContractsLocal;

let rootsToRevoke : Array<Domain>;
let subsToRevoke : Array<Domain>;

let domains : Array<Domain>;

describe.only("Domain Migration", () => {
  before(async () => {
    [deployer, zeroVault, governor, admin, safe] = await hre.ethers.getSigners();

    const config = await getConfig({
      deployer,
      zeroVaultAddress: zeroVault.address,
      governors: [deployer.address, governor.address],
      admins: [deployer.address, admin.address],
    });

    const campaign = await runZnsCampaign({
      config,
    });

    zns = campaign.state.contracts;

    await zns.meowToken.connect(deployer).approve(
      await zns.treasury.getAddress(),
      hre.ethers.MaxUint256
    );

    userBalanceInitial = hre.ethers.MaxInt256;

    // Give funds to user
    await zns.meowToken.connect(deployer).approve(await zns.treasury.getAddress(), hre.ethers.MaxUint256);
    await zns.meowToken.mint(deployer.address, userBalanceInitial);

    const domainsDbClient = await connectToDb();

    rootsToRevoke = await domainsDbClient.collection(ROOT_COLL_NAME).find(
      { isRevoked: true }
    ).toArray() as unknown as Array<Domain>;

    subsToRevoke = await domainsDbClient.collection(SUB_COLL_NAME).find(
      { isRevoked: true }
    ).toArray() as unknown as Array<Domain>;

    domains = [ ...rootsToRevoke, ...subsToRevoke ] as unknown as Array<Domain>;

    const sortedDomains = domains.sort((a, b) => a.depth - b.depth);

    for (const domain of sortedDomains) {
      if (domain.depth === 0) {
        await zns.rootRegistrar.connect(deployer).registerRootDomain({
          name: domain.label,
          domainAddress: domain.address,
          tokenOwner: domain.owner.id,
          tokenURI: domain.tokenURI,
          distrConfig: distrConfigEmpty,
          paymentConfig: paymentConfigEmpty,
        });
      } else {
        const parHash = getSubdomainParentHash(domain);
        const exist = await zns.registry.exists(parHash);
        const { label, tokenURI, id } = domain.parent as Domain;

        expect(parHash).to.eq(id);

        if (!exist) {
          await zns.rootRegistrar.connect(deployer).registerRootDomain({
            name: label,
            domainAddress: ZeroAddress,
            tokenOwner: safe.address,
            tokenURI,
            distrConfig: distrConfigEmpty,
            paymentConfig: paymentConfigEmpty,
          });
        } else {
          await zns.subRegistrar.connect(deployer).registerSubdomain({
            parentHash: parHash,
            label: domain.label,
            domainAddress: domain.address,
            tokenOwner: domain.owner.id,
            tokenURI: domain.tokenURI,
            distrConfig: distrConfigEmpty,
            paymentConfig: paymentConfigEmpty,
          });
        }
      }

      // expect(
      //   await zns.registry.exists(domain.id)
      // ).to.be.true;

      // expect(
      //   await zns.domainToken.ownerOf(domain.tokenId)
      // ).to.be.equal(domain.owner.id);
    }
  });

  it("Should revoke all domains using batches", async () => {
    const result = await migration();
    if (!result) {
      throw new Error("migration() did not return a result");
    }
    const { revokeBatches } = result;

    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < revokeBatches.length; i++) {
      const tx = await deployer.sendTransaction({
        to: zns.rootRegistrar.getAddress(),
        data: revokeBatches[i].data,
      });
      await tx.wait();

      const {
        id,
        tokenId,
      } = domains[i];

      expect(
        await zns.registry.exists(id)
      ).to.be.false;

      await expect(
        zns.domainToken.ownerOf(tokenId)
      ).to.be.reverted;
    }
  });
});