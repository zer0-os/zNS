import { TLogger } from "../../campaign/types";
import { Collection, Db, MongoClient } from "mongodb";
import { IDBVersion, IMongoDBAdapterArgs } from "./types";
import { COLL_NAMES, VERSION_TYPES } from "./constants";
import { IContractDbData } from "../types";


export class MongoDBConnector {
  logger : TLogger;
  client : MongoClient;
  dbUri : string;
  dbName : string;
  db : Db;
  curVersion : string;

  // Collection pointers
  contracts : Collection<IContractDbData>;
  versions : Collection<IDBVersion>;

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
    this.db = {} as Db;
    this.contracts = {} as Collection<IContractDbData>;
    this.versions = {} as Collection<IDBVersion>;
    this.curVersion = "0";
  }

  // TODO dep: possibly refactor into initialize() async constructor
  async initialize (version ?: string) {
    try {
      await this.client.connect();
      this.db = this.client.db(this.dbName);

      this.logger.info({
        message: `MongoDB connected at ${this.dbUri}`,
      });
    } catch (e) {
      this.logger.error({
        message: `MongoDB connection failed at ${this.dbUri}`,
        error: e,
      });
      throw e;
    }

    this.contracts = this.db.collection(COLL_NAMES.contracts);
    this.versions = this.db.collection(COLL_NAMES.versions);

    return this.db;
  }

  async configureVersioning (version : string) {
    // TODO dep: add archiving logic once determined on how to handle it

    const tempV = await this.getTempVersion();
    const deployedV = await this.getDeployedVersion();

    if (!tempV && !deployedV) {
      this.logger.info("No version provided to MongoDBConnector, using current timestamp as version");
      this.curVersion = Date.now().toString();
      await this.createUpdateTempVersion();
    } else if (!deployedV) {
      this.curVersion = tempV as string;
    } else {
      this.curVersion = deployedV;
    }

    return this.curVersion;
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

  async getCheckLatestVersion () {
    const v = await this.getLatestVersion();

    if (!v) throw new Error("No version found in DB!");

    return v;
  }

  async getContract (contractName : string, version ?: string) {
    if (!version) version = await this.getCheckLatestVersion();

    return this.contracts.findOne({
      contractName,
      version,
    });
  }

  async writeContract (contractName : string, data : IContractDbData, version ?: string) {
    if (!version) version = await this.getCheckLatestVersion();

    return this.contracts.insertOne({
      ...data,
      version,
    });
  }

  async getTempVersion () : Promise<string | null> {
    const v = await this.versions.findOne({
      type: VERSION_TYPES.temp,
    });

    if (!v) return null;

    return v.version;
  }

  async getDeployedVersion () : Promise<string | null> {
    const v = await this.versions.findOne({
      type: VERSION_TYPES.deployed,
    });

    if (!v) return null;

    return v.version;
  }

  async getLatestVersion () : Promise<string | null> {
    const v = await this.getTempVersion();

    if (v) return v;

    return this.getDeployedVersion();
  }

  async createUpdateTempVersion () {
    return this.versions.updateOne({
      type: VERSION_TYPES.temp,
    }, {
      $set: {
        version: this.curVersion,
      },
    }, {
      upsert: true,
    });
  }
}
