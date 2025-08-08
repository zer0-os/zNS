import * as hre from "hardhat";
import { IDBVersion } from "../deploy/db/mongo-adapter/types";
import { getMongoAdapter } from "../deploy/db/mongo-adapter/get-adapter";
import { znsNames } from "../deploy/missions/contracts/names";
import { ZNSTreasuryPausable__factory } from "../../typechain/factories/contracts/zns-pausable/treasury";
import { ZNSTreasuryPausable } from "../../typechain/contracts/zns-pausable/treasury";


export const withdrawStakedByGovernor = async ({
  token,
  to,
} : {
  token : string;
  to ?: string;
}) => {
  const [ governor ] = await hre.ethers.getSigners();

  if (!token) {
    throw new Error("Token address is undefined");
  }

  const dbAdapter = await getMongoAdapter();

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

  await tx.wait(
    process.env.CONFIRMATIONS_N ? Number(process.env.CONFIRMATIONS_N) : 2
  );

  return tx;
};

// call the above function with await properly below
void (async () => {
  try {
    const token = process.env.WITHDRAW_TOKEN_ADDRESS;
    const to = process.env.TREASURY_WITHDRAW_RECIPIENT;

    if (!token || !to) {
      throw new Error("TOKEN_ADDRESS environment variable is not set");
    }

    const tx = await withdrawStakedByGovernor({
      token,
      to,
    });

    console.log(`Withdrawal transaction successful: ${tx.hash}`);
    process.exit(0);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
  } catch (error : Error) {
    console.error(
      `Error withdrawing staked tokens: ${error.message}
      ${error.stack}`
    );
    process.exit(1);
  }
})();
