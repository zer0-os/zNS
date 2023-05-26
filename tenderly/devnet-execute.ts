
// script for now:
// node ./tenderly/helpers/spawn-devnet.ts && yarn hardhat run ./tenderly/devnet-test.ts --network devnet

const spawnCommand = "node ./tenderly/helpers/spawn-devnet.ts";
const opCommandBase = "yarn hardhat run";
const networkArg = "--network devnet";
const opsPath = "./tenderly/ops/";

const opName = process.argv[2];
// @ts-ignore
const util = require("util");
// @ts-ignore
const execAsync = util.promisify(require("child_process").exec);


const execute = async () => {
  const spawnRes = await execAsync(spawnCommand);
  console.log(`OPERATION: ${opName}`);
  console.log(`RESULT: ${spawnRes}`);

  const opCommand = `${opCommandBase} ${opsPath}${opName}.ts ${networkArg}`;
  console.log(`OP COMMAND: ${opCommand}`);
  const opRes = await execAsync(opCommand);

  return {
    spawnRes,
    opRes,
  };
};


execute()
  .then(() => process.exit(0))
  .catch(error => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
