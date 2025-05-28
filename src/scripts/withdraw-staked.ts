import * as hre from "hardhat";
import { IDBVersion } from "../deploy/db/mongo-adapter/types";
import { getMongoAdapter } from "../deploy/db/mongo-adapter/get-adapter";
import { znsNames } from "../deploy/missions/contracts/names";
import { ZNSTreasuryPausable__factory } from "../../typechain/factories/contracts/zns-pausable/treasury";
import { ZNSTreasuryPausable } from "../../typechain/contracts/zns-pausable/treasury";


export const withdrawStakedByGovernor = async ({
  token,
  to,
  version,
} : {
  token : string;
  to ?: string;
  version ?: IDBVersion | null;
}) => {
  const [ governor ] = await hre.ethers.getSigners();

  if (!token) {
    throw new Error("Token address is undefined");
  }

  const dbAdapter = await getMongoAdapter();

  if (!version) {
    version = await dbAdapter.getUpgradedVersion();
  }

  if (!version) {
    throw new Error("Version is undefined");
  }

  const contractName = znsNames.treasury.contract;

  const dbContr = await dbAdapter.getContract(
    contractName,
    // version.dbVersion,
  );

  if (!dbContr)
    throw new Error(`${contractName} contract not found for the specified/upgraded version`);

  const treasury = new ZNSTreasuryPausable__factory(governor)
    .attach(dbContr.address) as ZNSTreasuryPausable;

  const recipient = to || process.env.TREASURY_WITHDRAW_RECIPIENT;

  if (!recipient)
    throw new Error("Recipient address is undefined");

  const tx = await treasury.withdrawStaked(
    token,
    recipient,
  );

  if (hre.network.name !== "hardhat")
    await tx.wait(
      process.env.CONFIRMATIONS_N ? Number(process.env.CONFIRMATIONS_N) : 2
    );

  return tx;
};
