import winston from "winston";
import { TLogger } from "../campaign/types";
import { includes } from "hardhat/internal/hardhat-network/provider/filter";

let logger : TLogger | null = null;


export const createLogger = (logLevel ?: string, silent ?: boolean) => winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    // TODO dep: adjust the format to what we need
    winston.format.json(),
    winston.format.timestamp(),
    winston.format.prettyPrint(),
  ),
  transports: [
    new winston.transports.Console(),
  ],
  // TODO dep: make sure we need this to be set!
  exitOnError: false,
  silent,
});

export const getLogger = () : TLogger => {
  if (logger) return logger;

  logger = createLogger(
    process.env.LOG_LEVEL || "debug",
    process.env.SILENT_LOGGER === "true"
  );

  const logFileName = `deploy-${Date.now()}.log`;

  if (process.env.ENV_LEVEL?.includes("prod") || process.env.ENV_LEVEL?.includes("test")) {
    logger.add(
      new winston.transports.File({ filename: logFileName }),
    );

    logger.debug(`The ENV_LEVEL is ${process.env.ENV_LEVEL}, logs will be saved in ${ logFileName } file`);
  }

  return logger;
};
