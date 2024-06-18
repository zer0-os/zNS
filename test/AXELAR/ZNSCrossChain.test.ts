import { createNetwork, deployContract, Network, relay } from "@axelar-network/axelar-local-dev";
import { Contract, Wallet, utils, constants } from "ethers5";
import {
  DEFAULT_PRICE_CONFIG, deployZNS, hashDomainLabel,
  paymentConfigEmpty,
  ZNS_DOMAIN_TOKEN_NAME,
  ZNS_DOMAIN_TOKEN_SYMBOL,
} from "../helpers";
import { meowTokenName, meowTokenSymbol } from "../../src/deploy/missions/contracts";
import { IZNSContractsLocal } from "../helpers/types";
import { expect } from "chai";

import ZNSAccessController from "../../artifacts/contracts/access/ZNSAccessController.sol/ZNSAccessController.json";
import ZNSRegistry from "../../artifacts/contracts/registry/ZNSRegistry.sol/ZNSRegistry.json";
import ZNSDomainToken from "../../artifacts/contracts/token/ZNSDomainToken.sol/ZNSDomainToken.json";
import ZNSAddressResolver from "../../artifacts/contracts/resolver/ZNSAddressResolver.sol/ZNSAddressResolver.json";
import MeowTokenMock from "../../artifacts/contracts/token/mocks/MeowTokenMock.sol/MeowTokenMock.json";
import ZNSCurvePricer from "../../artifacts/contracts/price/ZNSCurvePricer.sol/ZNSCurvePricer.json";
import ZNSFixedPricer from "../../artifacts/contracts/price/ZNSFixedPricer.sol/ZNSFixedPricer.json";
import ZNSTreasury from "../../artifacts/contracts/treasury/ZNSTreasury.sol/ZNSTreasury.json";
import ZNSRootRegistrar from "../../artifacts/contracts/registrar/ZNSRootRegistrar.sol/ZNSRootRegistrar.json";
import ZNSSubRegistrar from "../../artifacts/contracts/registrar/ZNSSubRegistrar.sol/ZNSSubRegistrar.json";
import ZNSPortal from "../../artifacts/contracts/AXELAR/ZNSPortal.sol/ZNSPortal.json";
import { ethers } from "hardhat";

const registrarIface = new utils.Interface(ZNSRootRegistrar.abi);

const deployZNSCrossChain = async ({
  network,
  deployer,
} : {
  network : Network;
  deployer : Wallet;
}) => {
  const accessController = await deployContract(
    deployer,
    ZNSAccessController,
    [
      [ deployer.address ],
      [ deployer.address ],
    ]);

  const registry = await deployContract(
    deployer,
    ZNSRegistry,
    [accessController.address]
  );

  console.log("ONE");

  const domainToken = await deployContract(
    deployer,
    ZNSDomainToken,
    [
      accessController.address,
      ZNS_DOMAIN_TOKEN_NAME,
      ZNS_DOMAIN_TOKEN_SYMBOL,
      deployer.address,
      "0",
    ]
  );

  console.log("TWO");

  const meowToken = await deployContract(
    deployer,
    MeowTokenMock,
    [meowTokenName, meowTokenSymbol]
  );

  console.log("THREE");

  const addressResolver = await deployContract(
    deployer,
    ZNSAddressResolver,
    [accessController.address, registry.address]
  );

  console.log("FOUR");

  const curvePricer = await deployContract(
    deployer,
    ZNSCurvePricer,
    [accessController.address, registry.address, DEFAULT_PRICE_CONFIG]
  );

  console.log("FIVE");

  const treasury = await deployContract(
    deployer,
    ZNSTreasury,
    [accessController.address, registry.address, meowToken.address, deployer.address]
  );

  console.log("SIX");

  const rootRegistrar = await deployContract(
    deployer,
    ZNSRootRegistrar,
    [
      accessController.address,
      registry.address,
      curvePricer.address,
      treasury.address,
      domainToken.address,
      network.gateway.address,
    ]
  );

  console.log("SEVEN");

  const fixedPricer = await deployContract(
    deployer,
    ZNSFixedPricer,
    [accessController.address, registry.address]
  );

  console.log("EIGHT");

  const subRegistrar = await deployContract(
    deployer,
    ZNSSubRegistrar,
    [accessController.address, registry.address, rootRegistrar.address]
  );

  console.log("NINE");

  return {
    accessController,
    registry,
    domainToken,
    meowToken,
    addressResolver,
    curvePricer,
    treasury,
    rootRegistrar,
    fixedPricer,
    subRegistrar,
    zeroVaultAddress: deployer.address,
  };
};


