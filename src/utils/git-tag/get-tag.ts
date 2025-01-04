import fs from "fs";
import { tagFilePath } from "./constants";
import { getLogger } from "@zero-tech/zdc";


export const getGitTag = () => {
  if (!fs.existsSync(tagFilePath)) {
    throw Error(`No git tag found at ${tagFilePath}`);
  }

  const logger = getLogger();

  const tag = fs.readFileSync(tagFilePath, "utf8").trim();
  logger.info(`Git tag found at ${tagFilePath}: ${tag}`);

  return tag;
};
