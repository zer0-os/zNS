import { getZnsLogger } from "../../deploy/get-logger";
import { migration } from "./02_registration";


migration().catch(error => {
  const logger = getZnsLogger();
  logger.error("Migration script failed:", error);
  process.exitCode = 1;
}).finally(() => {
  process.exit(0);
});