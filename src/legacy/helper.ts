
import { ZNSContracts } from "../../test/helpers/types";
import { defaultRegistrar, Collection } from "@zero-tech/zero-contracts";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { LegacyRegistrar, LegacyRegistrar__factory } from "../../typechain";
import { hashDomainLabel, hashSubdomainName, legacyHashWithParent } from "../../test/helpers";
import { expect } from "chai";

const burnAndMint = async (
  owner : SignerWithAddress,
  domainName : string,
  sale : Collection,
  zns : ZNSContracts,
  legacyRegistrar : LegacyRegistrar
) => {
  // Because we don't have logic for subdomains yet, everything is for top level domains.
  // This means we can create a conflict if two subdomain collections have the same name.
  // Normally this would be fine because those two domainIds will be hashed inclusive of
  // of the parentId, but to avoid conflicts in tests we use an additional random value here.
  const randomNumber = Math.floor(Math.random() * 10000);
  const registeredSaleName = `${sale.name}.${randomNumber}`;

  // Mint on new registrar
  const resolverContent = sale.nftContract ? sale.nftContract : sale.domainContract;
  await zns.registrar.connect(owner).registerDomain(registeredSaleName, resolverContent);

  // Verify mint
  const domainHash = hashDomainLabel(registeredSaleName);
  expect(await zns.registry.exists(domainHash)).to.be.true;

  // Burn on old registrar
  if (domainName === "wilder.WoW.poster") {
    // This is an edge case. The ENS libs work correctly in hashing every domain
    // name except this one. After writing a test contract that copies the
    // functionality on the legacy contract (link below) we confirm that the hash
    // is calculated differently and so we use the helper function `legacyHashWithParent`
    // instead for creating the tokenId from the hash before we burn it

    /* eslint-disable-next-line */
    // https://github.com/zer0-os/zNS-lgc/blob/0547392cdabb73cac9c11dfc6fc5a8aba93b7cc4/contracts/Registrar.sol#L110C23-L110C23

    const wowHash = legacyHashWithParent("WoW", hashSubdomainName("wilder"));
    const posterHash = legacyHashWithParent("poster", wowHash);
    await legacyRegistrar.connect(owner).adminBurnToken(posterHash);

    // Verify burn
    expect(await legacyRegistrar.domainExists(posterHash)).to.be.false;
  } else {
    const legacyDomainHash = hashSubdomainName(domainName);
    await legacyRegistrar.connect(owner).adminBurnToken(legacyDomainHash);

    // Verify burn
    expect(await legacyRegistrar.domainExists(legacyDomainHash)).to.be.false;
  }
};

const burnAndMintHelper = async (
  owner : SignerWithAddress,
  parentName : string,
  sales : Array<Collection>,
  zns : ZNSContracts,
  legacyRegistrar : LegacyRegistrar
) => {
  for (const sale of sales) {
    const domainName = `${parentName}.${sale.name}`;

    if (sale.subcollections) {
      await burnAndMintHelper(owner, domainName, sale.subcollections, zns, legacyRegistrar);
    }

    if (sale.domainContract === defaultRegistrar) {
      await burnAndMint(owner, domainName, sale, zns, legacyRegistrar);
    } else {
      // moto.genesis, beasts.wolf, and beasts.wape domains exist on subcontracts
      const legacySubRegistrar = LegacyRegistrar__factory.connect(sale.domainContract, owner);
      await burnAndMint(owner, domainName, sale, zns, legacySubRegistrar);
    }
  }
};

export const burnAndMintDomains = async (
  owner : SignerWithAddress,
  parentName : string,
  sale : Collection,
  zns : ZNSContracts,
  legacyRegistrar : LegacyRegistrar,
) => {
  // Burn and mint from the bottom up
  const domainName = `${parentName}.${sale.name}`;
  if (sale.subcollections) {
    await burnAndMintHelper(
      owner,
      domainName,
      sale.subcollections,
      zns,
      legacyRegistrar
    );
  }

  // Because we don't have logic for subdomains yet, everything is for top level domains.
  // This means we can create a conflict if two subdomain collections have the same name.
  // Normally this would be fine because those two domainIds will be hashed inclusive of
  // of the parentId, but to avoid conflicts in tests we use an additional random value here.
  const randomNumber =   Math.floor(Math.random() * 10000);
  const registeredSaleName = `${sale.name}.${randomNumber}`;

  // Finally, mint and burn the top level collection domain
  await zns.registrar.connect(owner).registerDomain(registeredSaleName, sale.domainContract);

  let domainHash;

  // See line 34 for explanatory comment on why this case is special
  if (domainName === "wilder.WoW") {
    domainHash = ethers.utils.solidityKeccak256(["string"], [registeredSaleName]);

    const wowHash = legacyHashWithParent("WoW", hashSubdomainName("wilder"));
    await legacyRegistrar.connect(owner).adminBurnToken(wowHash);

    // Verify burn
    expect(await legacyRegistrar.domainExists(wowHash)).to.be.false;
  } else {
    domainHash = hashDomainLabel(registeredSaleName);

    const legacyDomainHash = hashSubdomainName(domainName);
    await legacyRegistrar.connect(owner).adminBurnToken(legacyDomainHash);

    // Verify burn
    expect(await legacyRegistrar.domainExists(legacyDomainHash)).to.be.false;
  }

  // Verify mint
  expect(await zns.registry.exists(domainHash)).to.be.true;

};

export const extendDomain = async (
  user : SignerWithAddress,
  controller : SignerWithAddress,
  parent : string,
  sale : Collection,
  legacyRegistrar : LegacyRegistrar,
) => {
  const parentDomain = `${parent}.${sale.name}`;

  if (!sale.subcollections) return;

  for(const collection of sale.subcollections) {
    const subdomainName = `${parentDomain}.${collection.name}`;

    if (collection.subcollections) {
      // Use a different variable to avoid adding to it twice
      for(const subcollection of collection.subcollections) {
        await extendDomain(user, controller, subdomainName, subcollection, legacyRegistrar);
      }
    }
    // Can't extend subdomain collections that are on subcontracts
    if (collection.domainContract === defaultRegistrar && collection.nftContract === defaultRegistrar) {
      console.log(subdomainName);

      const label = "friends";
      let subdomainHash;

      // WoW is a special case because it wasn't used with standard ENS normalization
      // so we have to respect the upper case characters and do custom
      if (sale.name === "WoW") {
        const wowHash = legacyHashWithParent("WoW", hashSubdomainName("wilder"));
        subdomainHash = legacyHashWithParent(collection.name, wowHash);
      } else {
        subdomainHash = hashSubdomainName(subdomainName);
      }

      const passTx = legacyRegistrar.connect(controller).registerDomain(
        subdomainHash,
        label,
        user.address,
        "https://ipfs.io/ipfs/Qmhash",
        0,
        true
      );

      await expect(passTx).to.not.be.reverted;

      // Verify
      let newDomainHash;
      if (sale.name === "WoW") {
        newDomainHash = legacyHashWithParent(label, subdomainHash);
      } else {
        newDomainHash = hashSubdomainName(`${subdomainName}.${label}`);
      }

      expect(await legacyRegistrar.domainExists(newDomainHash)).to.be.true;
    }
  }
};
