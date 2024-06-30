import { createNetwork, deployContract, Network, relay, RelayerType, RelayerMap, evmRelayer } from "@axelar-network/axelar-local-dev";
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
import testContractJson from "../../artifacts/contracts/AXELAR/SimpleTest.sol/SimpleTest.json";
// import { ethers } from "hardhat";


const testContractInterface = new utils.Interface(testContractJson.abi);
const registrarIFace = new utils.Interface(ZNSRootRegistrar.abi);


// import * as hre from "hardhat";

import {
  MeowTokenMock__factory,
  MeowTokenMock as MeowTokenMockType,
  ZNSAccessController__factory,
  ZNSAccessController as ZNSAccessControllerType, 
  ZNSAddressResolver__factory,
  ZNSAddressResolver as ZNSAddressResolverType,
  ZNSCurvePricer__factory, 
  ZNSCurvePricer as ZNSCurvePricerType,
  ZNSDomainToken__factory, 
  ZNSDomainToken as ZNSDomainTokenType,
  ZNSFixedPricer__factory,
  ZNSFixedPricer as ZNSFixedPricerType,
  ZNSPortal__factory,
  ZNSPortal as ZNSPortalType,
  ZNSRegistry__factory,
  ZNSRegistry as ZNSRegistryType,
  ZNSRootRegistrar__factory,
  ZNSRootRegistrar as ZNSRootRegistrarType,
  ZNSSubRegistrar__factory,
  ZNSSubRegistrar as ZNSSubRegistrarType,
  ZNSTreasury__factory,
  ZNSTreasury as ZNSTreasuryType,
  SimpleTest,
  SimpleTest__factory
} from "../../typechain";
import { exit, hrtime } from "process";
import { ZeroAddress } from "ethers";

// const registrarIface = new utils.Interface(ZNSRootRegistrar.abi);

