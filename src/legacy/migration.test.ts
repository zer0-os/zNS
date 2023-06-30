import * as hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZNSContracts } from "../../test/helpers/types";
import { expect } from "chai";
import { deployZNS, hashDomainLabel, hashSubdomainName, priceConfigDefault } from "../../test/helpers";
import { contracts, defaultRegistrar } from "@zero-tech/zero-contracts";
import {
  LegacyRegistrar,
  LegacyRegistrar__factory,
} from "../../typechain";
import { burnAndMintDomains, extendDomain } from "./helper";

/**
 * Overall Goals - Validate the following
 * 1. We can remint old domains in the new system (register)
 * 2. We can point new domains to old Registrars/NFT collections
 * 3. We can use old Registrars as NFT collections with the new domains
 * 4. Calling old ZNS functions are either unavailable or even if it is (which will probably be the case),
 * it will NOT influence either the current collections, nor the new ZNS
 *
 * Note: These tests rely on the `LegacyRegistrar` and `LegacyRegistrar__factory` types from Typechain
 * To avoid bringing in the entire legacy zNS system that includes many contracts we wouldn't actually use,
 * we instead include the compiled ABI under `contracts/legacy/LegacyRegistrar.json`. To force Typechain
 * to generate a type interface for this contract, copy and paste the contents into the generated artifacts
 * folder that is the output from compiling contracts with Hardhat as follows
 *
 * From the root of this repository file structure, run
 * `$ yarn compile`
 * `$ mkdir -p `artifacts/contracts/legacy/LegacyRegistrar.sol`
 * `$ cp contracts/legacy/LegacyRegistrar.json artifacts/contracts/LegacyRegistrar.sol/LegacyRegistrar.json`
 * `$ yarn typechain`
 */


