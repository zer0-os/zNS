import fs from "fs";
import path from "path";
import { IContractDbObject } from "../missions/types";
import { BaseStorageAdapter } from "./base-storage-adapter";


export const tempDbPath = path.join(__dirname, "../../../db");


export class FileStorageAdapter extends BaseStorageAdapter {
  constructor (logger : Console) {
    super(logger);

    if (!fs.existsSync(tempDbPath)) {
      this.logger.log("Creating temp db directory.");
      fs.mkdirSync(tempDbPath);
    } else {
      this.logger.log(`Temp db directory exists and will be used at: ${tempDbPath}.`);
    }
  }

  async writeContract (contractDbName : string, data : IContractDbObject) {
    const filePath = path.join(__dirname, `../../../db/${contractDbName}.json`);
    const fileData = JSON.stringify(data, null,  "\t");

    fs.writeFileSync(filePath, fileData);

    this.logger.log(`Contract data for ${contractDbName} saved to file: ${filePath}.`);
  }

  async getContract (contractDbName : string) : Promise<IContractDbObject | null> {
    const filePath = path.join(__dirname, `../../../db/${contractDbName}.json`);

    if (!fs.existsSync(filePath)) {
      this.logger.log(`Contract data for ${contractDbName} not found at: ${filePath}.`);
      return null;
    }

    const fileData = fs.readFileSync(filePath, "utf8");

    return JSON.parse(fileData);
  }
}
