import winston from "winston";
import { TLogger } from "../campaign/types";

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
    // TODO dep: figure out where to transport this in production
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

  return logger;
};
