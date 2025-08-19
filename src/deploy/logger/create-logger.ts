import winston from "winston";
import { TLogger } from "../campaign/types";

let logger : TLogger | null = null;


export const createLogger = (logLevel ?: string, silent ?: boolean) => winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.json(),
    winston.format.timestamp(),
    winston.format.prettyPrint(),
  ),
  transports: [
    new winston.transports.Console(),
  ],
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

  if (process.env.MAKE_LOG_FILE === "true") {
    logger.add(
      new winston.transports.File({ filename: logFileName }),
    );

    logger.debug(`The ENV_LEVEL is ${process.env.ENV_LEVEL}, logs will be saved in ${ logFileName } file`);
  }

  return logger;
};