describe.only("ZNS WW NFTs Migration Tests", async () => {
  let deployer : SignerWithAddress;
  let admin : SignerWithAddress;
  let user : SignerWithAddress;
  let vault : SignerWithAddress;
  let owner : SignerWithAddress;
  let controller : SignerWithAddress;
  let zns : ZNSContracts;

  let legacyRegistrar : LegacyRegistrar;

  // Owner of the legacy ZNS Registrar
  const legacyOwner = "0x1A1d3644fc9906B1EE3d35842789A83D33e99943";

  // AuthBasicController from legacy ZNS deployments file
  const basicControllerAddress = "0x0347fb4268dDa1345c93308E9AFe3F0bc2312CE0";

  beforeEach(async () => {
    [deployer, admin, user, vault] = await hre.ethers.getSigners();

    owner = await hre.ethers.getImpersonatedSigner(legacyOwner);
    await hre.network.provider.send("hardhat_setBalance", [
      owner.address,
      "0xffffffffffffffffff",
    ]);

    controller = await hre.ethers.getImpersonatedSigner(basicControllerAddress);
    await hre.network.provider.send("hardhat_setBalance", [
      controller.address,
      "0xffffffffffffffffff",
    ]);

    legacyRegistrar = LegacyRegistrar__factory.connect(
      defaultRegistrar,
      owner
    );

    zns = await deployZNS({
      deployer,
      governorAddresses: [owner.address, deployer.address],
      adminAddresses: [owner.address, deployer.address, admin.address],
      priceConfig: priceConfigDefault,
      zeroVaultAddress: vault.address,
    });

    // Give funds to owner
    await zns.zeroToken.connect(owner).approve(zns.treasury.address, hre.ethers.constants.MaxUint256);
    await zns.zeroToken.mint(owner.address, priceConfigDefault.maxPrice.mul(25));

    // Give funds to user
    await zns.zeroToken.connect(user).approve(zns.treasury.address, hre.ethers.constants.MaxUint256);
    await zns.zeroToken.mint(user.address, priceConfigDefault.maxPrice.mul(25));
  });

  it("Can extend any domain or subdomain that's on the default registrar", async () => {
    const rootParent = "wilder";
    for(const sale of contracts.mainnet.sales) {
      await extendDomain(
        user,
        controller,
        rootParent,
        sale,
        legacyRegistrar
      );
    }
  });

  it("Fails to extend a domain that has a subdomain contract", async () => {
    const [moto] = contracts.mainnet.sales.filter(sale => {
      if (sale.name === "moto") return sale;
    });

    // Mint on new registry while pointing to existing nft contract works
    await zns.registrar.connect(user).registerDomain(moto.name, moto.domainContract);

    // Verify mint
    const domainHash = hashDomainLabel(moto.name);
    expect(await zns.registry.exists(domainHash)).to.be.true;

    const parentDomain = "wilder.moto";
    const newDomainLabel = "friends";
    const legacyDomainHash = hashSubdomainName(parentDomain);

    // Because `wilder.moto` has a subdomain contract, it cannot be extended
    const failTx = legacyRegistrar.connect(controller).registerDomain(
      legacyDomainHash,
      newDomainLabel,
      user.address,
      "https://ipfs.io/ipfs/Qmhash",
      0,
      true
    );
    await expect(failTx).to.be.revertedWithCustomError(legacyRegistrar, "SubdomainParent");
  });

  it("Fails to extend a subdomain using the subdomain's domain registrar contract", async () => {
    const [moto] = contracts.mainnet.sales.filter(sale => {
      if (sale.name === "moto") return sale;
    });

    // Provide certainty around existence of props for transpiler
    if (!moto.subcollections || moto.subcollections.length === 0) throw Error();

    const genesis = moto.subcollections[0];
    if (!genesis.nftContract) throw Error();

    const parentDomain = "wilder.moto.genesis";
    const newDomainLabel = "friends";
    const legacyDomainHash = hashSubdomainName(parentDomain);

    // Note we are using the *NFT* contract, not the domain contract here
    const motoRegistrar = LegacyRegistrar__factory.connect(genesis.domainContract, owner);

    const isController = await motoRegistrar.isController(controller.address);
    if (!isController) {
      await motoRegistrar.connect(owner).addController(controller.address);
    }

    const tx = motoRegistrar.connect(controller).registerDomain(
      legacyDomainHash,
      newDomainLabel,
      user.address,
      "https://ipfs.io/ipfs/Qmhash",
      0,
      true
    );
    await expect(tx).to.be.revertedWithCustomError(motoRegistrar, "SubdomainParent");
  });

  it("Can extend a subdomain using the subdomain's NFT registrar contract for a collection", async () => {
    // Any NFT collection that exists on its own contract (e.g. not the contract where its domain exists)
    // will be able to mint any extension of another domain because the `records` mapping for that
    // contract does not have the parentId in storage and so the parent check returns subdomain contract of 0x0
    // The contract does, however, have a "rootDomainId" which is only set in `initialize` and this
    // *does* have the ID of the containing domain, so the next check passes still
    // See L364 - L369 of legacy Registrar contract
    const [moto] = contracts.mainnet.sales.filter(sale => {
      if (sale.name === "moto") return sale;
    });

    // Provide certainty around existence of props for transpiler
    if (!moto.subcollections || moto.subcollections.length === 0) throw Error();

    const genesis = moto.subcollections[0];
    if (!genesis.nftContract) throw Error();

    // Mint on new registry while pointing to existing nft contract works
    await zns.registrar.connect(user).registerDomain(genesis.name, genesis.nftContract);

    const parentDomain = "wilder.moto.genesis";
    const newDomainLabel = "friends";
    const legacyDomainHash = hashSubdomainName(parentDomain);

    // Note we are using the *NFT* contract, not the domain contract here
    const motoRegistrar = LegacyRegistrar__factory.connect(genesis.nftContract, owner);

    const isController = await motoRegistrar.isController(controller.address);
    if (!isController) {
      await motoRegistrar.connect(owner).addController(controller.address);
    }

    const tx = motoRegistrar.connect(controller).registerDomain(
      legacyDomainHash,
      newDomainLabel,
      user.address,
      "https://ipfs.io/ipfs/Qmhash",
      0,
      true
    );
    await expect(tx).to.not.be.reverted;
  });

  it("Can mint domains on the new system and burn them on the old system", async () => {
    // The `beforeEach` loop resets the state of everything, but because the legacyRegistrar is
    // already deployed and accessed by forking mainnet the state doesn't get changed each loop.
    // Because we burn domains in this test, other tests can fail because the parent domain does
    // not exist, so we make sure to do this test last.
    const parentName = "wilder";

    for (const sale of contracts.mainnet.sales) {
      await burnAndMintDomains(
        owner,
        parentName,
        sale,
        zns,
        legacyRegistrar
      );
    }
  });
});