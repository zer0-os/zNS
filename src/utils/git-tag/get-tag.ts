import fs from "fs";
import { tagFilePath } from "./constants";
import { getLogger } from "../../deploy/logger/create-logger";


const logger = getLogger();

export const getGitTag = () => {
  if (!fs.existsSync(tagFilePath)) {
    throw Error(`No git tag found at ${tagFilePath}`);
  }

  const tag = fs.readFileSync(tagFilePath, "utf8").trim();
  logger.info(`Git tag found at ${tagFilePath}: ${tag}`);

  return tag;
};
