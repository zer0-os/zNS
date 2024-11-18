import { getSaveBridgeApiResponse } from "./bridge-api";

const args = process.argv.slice(2);

getSaveBridgeApiResponse(args)
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
