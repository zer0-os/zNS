import fs from "fs";
import path from "path";
import { BaseStorageAdapter } from "./base-storage-adapter";
import { TLogger } from "../campaign/types";
import { IContractDbData } from "../db/types";


// TODO dep: remove temp db folder and possibly add to .gitignore
//  when testing is done
export const fileStoragePath = path.join(process.cwd(), "./db");


export class FileStorageAdapter extends BaseStorageAdapter {
  private writeLocal : boolean;

  constructor (logger : TLogger, writeLocal  = true) {
    super(logger);

    this.writeLocal = writeLocal;

    if (!this.writeLocal) return;

    if (!fs.existsSync(fileStoragePath)) {
      this.logger.info("Creating temp db directory.");
      fs.mkdirSync(fileStoragePath);
    } else {
      this.logger.info(`Temp db directory exists and will be used at: ${fileStoragePath}.`);
    }
  }

  async writeContract (contractDbName : string, data : IContractDbData) {
    if (!this.writeLocal) return;

    const filePath = path.join(fileStoragePath, `/${contractDbName}.json`);
    const fileData = JSON.stringify(data, null,  "\t");

    fs.writeFileSync(filePath, fileData);

    this.logger.info(`Contract data for ${contractDbName} saved to file: ${filePath}.`);
  }

  async getContract (contractDbName : string) : Promise<IContractDbData | null> {
    const filePath = path.join(fileStoragePath, `/${contractDbName}.json`);

    if (!fs.existsSync(filePath)) {
      this.logger.debug(`Contract data for ${contractDbName} not found at: ${filePath}.`);
      return null;
    }

    const fileData = fs.readFileSync(filePath, "utf8");

    return JSON.parse(fileData);
  }
}
