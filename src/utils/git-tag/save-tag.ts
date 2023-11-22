import { exec } from "child_process";
import { promisify } from "util";
import { getLogger } from "../../deploy/logger/create-logger";
import fs from "fs";
import { tagFilePath } from "./constants";


const execAsync = promisify(exec);
const logger = getLogger();


const acquireLatestGitTag = async () => {
  const gitTag = await execAsync("git describe --tags --abbrev=0");
  const tag = gitTag.stdout.trim();

  logger.info(`Latest git tag acquired: ${tag}`);

  const commitHash = await execAsync(`git rev-list -n 1 ${tag}`);
  const commit = commitHash.stdout.trim();

  const full = `${tag}:${commit}`;
  logger.info(`Git commit hash acquired for tag: ${commit}. Full: ${full}`);

  return full;
};

const saveTag = async () => {
  const tag = await acquireLatestGitTag();

  fs.writeFileSync(tagFilePath, tag, "utf8");
  logger.info(`Saved git tag-commit to ${tagFilePath}}`);
};

saveTag()
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  .then(process.exit(0))
  .catch(e => {
    logger.error(e);
    process.exit(1);
  });