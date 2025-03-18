import fs from "fs";
import { tagFilePath } from "./constants";
import { getZnsLogger } from "../../deploy/get-logger";


export const getGitTag = () => {
  const logger = getZnsLogger();

  if (!fs.existsSync(tagFilePath)) {
    throw Error(`No git tag found at ${tagFilePath}`);
  }

  const tag = fs.readFileSync(tagFilePath, "utf8").trim();
  logger.info(`Git tag found at ${tagFilePath}: ${tag}`);

  return tag;
};