const deployZNSCrossChain = async ({
  network,
  deployer,
} : {
  network : Network;
  deployer : Wallet;
}): Promise<IZNSContractsLocal> => {
  const accessController = await deployContract(
    deployer,
    ZNSAccessController,
    [
      [ deployer.address ],
      [ deployer.address ],
    ],
  {
    
  });

  const accessControllerTyped  = new ZNSAccessController__factory().attach(accessController.address) as ZNSAccessControllerType;

  const registry = await deployContract(
    deployer,
    ZNSRegistry,
    [accessController.address]
  );

  const registryTyped = new ZNSRegistry__factory().attach(registry.address) as ZNSRegistryType;
  // console.log("ONE");

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

  const domainTokenTyped = new ZNSDomainToken__factory().attach(domainToken.address) as ZNSDomainTokenType;
  // console.log("TWO");

  const meowToken = await deployContract(
    deployer,
    MeowTokenMock,
    [meowTokenName, meowTokenSymbol]
  );

  const meowTokenTyped = new MeowTokenMock__factory().attach(meowToken.address) as MeowTokenMockType;

  await network.deployToken(
    meowTokenName,
    meowTokenSymbol,
    18,
    0n,
    await meowTokenTyped.getAddress()
  );

  // console.log("THREE");

  const addressResolver = await deployContract(
    deployer,
    ZNSAddressResolver,
    [accessController.address, registry.address]
  );

  const addressResolverTyped = new ZNSAddressResolver__factory().attach(addressResolver.address) as ZNSAddressResolverType;
  // console.log("FOUR");

  // Be sure that we add the address resolver to the registry
  await registryTyped.connect(deployer).addResolverType("address", await addressResolverTyped.getAddress());

  const curvePricer = await deployContract(
    deployer,
    ZNSCurvePricer,
    [accessController.address, registry.address, DEFAULT_PRICE_CONFIG]
  );

  const curvePricerTyped = new ZNSCurvePricer__factory().attach(curvePricer.address) as ZNSCurvePricerType;

  // console.log("FIVE");

  const treasury = await deployContract(
    deployer,
    ZNSTreasury,
    [accessController.address, registry.address, meowToken.address, deployer.address]
  );

  const treasuryTyped = new ZNSTreasury__factory().attach(treasury.address) as ZNSTreasuryType;

  // console.log("SIX");

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

  const role = await accessControllerTyped.connect(deployer).REGISTRAR_ROLE();
  await accessControllerTyped.connect(deployer).grantRole(role, rootRegistrar.address);

  const rootRegistrarTyped = new ZNSRootRegistrar__factory().attach(rootRegistrar.address) as ZNSRootRegistrarType;

  // console.log("SEVEN");

  const fixedPricer = await deployContract(
    deployer,
    ZNSFixedPricer,
    [accessController.address, registry.address]
  );

  const fixedPricerTyped = new ZNSFixedPricer__factory().attach(fixedPricer.address) as ZNSFixedPricerType;

  // console.log("EIGHT");

  const subRegistrar = await deployContract(
    deployer,
    ZNSSubRegistrar,
    [accessController.address, registry.address, rootRegistrar.address]
  );

  const subRegistrarTyped = new ZNSSubRegistrar__factory().attach(subRegistrar.address) as ZNSSubRegistrarType;

  // console.log("NINE");

  return {
    accessController: accessControllerTyped,
    registry: registryTyped,
    domainToken: domainTokenTyped,
    meowToken: meowTokenTyped,
    addressResolver: addressResolverTyped,
    curvePricer: curvePricerTyped,
    treasury: treasuryTyped,
    rootRegistrar: rootRegistrarTyped,
    fixedPricer: fixedPricerTyped,
    subRegistrar: subRegistrarTyped,
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
  let znsPortalTyped : ZNSPortalType;

  let test : Contract;
  let testTyped : SimpleTest;

  let meowTokenEth : Contract;
  let meowTokenPoly : Contract; // type these?

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

    // deploy ZNSPortal to Ethereum
    znsPortal = await deployContract(
      deployerEth,
      ZNSPortal,
      [
        ethereum.gateway.address,
        ethereum.gasService.address,
      ],
    );

    znsPortalTyped = new ZNSPortal__factory().attach(znsPortal.address) as ZNSPortalType;

    znsPoly = await deployZNSCrossChain({
      network: polygon,
      deployer: deployerPoly,
    });

    test = await deployContract(
      deployerPoly,
      testContractJson,
      [5, polygon.gateway.address],
    );

    testTyped = new SimpleTest__factory().attach(test.address) as SimpleTest;

    meowTokenEth = await deployContract(
      deployerEth,
      MeowTokenMock,
      [meowTokenName, meowTokenSymbol]
    );

    await ethereum.deployToken( // TODO who would be the owner of these tokens?
      meowTokenName,
      meowTokenSymbol,
      18,
      0n,
      meowTokenEth.address
    );

    meowTokenPoly = await deployContract(
      deployerPoly,
      MeowTokenMock,
      [meowTokenName, meowTokenSymbol]
    );

    await polygon.deployToken(
      meowTokenName,
      meowTokenSymbol,
      18,
      0n,
      meowTokenPoly.address
    );

    meowTokenEth = await ethereum.getTokenContract(meowTokenSymbol);
    meowTokenPoly = await polygon.getTokenContract(meowTokenSymbol);

    // give user funds
    // await ethereum.giveToken(ethAcc1.address, meowTokenSymbol, utils.parseEther("100").toBigInt());
    // await polygon.giveToken(polyAcc1.address, meowTokenSymbol, utils.parseEther("100").toBigInt());

    try {
      await meowTokenEth.connect(ethAcc1).mint(
        ethAcc1.address,
        utils.parseEther("100").toBigInt(),
        {
          gasLimit: 5000000
        }
        
      );

      await meowTokenPoly.connect(polyAcc1).mint(
        polyAcc1.address,
        utils.parseEther("100").toBigInt(),
        {
          gasLimit: 5000000
        }
      );
    } catch (e) {
      console.log((e as Error).message);
      console.log((e as Error).stack);
      console.log("")
    }
  });

  it("should deploy ZNS contracts on Polygon and set correct gatway and gas service", async () => {
    expect(await znsPoly.rootRegistrar.gateway()).to.equal(polygon.gateway.address);
  });

  it("add???", async () => {

  })

  it.only("test that works", async () => {
    // confirm balances
    const ethBal = await meowTokenEth.connect(ethAcc1).balanceOf(ethAcc1.address);
    const polyBal = await meowTokenPoly.connect(polyAcc1).balanceOf(polyAcc1.address);

    const tokensPoly = polygon.tokens;
    const tokensEth = ethereum.tokens;

    const rootDomain = "axelar";
    const tokenURI = "https://example.com/817c64af";

    const depositAmount = utils.parseEther("50").toBigInt();

    // try making it do a simple transfer instead
    const testPayload = testContractInterface.encodeFunctionData(
      "receiveToken",
      [
        meowTokenPoly.address,
        polyAcc1.address,
        depositAmount
      ]
    );

    await meowTokenEth.connect(ethAcc1).approve(await znsPortalTyped.getAddress(), constants.MaxUint256);

    try {
      await znsPortalTyped.connect(ethAcc1).sendPayloadWithToken(
        polygon.name,
        await testTyped.getAddress(), // maybe this? typed vs not typed
        testPayload,
        meowTokenSymbol, // asks for symbol before amount here, param order?
        depositAmount,
        {
          value: utils.parseEther("1").toBigInt(),
          gasLimit: 5000000n
        }
      )
  
        // add "externalEvmNetworks" array
        // const relayerMap : RelayerMap = {
        //   "evm" : evmRelayer
        // }
        
        // const ls = polygon.tokens;
  
      await relay();
    } catch (e) {
      console.log((e as Error).message);
      console.log((e as Error).stack);
      console.log("")
    }
    

    const contractBal = await meowTokenPoly.connect(polyAcc1).balanceOf(await testTyped.getAddress());
    const ethAccBal = await meowTokenEth.connect(ethAcc1).balanceOf(ethAcc1.address);
    expect(BigInt(contractBal)).eq(depositAmount);
    expect(BigInt(ethAccBal)).eq(depositAmount);
});

  it("should register root domain on Polygon from Ethereum", async () => {

    // confirm balances
    const ethBal = await meowTokenEth.connect(ethAcc1).balanceOf(ethAcc1.address);
    const polyBal = await meowTokenPoly.connect(polyAcc1).balanceOf(polyAcc1.address);

    const tokensPoly = polygon.tokens;
    const tokensEth = ethereum.tokens;

    const depositAmount = utils.parseEther("50").toBigInt();


    const rootDomain = "axelar";
    const tokenURI = "https://example.com/817c64af";

    // create payload to register root domain
    // const registerPayload = registrarIFace.encodeFunctionData(
    //   "registerRootDomain",
    //   [
    //     rootDomain,
    //     ethAcc1.address,
    //     tokenURI,
    //     {
    //       pricerContract: ethers.ZeroAddress,
    //       paymentType: "0",
    //       accessType: "0",
    //     },
    //     paymentConfigEmpty,
    //   ]
    // );

    const registerPayload = registrarIFace.encodeFunctionData(
      "receiveToken",
      [
        meowTokenPoly.address,
        polyAcc1.address,
        depositAmount
      ]
    );

    // maybe have to approve proxy AND implementation?
    await meowTokenEth.connect(ethAcc1).approve(await znsPortalTyped.getAddress(), ethers.MaxUint256);

    await znsPortalTyped.connect(ethAcc1).sendPayloadWithToken(
      polygon.name,
      await znsPoly.rootRegistrar.getAddress(),
      registerPayload,
      meowTokenSymbol, // asks for symbol before amount here, param order?
      utils.parseEther("50").toBigInt(),
      {
        value: 1e18.toString(),
        gasLimit: 5000000
      }
    )

    await relay();

    const contractBal = await meowTokenPoly.connect(polyAcc1).balanceOf(await znsPoly.rootRegistrar.getAddress());
    const ethAccBal = await meowTokenEth.connect(ethAcc1).balanceOf(ethAcc1.address);
    expect(BigInt(contractBal)).eq(depositAmount);
    expect(BigInt(ethAccBal)).eq(depositAmount);


    // figure out how much we need to pay for the domain
    // const [domainPrice, stakeFee] = await znsPoly.curvePricer //todo uncomment
    //   .connect(polyAcc1) // type error but this works
    //   .getPriceAndFee(constants.HashZero, rootDomain, true);


    // should mint here fine?
    // await znsPoly.meowToken.connect(polyAcc1).mint( // todo uncomment
    //   polyAcc1.address,
    //   domainPrice + stakeFee
    // );

    // const polyAccBalance = await znsPoly.meowToken.connect(polyAcc1).balanceOf(polyAcc1.address);

    // who needs approval?
    // just the treasury? or root registrar as well?
    // gateway needs approval?

    
    // await znsPoly.meowToken.connect(polyAcc1).approve(
    //   await znsPoly.treasury.getAddress(),
    //   ethers.MaxUint256,
    // );

    // await znsPoly.meowToken.connect(polyAcc1).approve(
    //   await znsPoly.rootRegistrar.getAddress(),
    //   ethers.MaxUint256,
    // );

    // await znsPoly.meowToken.connect(polyAcc1).approve(
    //   polygon.gateway.address,
    //   ethers.MaxUint256,
    // );

    // eth => poly

    // so we have to approve the eth gateway?
    

    // // Approve the gateway
    // await meowTokenEth.connect(ethAcc1).approve(
    //   ethereum.gateway.address,
    //   ethers.MaxUint256
    // );

    // Approve the portal
    // await meowTokenEth.connect(ethAcc1).approve(
    //   await znsPortalTyped.getAddress(),
    //   ethers.MaxUint256
    // );

    // give eth account a balance
    // await meowTokenEth.connect(ethAcc1).mint(ethAcc1.address, utils.parseEther("1000000000").toBigInt());

    // do we need approvals from poly acc?
    // await znsPoly.meowToken.connect(polyAcc1).approve(
    // await znsPoly.meowToken.connect(polyAcc1).mint(polyAcc1, utils.parseEther("1000000000").toBigInt());

    // await meowTokenEth.connect(ethAcc1).mint(ethAcc1.address, domainPrice + stakeFee);
    // const ethBal = await meowTokenEth.connect(ethAcc1).balanceOf(ethAcc1.address);



    // try {
    //   // await znsPortalTyped.connect(ethAcc1).sendPayloadWithToken(
    //   //   polygon.name,
    //   //   await znsPoly.rootRegistrar.getAddress(),
    //   //   registerPayload,
    //   //   meowTokenSymbol,
    //   //   domainPrice + stakeFee,
    //   //   {
    //   //     value: 1e18.toString(),
    //   //     gasLimit: 500000
    //   //   }
    //   // );

    //   await znsPortalTyped.connect(ethAcc1).sendPayload(
    //       polygon.name,
    //       await testTyped.getAddress(),
    //       testPayload2,
    //       {
    //         value: 1e18.toString(),
    //         gasLimit: 5000000
    //       }
    //     );
  


    //   // use default `evmRelayer` by specifying undefined
    //   // add "externalEvmNetworks" array
    //   const relayerMap : RelayerMap = {
    //     "evm" : evmRelayer
    //   }
      
    //   const ls = polygon.tokens;

    //   // expects "RelayersMap" as first param
    //   await relay(relayerMap, [polygon]);
    // } catch (e) {
    //   console.log((e as Error).message);
    //   console.log((e as Error).stack);
    //   exit(1);
    // }

    // const val = await testTyped.connect(polyAcc1).value();
    // console.log(val);
    // const filter = znsPoly.rootRegistrar.filters.DomainRegistered();
    // const events = await znsPoly.rootRegistrar.queryFilter(filter);

    // missing arg `destination token symbol` deep in library
    // const domainHash = hashDomainLabel(rootDomain);

    // try registering regularly (same chain call)
    // send tokens to RootRegistrar

    // const [signer] = await hre.ethers.getSigners();

    // const polyAccBalance2 = await znsPoly.meowToken.connect(polyAcc1).balanceOf(polyAcc1.address);


    // const targetForTransfer = await znsPoly.rootRegistrar.getAddress();

    // user approves the registrar to transfer
    // we need to approve the treasury?
    // await znsPoly.meowToken.connect(polyAcc1).approve(
    //   targetForTransfer,
    //   ethers.MaxUint256,
    // );

    // console.log(await znsPoly.meowToken.connect(polyAcc1).balanceOf(polyAcc1.address))

    // const gas = await znsPoly.meowToken
    //   .connect(polyAcc1)
    //   .transfer
    //   .estimateGas(targetForTransfer, domainPrice);

    // cannot estimate gas error
    
    // didnt revert
    // console.log(await znsPoly.accessController.connect(polyAcc1).isRegistrar(targetForTransfer));

    // console.log(await znsPoly.accessController.DEFAULT_ADMIN_ROLE)
    // console.log(await znsPoly.accessController.GOVERNOR_ROLE)
    // console.log(await znsPoly.accessController.EXECUTOR_ROLE)
    // console.log(await znsPoly.accessController.REGISTRAR_ROLE)


    // VM Exception while processing transaction: 
    // revert AccessControl: account 0x1408dd29f17ab290545b89e876b5ce382513d06f 
    // is missing role 0xedcc084d3dcd65a1f7f23c65c46722faca6953d28e43150a467cf43e5c309238'
    // try {
    //   // expect(
    //     await znsPoly.rootRegistrar.connect(polyAcc1).registerRootDomain(
    //     rootDomain,
    //     polyAcc1.address,
    //     tokenURI,
    //     {
    //       pricerContract: constants.AddressZero,
    //       paymentType: 0,
    //       accessType: 0,
    //     },
    //     paymentConfigEmpty,
    //     {
    //       gasLimit: 500000
    //     }
    //   )
    // // ).to.emit(znsPoly.rootRegistrar, "DomainRegistered").withArgs(
    //   //   ZeroAddress,
    //   //   domainHash,
    //   //   rootDomain,
    //   //   123, // domainhash as number,
    //   //   0,
    //   //   polyAcc1.address,
    //   //   0,
    //   // )
    // } catch (e) {
    //   const error = e as Error;
    //   // ERC20 insufficient allowance
    //   console.log(await znsPoly.addressResolver.getAddress())
    //   console.log(error.message);
    //   console.log(error.stack);
    // }

    // "from":"0xfECb7aC9d826Bbdf235871FA1d3df1D6B154A30B",
    // "to":"0x666A92418cd154380c912e3fD56fa03Fe80eE342",
    // "data":"0x6352211e220ca3f20879614d18d73591ccb7f659caa8c8b7f731374d26339bab1b82f8cf"

    // const record = await znsPoly.registry.connect(polyAcc1).getDomainRecord(domainHash);
    // const exists = await znsPoly.registry.connect(polyAcc1).exists(domainHash);
    // const domainOwner = await znsPoly.registry.connect(polyAcc1).getDomainOwner(domainHash);

    // const tokenOwner = await znsPoly.domainToken.connect(polyAcc1).ownerOf(domainHash);
    // console.log("record", record);
  });
});
