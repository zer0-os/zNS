/* eslint-disable @typescript-eslint/no-var-requires, no-console */
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);
const opName = process.argv[2];

const spawnCommand = "ts-node src/tenderly/helpers/spawn-devnet.ts";
const opCommandBase = "yarn hardhat run";
const networkArg = "--network devnet";
const opsPath = "src/tenderly/ops/";

/**
 * Top level function to execute everything on the DevNet.
 * It executes 2 child proceces:
 * 1. Spawn a DevNet through the helper and ts-node directly,
 * this will also set all the required env vars, so that Hardhat can correctly
 * work with contracts and auth in Tenderly
 * 2. Launch deploy and operation flow with contracts using Hardhat
 * */
const execute = async () => {
  // spawn DevNet on Tenderly
  const spawnRes = await execAsync(spawnCommand);

  // for `opName` to work every file containing a separate operation
  // should be named one word of that operation (register, revoke, etc.),
  // so that same string can be used as a parameter to the CLI script
  const opCommand = `${opCommandBase} ${opsPath}all.ts ${networkArg}`;
  console.log(`OP COMMAND: ${opCommand}`);

  // performing an operation picked by the argument
  const { stdout } = await execAsync(opCommand);
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
