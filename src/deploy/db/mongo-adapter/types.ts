import { TLogger } from "../../campaign/types";


export interface IMongoDBAdapterArgs {
  logger : TLogger;
  dbUri : string;
  dbName : string;
  version ?: string;
  clientOpts ?: Record<string, unknown>;
}

export interface IDBVersion {
  dbVersion : string;
  contractsVersion : string;
  type : string;
}
