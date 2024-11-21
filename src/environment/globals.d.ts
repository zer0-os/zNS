import { ZNSEnv } from "./types";

declare global {
  namespace NodeJS {
    interface ProcessEnv extends ZNSEnv {}
  }
}
