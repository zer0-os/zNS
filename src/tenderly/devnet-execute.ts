/* eslint-disable @typescript-eslint/no-var-requires, no-console */
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);

const spawnCommand = "ts-node src/tenderly/spawn-devnet.ts";
const opCommandBase = "npx hardhat run";
const networkArg = "--network devnet";
const opsPath = "src/tenderly/run-all-flows.ts";

/**
 * Top level function to execute everything on the DevNet.
 * It executes 2 child processes:
 * 1. Spawn a DevNet through the helper and ts-node directly,
 * this will also set all the required env vars, so that Hardhat can correctly
 * work with contracts and auth in Tenderly
 * 2. Launch deploy and operation flow with contracts using Hardhat
 *
 * To execute this, uncomment `tenderly.setup()` line in the hardhat.config.ts
 * then run `yarn devnet` in the terminal.
 * */
const execute = async () => {
  // spawn DevNet on Tenderly with ts-node directly
  const spawnRes = await execAsync(spawnCommand);
  process.stdout.write(spawnRes.stdout);
  process.stderr.write(spawnRes.stderr);

  const opCommand = `${opCommandBase} ${opsPath} ${networkArg}`;

  // deploy all contracts, run flows using Hardhat
  const opRes = await execAsync(opCommand);
  // pass Tenderly logger through
  process.stdout.write(opRes.stdout);
  process.stderr.write(opRes.stderr);

  return spawnRes;
};


execute()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
