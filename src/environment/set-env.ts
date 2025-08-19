/* eslint-disable @typescript-eslint/no-var-requires */
import { environment } from "./env";


export const setDefaultEnvironment = (override : boolean) => {
  Object.entries(environment).forEach(([key, value]) => {
    // load the defaults first
    process.env[key] = value;
  });

  // override from local .env file if anything is present
  require("dotenv").config({ override });
};
