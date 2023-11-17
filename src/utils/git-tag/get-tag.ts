import fs from "fs";
import { logger } from "./save-tag";
import { tagFilePath } from "./tag-file";


export const getGitTag = () => {
  if (!fs.existsSync(tagFilePath)) {
    throw Error(`No git tag found at ${tagFilePath}`);
  }

  const tag = fs.readFileSync(tagFilePath, "utf8").trim();
  logger.info(`Git tag found at ${tagFilePath}: ${tag}`);

  return tag;
};
