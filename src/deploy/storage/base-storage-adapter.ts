import { TLogger } from "../campaign/types";
import { IContractDbData, TContractDBDoc } from "../db/types";


export class BaseStorageAdapter {
  logger : TLogger;

  constructor (logger : TLogger) {
    this.logger = logger;
  }

  async writeContract (contractDbName : string, data : IContractDbData) {
    throw new Error("This class can NOT be used as storage adapter. It needs to be inherited and implemented.");
  }

  async getContract (contractDbName : string) : Promise<TContractDBDoc | null> {
    throw new Error("This class can NOT be used as storage adapter. It needs to be inherited and implemented.");
  }
}
