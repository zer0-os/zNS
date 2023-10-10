import winston from "winston";


// TODO dep: refine this helper and configurability of this logger
export const createLogger = (logLevel : string) => winston.createLogger({
  level: logLevel,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }
    )],
});
