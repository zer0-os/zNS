import { getDefenderRelayer } from "./relayer";
import { ethers } from "hardhat";
import { znsNames } from "../../deploy/missions/contracts/names";
import { ZNSRegistry, ZNSTreasury } from "../../../typechain";
import assert from "assert";


const envMap = {
  mainnet: {
    treasury: null,
    registry: null,
    zeroVault: null,
    newOwner: null,
  },
  sepolia: {
    treasury: null,
    registry: null,
    zeroVault: null,
    newOwner: null,
  },
};

const changeOwnerAndZeroVault = async () => {
  const network = process.env.NETWORK;
  console.log("Network: ", network);

  if (!network || (network !== "mainnet" && network !== "sepolia")) {
    throw new Error(`Invalid network: ${network}`);
  }

  const {
    treasury: treasuryAddress,
    registry: registryAddress,
    zeroVault,
    newOwner,
  } = envMap[network];

  const { signer, provider } = getDefenderRelayer();

  if (!treasuryAddress || !registryAddress || !zeroVault || !newOwner) {
    throw new Error("One of the important values is not set!");
  }

  const treasuryFactory = await ethers.getContractFactory(
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    znsNames.treasury.contract,
    signer
  );
  const treasury = treasuryFactory.attach(treasuryAddress) as ZNSTreasury;

  // make calls
  // 1. change zeroVault (Treasury.paymentConfig[0x0].beneficiary)
  const setBenTx = await treasury.setBeneficiary(ethers.ZeroHash, zeroVault);
  const setBenReceipt = await provider.waitForTransaction(setBenTx.hash, 2);

  // check success
  const {
    beneficiary: beneficiaryFromContract,
  } = await treasury.paymentConfigs(ethers.ZeroHash);
  assert.equal(
    beneficiaryFromContract,
    zeroVault,
    `ZeroVault not set correctly. Expected: ${zeroVault}, got: ${beneficiaryFromContract}`
  );
  console.log("ZeroVault set correctly. Tx hash: ", setBenReceipt.transactionHash);

  // 2. change owner of 0x0 hash in Registry
  const registryFactory = await ethers.getContractFactory(
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    znsNames.registry.contract,
    signer
  );
  const registry = registryFactory.attach(registryAddress) as ZNSRegistry;

  console.log("Changing owner of 0x0 hash in Registry...");
  const setOwnerTx = await registry.updateDomainOwner(ethers.ZeroHash, newOwner);
  const setOwnerReceipt = await provider.waitForTransaction(setOwnerTx.hash, 2);

  console.log("Confirmation acquired. Checking if owner is set correctly...");
  // check success
  const ownerFromContract = await registry.getDomainOwner(ethers.ZeroHash);
  assert.equal(
    ownerFromContract,
    newOwner,
    `Owner not set correctly. Expected: ${newOwner}, got: ${ownerFromContract}`
  );

  console.log("Owner set correctly. Tx hash: ", setOwnerReceipt.transactionHash);

  console.log("Success !!!");
};


changeOwnerAndZeroVault()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
