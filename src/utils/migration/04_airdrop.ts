// Z Airdrop to users on z chain so they can transfer from their self-custody wallet to zwallets
import * as hre from "hardhat";
import { getLogger } from "../../deploy/logger/create-logger";
import { getDomains } from "./subgraph";
import { Domain } from "./types";

const logger = getLogger();

// TODO we need to decide on how we allow users to migrate their domains
// This script may not be used, but we will keep it as a backup in case.
// We may modify it to take advantage of using a Safe and the CSV Airdrop tool too.
const main = async () => {
  const [ admin ] = await hre.ethers.getSigners();

  const roots = await getDomains(true) as Array<Domain>;
  const subs = await getDomains(false) as Array<Domain>;

  const userToGasOwed = new Map<string, bigint>();
  const gasPerDomain = hre.ethers.parseEther("0.002");

  // Track total needed for funding this wallet
  let totalNeeded = 0n;

  // Calculate how much gas each user needs based on the number
  // of domains they have
  for (const d of [...roots, ...subs]) {
    const gasTotal = userToGasOwed.get(d.owner.id);

    if (gasTotal && !d.isRevoked) {
      userToGasOwed.set(d.owner.id, gasTotal + BigInt(gasPerDomain));
    } else {
      userToGasOwed.set(d.owner.id, BigInt(gasPerDomain));
    }

    totalNeeded += gasPerDomain;
  }

  // Also add amount of gas needed to actually pay for the transfers
  totalNeeded += 21000n * BigInt(userToGasOwed.size);

  logger.info(`Total needed for funding: ${totalNeeded}`);

  // Transfer native token for `amount` that user needs
  for (const userGas of userToGasOwed) {
    const tx = await admin.sendTransaction({
      to: userGas[0],
      value: userGas[1],
      gasLimit: 21000,
    });

    const receipt = await tx.wait(hre.network.name === "hardhat" ? 0 : 3);

    logger.log(`\nTransfer sent to user ${userGas[0]} for amount ${userGas[1]}`);
    logger.log(`Transaction Hash: ${receipt?.hash}\n`);
  }

};

main().catch(error => {
  logger.error("Migration script failed:", error);
  process.exitCode = 1;
}).finally(() => {
  process.exit(0);
});