import { createNetwork, relay, deployContract, Network } from "@axelar-network/axelar-local-dev";
import { Wallet, Contract, utils, BigNumber } from "ethers5";
import { expect } from "chai";

// eslint-disable-next-line @typescript-eslint/no-var-requires
import SenderReceiver from "../../artifacts/contracts/TEST/SenderReceiver.sol/SenderReceiver.json";


describe("Axelar Tests", () => {
  let ethereum : Network;
  let polygon : Network;

  let userEth : Wallet;
  let userPoly : Wallet;

  let ethereumContract : Contract;
  let polygonContract : Contract;
  describe("Simple smokes", () => {
    before(async () => {
    // chain setup
      ethereum = await createNetwork({
        name: "Ethereum",
      });

      polygon = await createNetwork({
        name: "Polygon",
      });

      // Extract user wallets for both networks
      [userEth] = ethereum.userWallets;
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

    it("should set correct gateway and gas service addresses on src and dest chains", async () => {
      expect(await ethereumContract.gateway()).to.equal(ethereum.gateway.address);
      expect(await ethereumContract.gasService()).to.equal(ethereum.gasService.address);

      expect(await polygonContract.gateway()).to.equal(polygon.gateway.address);
      expect(await polygonContract.gasService()).to.equal(polygon.gasService.address);
    });

    it("should set string `message` in state from Eth to Poly", async () => {
      const message = "Hello Polygon from Ethereum";
      await ethereumContract.sendMessage(
        polygon.name,
        polygonContract.address,
        message,
        { value: 1e18.toString() },
      );

      await relay();

      const polyMessage = await polygonContract.message();

      expect(polyMessage).to.equal(message);
    });

    it("should set uint256 status in state from Eth to Poly", async () => {
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

    it("should pay gas via axelar gas service", async () => {
      const message = "Hello Polygon from Ethereum";
      const payload = utils.defaultAbiCoder.encode(
        ["uint256", "string"],
        [1, message]
      );
      const hashedPayload = utils.keccak256(payload);
      await ethereumContract.sendMessage(
        polygon.name,
        polygonContract.address,
        message,
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

  describe("Direct Gateway Calls", () => {
    before(async () => {
      ethereum = await createNetwork({
        name: "Ethereum",
      });

      polygon = await createNetwork({
        name: "Polygon",
      });

      // Extract user wallets for both networks
      [userEth] = ethereum.userWallets;
      [userPoly] = polygon.userWallets;

      // contract setup
      ethereumContract = await deployContract(userEth, SenderReceiver, [
        ethereum.gateway.address,
        ethereum.gasService.address,
      ]);
    });

    after(async () => {
      await relay();
    });

    it.only("should call #sendMessage() directly from Gateway", async () => {
      const message = "Hello Polygon from Ethereum";
      const iface = new utils.Interface(SenderReceiver.abi);
      const payload = iface.encodeFunctionData(
        "setStatus",
        [ 5 ]
      );

      const tx = await polygon.gateway.connect(userPoly).callContract(
        ethereum.name,
        ethereumContract.address,
        payload,
        // { gasLimit: 2e6.toString() }, // TODO: how do we provide gas payment?
      );
      await tx.wait();

      await relay();

      // TODO: how do we debug this?
      const ethMsg = await ethereumContract.message();
      const ethStatus = await ethereumContract.status();

      expect(ethMsg).to.equal(message);
    });
  });
});