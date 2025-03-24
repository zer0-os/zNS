import * as hre from "hardhat";
import { IDeployCampaignConfig, TZNSContractState } from "../src/deploy/campaign/types";
import { getConfig } from "../src/deploy/campaign/environments";
import { runZnsCampaign } from "../src/deploy/zns-campaign";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { upgradeZNS, upgradeZNSContract } from "../src/upgrade/upgrade";
import { IContractData } from "../src/upgrade/types";
import { znsNames } from "../src/deploy/missions/contracts/names";
import { expect } from "chai";


describe("ZNS V1 Upgrade and Lock Test", () => {
  let deployer : SignerWithAddress;
  let user : SignerWithAddress;
  let governor : SignerWithAddress;
  let admin : SignerWithAddress;
  let randomUser : SignerWithAddress;

  let zns : TZNSContractState;
  let zeroVault : SignerWithAddress;

  before(async () => {
    [deployer, zeroVault, user, governor, admin, randomUser] = await hre.ethers.getSigners();

    const config : IDeployCampaignConfig = await getConfig({
      deployer,
      zeroVaultAddress: zeroVault.address,
      governors: [deployer.address, governor.address],
      admins: [deployer.address, admin.address],
    });

    const campaign = await runZnsCampaign({
      config,
    });

    zns = campaign.state.contracts;
  });

  it.only("should upgrade all necessary ZNS contracts to pausable versions", async () => {
    const contractData : Array<IContractData> = [
      {
        contractName: znsNames.registry.contract,
        instanceName: znsNames.registry.instance,
        address: zns.registry.target,
      },
      {
        contractName: znsNames.domainToken.contract,
        instanceName: znsNames.domainToken.instance,
        address: zns.domainToken.target,
      },
    ];

    const znsUpgraded = await upgradeZNS({
      governorExt: governor,
      contractData,
    });

    expect(znsUpgraded.registry.target).to.equal(zns.registry.target);
  });
});
