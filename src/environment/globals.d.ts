import { IZNSEnvironment } from "./types";

declare global {
  namespace NodeJS {
    interface ProcessEnv extends IZNSEnvironment {}
  }
}
