import * as hre from "hardhat";
import { getConfig } from "../src/deploy/campaign/get-config";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { Domain } from "../src/utils/migration/types";
import { distrConfigEmpty, hashDomainLabel, paymentConfigEmpty } from "./helpers";
import { createRevokes, getSubdomainParentHash } from "../src/utils/migration/helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ZeroAddress } from "ethers";
import { expect } from "chai";
import { IZNSContracts } from "../src/deploy/campaign/types";

let deployer : SignerWithAddress;
let zeroVault : SignerWithAddress;
let safe : SignerWithAddress;
let governor : SignerWithAddress;
let admin : SignerWithAddress;

let userBalanceInitial : bigint;

let zns : IZNSContracts;

let domainsToRevoke : Array<Domain>;

describe("Domain Migration", () => {
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

    await zns.meowToken.connect(safe).approve(
      await zns.treasury.getAddress(),
      hre.ethers.MaxUint256
    );

    userBalanceInitial = hre.ethers.MaxInt256;

    // Give funds to user
    await zns.meowToken.connect(safe).approve(await zns.treasury.getAddress(), hre.ethers.MaxUint256);
    await zns.meowToken.mint(safe.address, userBalanceInitial);

    const rootLabel = "root-domain";
    const lvl1subLabel = "sublvl1";
    const lvl2subLabel = "sublvl2";

    const rootHash = hashDomainLabel(rootLabel);
    const l1Hash = await zns.subRegistrar.hashWithParent(rootHash, lvl1subLabel);
    const l2Hash = await zns.subRegistrar.hashWithParent(l1Hash, lvl2subLabel);

    domainsToRevoke = [
      {
        id: rootHash,
        depth: 0,
        label: rootLabel,
        address: ZeroAddress,
        tokenURI: "https://zero.tech",
        tokenId: BigInt(rootHash),
      },
      {
        id: l1Hash,
        depth: 1,
        label: lvl1subLabel,
        parentHash: rootHash,
        parent: {
          id: rootHash,
          label: rootLabel,
          tokenURI: "",
        },
        address: ZeroAddress,
        tokenURI: "https://zero.tech",
        tokenId: BigInt(l1Hash),
      },
      {
        id: l2Hash,
        depth: 2,
        label: lvl2subLabel,
        parentHash: l1Hash,
        parent: {
          id: l1Hash,
          tokenURI: "",
          label: lvl1subLabel,
        },
        address: ZeroAddress,
        tokenURI: "https://zero.tech",
        tokenId: BigInt(l2Hash),
      },
    ] as unknown as Array<Domain>;

    // By sorting, we can be sure all parent domains are registered before child domains
    // domainsToRevoke = domains.filter((d) => d.isRevoked).sort((a, b) => a.depth - b.depth);

    for (const domain of domainsToRevoke) {
      if (domain.depth === 0) {
        await zns.rootRegistrar.connect(safe).registerRootDomain({
          name: domain.label,
          domainAddress: domain.address,
          tokenOwner: safe.address,
          tokenURI: domain.tokenURI,
          distrConfig: distrConfigEmpty,
          paymentConfig: paymentConfigEmpty,
        });
      } else {
        const parentHash = getSubdomainParentHash(domain);
        const exist = await zns.registry.exists(parentHash);
        const { label, tokenURI, id } = domain.parent as Domain;

        expect(parentHash).to.eq(id);

        if (!exist) {
          await zns.rootRegistrar.connect(safe).registerRootDomain({
            name: label,
            domainAddress: ZeroAddress,
            tokenOwner: safe.address,
            tokenURI,
            distrConfig: distrConfigEmpty,
            paymentConfig: paymentConfigEmpty,
          });
        } else {
          await zns.subRegistrar.connect(safe).registerSubdomain({
            parentHash,
            label: domain.label,
            domainAddress: domain.address,
            tokenOwner: safe.address,
            tokenURI: domain.tokenURI,
            distrConfig: distrConfigEmpty,
            paymentConfig: paymentConfigEmpty,
          });
        }
      }
    }
  });

  it("Should revoke all domains using batches", async () => {
    for (const domain of domainsToRevoke) {
      const owner = await zns.registry.getDomainOwner(domain.id);
      const tokenOwner = await zns.domainToken.ownerOf(domain.tokenId);

      expect(owner).to.eq(safe.address);
      expect(tokenOwner).to.eq(safe.address);
    }

    const { revokeTxs, failedRevokes } = await createRevokes(
      domainsToRevoke,
      zns.rootRegistrar,
      safe.address
    );

    expect(failedRevokes.length).to.eq(0);

    // Because we cannot use Safe API in local tests
    // We just loop and do each manually
    for (const [index, revokeTx] of revokeTxs.entries()) {
      const tx = await safe.sendTransaction({
        to: await zns.rootRegistrar.getAddress(),
        data: revokeTx.data,
      });

      await tx.wait();

      const {
        id,
        tokenId,
      } = domainsToRevoke[index];

      expect(await zns.registry.exists(id)).to.be.false;

      await expect(zns.domainToken.ownerOf(tokenId)).to.be.reverted;
    }
  });
});