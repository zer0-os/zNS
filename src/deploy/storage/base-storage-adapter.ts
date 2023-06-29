import { IContractDbObject } from "../missions/types";
import { Logger } from "../campaign/types";


export class BaseStorageAdapter {
  logger : Logger;

  constructor (logger : Logger) {
    this.logger = logger;
  }

  async writeContract (contractDbName : string, data : IContractDbObject) {
    throw new Error("This class can NOT be used as storage adapter. It needs to be inherited and implemented.");
  }

  async getContract (contractDbName : string) : Promise<IContractDbObject | null> {
    throw new Error("This class can NOT be used as storage adapter. It needs to be inherited and implemented.");
  }
}
