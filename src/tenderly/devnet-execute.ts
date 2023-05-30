/* eslint-disable @typescript-eslint/no-var-requires, no-console */
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);

const spawnCommand = "ts-node src/tenderly/spawn-devnet.ts";
const opCommandBase = "yarn hardhat run";
const networkArg = "--network devnet";
const opsPath = "src/tenderly/run-all-flows.ts";

/**
 * Top level function to execute everything on the DevNet.
 * It executes 2 child proceces:
 * 1. Spawn a DevNet through the helper and ts-node directly,
 * this will also set all the required env vars, so that Hardhat can correctly
 * work with contracts and auth in Tenderly
 * 2. Launch deploy and operation flow with contracts using Hardhat
 * */
const execute = async () => {
  // spawn DevNet on Tenderly woth ts-node directly
  const spawnRes = await execAsync(spawnCommand);

  const opCommand = `${opCommandBase} ${opsPath} ${networkArg}`;

  // deploy all contracts, run flows using Hardhat
  const { stdout } = await execAsync(opCommand);
  // pass Tenderly logger through
  console.log(stdout);

  return spawnRes;
};


execute()
  .then(() => process.exit(0))
  .catch(error => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
