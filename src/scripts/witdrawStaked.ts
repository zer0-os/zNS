import { ethers } from "hardhat";
import { IDBVersion } from "../deploy/db/mongo-adapter/types";
import { getMongoAdapter } from "../deploy/db/mongo-adapter/get-adapter";


export const withdrawStakedByGovernon = async ({
  token,
  to,
  version,
} : {
  token : string;
  to ?: string;
  version ?: IDBVersion | string;
}) => {
  const [ governor ] = await ethers.getSigners();

  if (!token) {
    throw new Error("Token address is undefined");
  }

  const dbAdapter = await getMongoAdapter();

  if (!version) {
    const upgradedVersion = await dbAdapter.getUpgradedVersion();
    version = upgradedVersion ?? undefined;
  }

  // Проверяем, что version имеет тип IDBVersion
  if (typeof version === "string") {
    throw new Error("Invalid version type: expected IDBVersion, got string");
  }

  if (!version) {
    throw new Error("Version is undefined");
  }

  const ts = await dbAdapter.getContract("ZNSTreasury", version.dbVersion);
  if (!ts)
    throw new Error("ZNSTreasury contract not found for the specified/upgraded version");
  const treasury = new ethers.Contract(ts.address, ts.abi, governor);

  const toAddress = () => {
    const recipient = to || process.env.SAFE_ADDRESS;

    if (!recipient)
      throw new Error("Recipient address is undefined");

    return recipient;
  };

  const tx = await treasury.withdrawStaked(
    token,
    toAddress()
  );

  if ((await ethers.provider.getNetwork()).name !== "hardhat")
    await tx.wait(
      process.env.CONFIRMATIONS_N ? Number(process.env.CONFIRMATIONS_N) : 2
    );

  return tx;
};