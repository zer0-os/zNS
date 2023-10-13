// import { MongoDBConnector } from "./mongo-connect/mongo-connector";
// import { Db } from "mongodb";
// import { BaseStorageAdapter } from "../storage/base-storage-adapter";
// import { TLogger } from "../campaign/types";
// import { IContractDbData, TContractDBDoc } from "./types";
//
// TODO dep: figure out if this separate entity is even needed on top of MongoDBConnector
// export class DBAdapter extends BaseStorageAdapter {
//   mongoConnector : MongoDBConnector;
//   db : Db;
//
//   // eslint-disable-next-line @typescript-eslint/no-empty-function
//   constructor (logger : TLogger) {
//     super(logger);
//
//     this.mongoConnector = {} as MongoDBConnector;
//     this.db = {} as Db;
//   }
//
//   // this method is the async constructor
//   static async initialize ({
//     logger,
//     dbUri,
//     dbName,
//     clientOpts = {},
//   }) {
//     const dbAdapter = new DBAdapter();
//
//     dbAdapter.mongoConnector = new MongoDBConnector({
//       logger,
//       dbUri,
//       dbName,
//       clientOpts,
//     });
//
//     dbAdapter.db = await dbAdapter.mongoConnector.connect();
//
//     return dbAdapter;
//   }
//
//   async getContract (contractName : string) : Promise<TContractDBDoc | null> {
//     return this.db.collection("contracts").findOne({
//       contractName,
//     }) as Promise<TContractDBDoc | null>;
//   }
// }
