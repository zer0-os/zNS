import { getLogger } from "@zero-tech/zdc";


export const getZnsLogger = ({
  logLevel,
  silence,
  makeLogFile,
} : {
  logLevel ?: string;
  silence ?: boolean;
  makeLogFile ?: boolean;
} = {}) => {
  if (!silence && !logLevel && !makeLogFile) {
    logLevel = process.env.LOG_LEVEL;
    silence = process.env.SILENT_LOGGER === "true";
    makeLogFile = process.env.MAKE_LOG_FILE === "true";
  }

  return getLogger({
    logLevel,
    silence,
    makeLogFile,
  });
};
