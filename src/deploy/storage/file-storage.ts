import fs from "fs";
import path from "path";
import { IContractDbObject } from "../missions/types";
import { BaseStorageAdapter } from "./base-storage-adapter";
import { Logger } from "../campaign/types";


// TODO dep: remove temp db folder and possibly add to .gitignore
//  when testing is done
export const fileStoragePath = path.join(process.cwd(), "./db");


export class FileStorageAdapter extends BaseStorageAdapter {
  private writeLocal : boolean;

  constructor (logger : Logger, writeLocal  = true) {
    super(logger);

    this.writeLocal = writeLocal;

    if (!this.writeLocal) return;

    if (!fs.existsSync(fileStoragePath)) {
      this.logger.log("Creating temp db directory.");
      fs.mkdirSync(fileStoragePath);
    } else {
      this.logger.log(`Temp db directory exists and will be used at: ${fileStoragePath}.`);
    }
  }

  async writeContract (contractDbName : string, data : IContractDbObject) {
    if (!this.writeLocal) return;

    const filePath = path.join(fileStoragePath, `/${contractDbName}.json`);
    const fileData = JSON.stringify(data, null,  "\t");

    fs.writeFileSync(filePath, fileData);

    this.logger.log(`Contract data for ${contractDbName} saved to file: ${filePath}.`);
  }

  async getContract (contractDbName : string) : Promise<IContractDbObject | null> {
    const filePath = path.join(fileStoragePath, `/${contractDbName}.json`);

    if (!fs.existsSync(filePath)) {
      this.logger.log(`Contract data for ${contractDbName} not found at: ${filePath}.`);
      return null;
    }

    const fileData = fs.readFileSync(filePath, "utf8");

    return JSON.parse(fileData);
  }
}
