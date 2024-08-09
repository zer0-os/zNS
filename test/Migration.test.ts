import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { validateDomains } from "../src/utils/migration/subgraph";
import { registerDomainsLocal } from "../src/utils/migration/registration";
import { expect } from "chai";
import { IZNSContractsLocal } from "./helpers/types";
import { deployZNS } from "./helpers";



describe('Migration', () => {
  let migrationAdmin : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;

  let first : number;
  let skip : number;

  let zns : IZNSContractsLocal;

  before(async () => {
    [ migrationAdmin, governor, admin ] = await hre.ethers.getSigners();

    const params = {
      deployer: migrationAdmin,
      governorAddresses: [migrationAdmin.address, governor.address],
      adminAddresses: [migrationAdmin.address, admin.address],
    };

    zns = await deployZNS(params);
  })

  it("Validates and registers a single domain", async () => {
    first = 1;
    skip = 0;

    // Validate that the subgraph matches the real on-chain data
    const { validDomains, invalidDomains } = await validateDomains(migrationAdmin, first, skip);

    expect(invalidDomains.length).to.equal(0);

    // Register on local ZNS
    // We keep this call here so that we can register then validate on the same ZNS instance
    // zns = await deployZNS(params);

    const registeredDomains = await registerDomainsLocal(
      migrationAdmin,
      governor,
      admin,
      validDomains,
      zns
    );

    expect(registeredDomains.length).to.equal(1);
    // expect(registeredDomains[0].domainHash).to.equal(validDomains[0].id);
  });
});