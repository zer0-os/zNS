/* eslint-disable @typescript-eslint/no-var-requires, no-console */
import fs from "fs";
import dotenv from "dotenv";
import util from "util";
import proc from "child_process";

const asyncExec = util.promisify(proc.exec);

dotenv.config();

const {
  TENDERLY_ACCESS_KEY,
  TENDERLY_PROJECT_SLUG,
  TENDERLY_ACCOUNT_ID,
  TENDERLY_DEVNET_TEMPLATE,
} = process.env;

// eslint-disable-next-line max-len
const command = `tenderly devnet spawn-rpc --project ${TENDERLY_PROJECT_SLUG} --template ${TENDERLY_DEVNET_TEMPLATE} --account ${TENDERLY_ACCOUNT_ID}  --access_key ${TENDERLY_ACCESS_KEY}`;


const spawnDevNet = async () => {
  const res = await asyncExec(command);
  const devNetUrl = res.stderr.trim().toString();

  console.log(`DEVNET_RPC_URL=${ devNetUrl }`);

  // if file doesn't exist, create it
  if (!fs.existsSync(".env")) {
    fs.writeFileSync(".env", "");
  }
  const fileContent = fs.readFileSync(".env", "utf8");

  const newFileContent = fileContent.replace(/DEVNET_RPC_URL=.*/g, "");
  fs.writeFileSync(".env", newFileContent);
  fs.appendFileSync(".env", `DEVNET_RPC_URL=${ devNetUrl }`);
};

spawnDevNet()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
