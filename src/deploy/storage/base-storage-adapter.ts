import { IContractDbObject } from "../missions/types";
import { TLogger } from "../campaign/types";


export class BaseStorageAdapter {
  logger : TLogger;

  constructor (logger : TLogger) {
    this.logger = logger;
  }

  async writeContract (contractDbName : string, data : IContractDbObject) {
    throw new Error("This class can NOT be used as storage adapter. It needs to be inherited and implemented.");
  }

  async getContract (contractDbName : string) : Promise<IContractDbObject | null> {
    throw new Error("This class can NOT be used as storage adapter. It needs to be inherited and implemented.");
  }
}