describe("ZNS Cross-Chain Test", () => {
  let ethereum : Network;
  let polygon : Network;

  let deployerEth : Wallet;
  let ethAcc1 : Wallet;
  let deployerPoly : Wallet;
  let polyAcc1 : Wallet;
  let polyAcc2 : Wallet;

  let znsPoly : IZNSContractsLocal;
  let znsPortal : Contract;
  let meowTokenEth : Contract;

  before(async () => {
    // set up 2 chains
    ethereum = await createNetwork({
      name: "Ethereum",
    });

    polygon = await createNetwork({
      name: "Polygon",
    });

    // get accounts
    [deployerEth, ethAcc1] = ethereum.userWallets;
    [deployerPoly, polyAcc1, polyAcc2] = polygon.userWallets;

    // deploy ZNS to Polygon
    znsPoly = await deployZNSCrossChain({
      network: polygon,
      deployer: deployerPoly,
    });

    // znsPoly = await deployZNS({
    //   deployer: deployerPoly,
    //   governorAddresses: [deployerPoly.address],
    //   adminAddresses: [deployerPoly.address],
    // });

    // deploy ZNSPortal to Ethereum
    znsPortal = await deployContract(
      deployerEth,
      ZNSPortal,
      [
        ethereum.gateway.address,
        ethereum.gasService.address,
      ]
    );

    // add MEOW Mock token to the Polygon Gateway
    await polygon.deployToken(
      meowTokenName,
      meowTokenSymbol,
      18,
      0n,
      znsPoly.meowToken.address
    );

    // deploy MEOW Mock token to Ethereum
    // first we need to deploy our own token and send its address further so that gateway marks it as external
    meowTokenEth = await deployContract(
      deployerEth,
      MeowTokenMock,
      [meowTokenName, meowTokenSymbol]
    );

    await ethereum.deployToken(
      meowTokenName,
      meowTokenSymbol,
      18,
      0n,
      meowTokenEth.address
    );

    await ethereum.giveToken(
      ethAcc1.address,
      meowTokenSymbol,
      utils.parseEther("10000000").toBigInt()
    );

    meowTokenEth = await ethereum.getTokenContract(meowTokenSymbol);
  });

  it("should deploy ZNS contracts on Polygon and set correct gatway and gas service", async () => {
    expect(await znsPoly.rootRegistrar.gateway()).to.equal(polygon.gateway.address);
  });

  it.only("should register root domain on Polygon from Ethereum", async () => {
    const rootDomain = "axelar";
    const tokenURI = "https://example.com/817c64af";

    // create payload to register root domain
    const registerPayload = registrarIface.encodeFunctionData(
      "registerRootDomain",
      [
        rootDomain,
        ethAcc1.address,
        tokenURI,
        {
          pricerContract: ethers.ZeroAddress,
          paymentType: "0",
          accessType: "0",
        },
        paymentConfigEmpty,
      ]
    );

    // figure out how much we need to pay for the domain
    const domainPrice = await znsPoly.curvePricer
      .connect(polyAcc1)
      .getPrice(constants.HashZero, rootDomain, true);

    // await znsPortal.connect(deployerEth).sendPayloadWithToken(
    //   polygon.name,
    //   znsPoly.rootRegistrar.address,
    //   registerPayload,
    //   meowTokenSymbol,
    //   domainPrice,
    //   { value: 1e18.toString() }
    // );
    //
    // await relay();

    // const filter = znsPoly.rootRegistrar.filters.DomainRegistered();
    // const events = await znsPoly.rootRegistrar.queryFilter(filter);
    const domainHash = hashDomainLabel(rootDomain);

    // try registering regularly (same chain call)
    // send tokens to RootRegistrar
    await znsPoly.meowToken.mint(
      polyAcc1.address,
      domainPrice
    );
    const gas = await znsPoly.meowToken
      .connect(polyAcc1)
      .transfer
      .estimateGas(znsPoly.rootRegistrar.address, domainPrice);

    await znsPoly.rootRegistrar.connect(polyAcc1).registerRootDomain(
      rootDomain,
      polyAcc1.address,
      tokenURI,
      {
        pricerContract: constants.AddressZero,
        paymentType: 0,
        accessType: 0,
      },
      paymentConfigEmpty
    );

    // "from":"0xfECb7aC9d826Bbdf235871FA1d3df1D6B154A30B",
    // "to":"0x666A92418cd154380c912e3fD56fa03Fe80eE342",
    // "data":"0x6352211e220ca3f20879614d18d73591ccb7f659caa8c8b7f731374d26339bab1b82f8cf"

    const record = await znsPoly.registry.connect(polyAcc1).getDomainRecord(domainHash);
    const exists = await znsPoly.registry.connect(polyAcc1).exists(domainHash);
    const domainOwner = await znsPoly.registry.connect(polyAcc1).getDomainOwner(domainHash);

    const tokenOwner = await znsPoly.domainToken.connect(polyAcc1).ownerOf(domainHash);
    console.log("record", record);
  });
});
