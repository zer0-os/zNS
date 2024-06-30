import { createNetwork, relay, deployContract, Network } from "@axelar-network/axelar-local-dev";
import { Wallet, Contract, utils, BigNumber } from "ethers5";
import { expect } from "chai";

// eslint-disable-next-line @typescript-eslint/no-var-requires
import SenderReceiver from "../../artifacts/contracts/AXELAR/SenderReceiver.sol/SenderReceiver.json";
// import { ethers } from "ethers";

const iface = new utils.Interface(SenderReceiver.abi);
// const iface = new ethers.Interface(SenderReceiver.abi);


describe("Axelar Basic Tests", () => {
  let ethereum : Network;
  let polygon : Network;

  let userEth : Wallet;
  let userPoly : Wallet;
  let ethAcc1 : Wallet;
  let ethAcc2 : Wallet;

  let ethereumContract : Contract;
  let polygonContract : Contract;

  before(async () => {
    // chain setup
    ethereum = await createNetwork({
      name: "Ethereum",
    });

    polygon = await createNetwork({
      name: "Polygon",
    });

    // Extract user wallets for both networks
    [userEth, ethAcc1, ethAcc2] = ethereum.userWallets;
    [userPoly] = polygon.userWallets;

    // contract setup
    ethereumContract = await deployContract(userEth, SenderReceiver, [
      ethereum.gateway.address,
      ethereum.gasService.address,
    ]);
    polygonContract = await deployContract(userPoly, SenderReceiver, [
      polygon.gateway.address,
      polygon.gasService.address,
    ]);
  });

  after(async () => {
    await relay();
  });

  describe("Simple smokes", () => {
    it("should set correct gateway and gas service addresses on src and dest chains", async () => {
      expect(await ethereumContract.gateway()).to.equal(ethereum.gateway.address);
      expect(await ethereumContract.gasService()).to.equal(ethereum.gasService.address);

      expect(await polygonContract.gateway()).to.equal(polygon.gateway.address);
      expect(await polygonContract.gasService()).to.equal(polygon.gasService.address);
    });

    it.skip("should set string `message` in state from Eth to Poly", async () => {
      const message = "Hello Polygon from Ethereum";

      const tx = await ethereumContract.sendPayload(
        polygon.name,
        polygonContract.address,
        message,
        { value: 2e18.toString() },
      );
      await tx.wait();

      await relay();

      const polyMessage = await polygonContract.message();

      expect(polyMessage).to.equal(message);
    });

    it.skip("should set uint256 status in state from Eth to Poly", async () => {
      const status = 12345;
      await ethereumContract.sendStatus(
        polygon.name,
        polygonContract.address,
        status,
        { value: 1e18.toString() },
      );

      await relay();

      const polyStatus = await polygonContract.status();

      expect(polyStatus.toString()).to.equal(BigNumber.from(status).toString());
    });
  });

  describe("Direct Gateway Calls", () => {
    it("should call #sendPayload() successfully for any simple method", async () => {
      const message = "Hello Ethereum from Polygon";
      const status = 5;
      const setStatusPayload = iface.encodeFunctionData(
        "setStatus",
        [ 5 ]
      );
      const setMessagePayload = iface.encodeFunctionData(
        "setMessage",
        [ message ]
      );

      // internal setStatus() call
      await polygonContract.connect(userPoly).sendPayload(
        ethereum.name,
        ethereumContract.address,
        setStatusPayload,
        { value: 1e18.toString() }
      );

      await polygonContract.connect(userPoly).sendPayload(
        ethereum.name,
        ethereumContract.address,
        setMessagePayload,
        { value: 1e18.toString() }
      );

      await relay();

      const ethMsg = await ethereumContract.message();
      const ethStatus = await ethereumContract.status();

      expect(ethMsg).to.equal(message);
      expect(ethStatus.toString()).to.equal(status.toString());

      // try calling the other way
      const setPolyStatusPayload = iface.encodeFunctionData(
        "setStatus",
        [ 10 ]
      );

      const setPolyMessagePayload = iface.encodeFunctionData(
        "setMessage",
        [ "Hello Polygon from Ethereum" ]
      );

      // internal setStatus() call
      await ethereumContract.connect(userEth).sendPayload(
        polygon.name,
        polygonContract.address,
        setPolyStatusPayload,
        { value: 1e18.toString() }
      );

      await ethereumContract.connect(userEth).sendPayload(
        polygon.name,
        polygonContract.address,
        setPolyMessagePayload,
        { value: 1e18.toString() }
      );

      await relay();

      const polyMsg = await polygonContract.message();
      const polyStatus = await polygonContract.status();

      expect(polyMsg).to.equal("Hello Polygon from Ethereum");
      expect(polyStatus.toString()).to.equal("10");
    });

    it("should set a mapping entry as a struct through #sendPayload()", async () => {
      // polygon to ethereum
      const key = "coolKey";
      const text = "A very cool text!";
      const bytes = utils.defaultAbiCoder.encode(["string"], [text]);

      const structVal = {
        addresses: [
          ethAcc1.address,
          ethAcc2.address,
          userEth.address,
        ],
        num: 17981,
        text,
        hash: utils.keccak256(bytes),
        data: bytes,
      };

      const setMappingPayload = iface.encodeFunctionData(
        "setDataMapping",
        [ key, structVal ]
      );

      await polygonContract.connect(userPoly).sendPayload(
        ethereum.name,
        ethereumContract.address,
        setMappingPayload,
        { value: 1e18.toString() }
      );

      await relay();

      const mappingVal = await ethereumContract.dataMapping(key);
      const mappingAddresses = await ethereumContract.getMappingAddresses(key);

      expect(mappingAddresses[0]).to.equal(structVal.addresses[0]);
      expect(mappingAddresses[1]).to.equal(structVal.addresses[1]);
      expect(mappingAddresses[2]).to.equal(structVal.addresses[2]);
      expect(mappingVal.num.toString()).to.equal(structVal.num.toString());
      expect(mappingVal.text).to.equal(structVal.text);
      expect(mappingVal.hash).to.equal(structVal.hash);
      expect(mappingVal.data).to.equal(structVal.data);
    });

    it("should pay gas via axelar gas service", async () => {
      const status = 117425;
      const payload = iface.encodeFunctionData(
        "setStatus",
        [ status ]
      );

      const hashedPayload = utils.keccak256(payload);

      await ethereumContract.sendPayload(
        polygon.name,
        polygonContract.address,
        payload,
        { value: 1e18.toString() },
      );

      const filter = ethereum.gasService.filters.NativeGasPaidForContractCall();
      const events = await ethereum.gasService.queryFilter(filter);
      const event = events[events.length - 1];

      expect(event.args.sourceAddress).to.equal(ethereumContract.address);
      expect(event.args.destinationChain).to.equal(polygon.name);
      expect(event.args.destinationAddress).to.equal(polygonContract.address);
      expect(event.args.payloadHash).to.equal(hashedPayload);
      expect(event.args.gasFeeAmount.toString()).to.equal(1e18.toString());
      expect(event.args.refundAddress).to.equal(userEth.address);
    });
  });
});
