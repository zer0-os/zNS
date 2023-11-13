import winston from "winston";


// TODO dep: refine this function and configurability of this logger
export const createLogger = (logLevel ?: string) => winston.createLogger({
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
});
