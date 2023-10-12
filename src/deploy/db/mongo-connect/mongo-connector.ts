import { TLogger } from "../../campaign/types";
import { Db, MongoClient } from "mongodb";
import { IMongoDBAdapterArgs } from "./types";


export class MongoDBConnector {
  logger : TLogger;
  client : MongoClient;
  dbUri : string;
  dbName : string;
  db ?: Db;

  constructor ({
    logger,
    dbUri,
    dbName,
    clientOpts = {},
  } : IMongoDBAdapterArgs) {
    // TODO dep: add a way to get these from ENV
    this.logger = logger;
    this.client = new MongoClient(dbUri, clientOpts);
    this.dbUri = dbUri;
    this.dbName = dbName;
  }

  async connect () {
    try {
      await this.client.connect();
      this.db = this.client.db(this.dbName);

      this.logger.info({
        message: `MongoDB connected at ${this.dbUri}`,
      });

      return this.db;
    } catch (e) {
      this.logger.error({
        message: `MongoDB connection failed at ${this.dbUri}`,
        error: e,
      });
      throw e;
    }
  }

  async close (forceClose = false) {
    try {
      await this.client.close(forceClose);
      this.logger.info(`MongoDB connection closed at ${this.dbUri}`);
    } catch (e) {
      this.logger.error({
        message: `MongoDB connection failed to close at ${this.dbUri}`,
        error: e,
      });
      throw e;
    }
  }
}
