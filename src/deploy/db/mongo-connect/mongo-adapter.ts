/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { TLogger } from "../../campaign/types";
import { Collection, Db, MongoClient, MongoClientOptions } from "mongodb";
import { IDBVersion, IMongoDBAdapterArgs } from "./types";
import { COLL_NAMES, VERSION_TYPES } from "./constants";
import { IContractDbData } from "../types";
import { getLogger } from "../../logger/create-logger";
import { logger } from "ethers";
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("dotenv").config();


export class MongoDBAdapter {
  logger : TLogger;
  client : MongoClient;
  dbUri : string;
  dbName : string;
  db : Db;
  curVersion : string;
  clientOpts ?: MongoClientOptions;

  // Collection pointers
  contracts : Collection<IContractDbData>;
  versions : Collection<IDBVersion>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [name : string | symbol] : any;

  constructor ({
    logger,
    dbUri,
    dbName,
    clientOpts,
  } : IMongoDBAdapterArgs) {
    // TODO dep: add a way to get these from ENV
    this.logger = logger;
    this.client = new MongoClient(dbUri, clientOpts);
    this.clientOpts = clientOpts;
    this.dbUri = dbUri;
    this.dbName = dbName;
    this.db = {} as Db;
    this.contracts = {} as Collection<IContractDbData>;
    this.versions = {} as Collection<IDBVersion>;
    this.curVersion = "0";

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    mongoAdapter = this;
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

    // TODO dep: can we use this prop in all the contract getters to not
    //  have to determine them dynamically every time ?? is this reliable enough?
    this.curVersion = await this.configureVersioning(version);

    return this.db;
  }

  // TODO dep: add logging to all versioning stages and methods !!
  async configureVersioning (version ?: string) {
    // TODO dep: add archiving logic once determined on how to handle it
    const tempV = await this.getTempVersion();
    const deployedV = await this.getDeployedVersion();

    let finalVersion : string;
    if (version) {
      finalVersion = version;

      if (version !== deployedV || !deployedV) {
        // we should only have a single TEMP version at any given time
        if (version !== tempV && tempV) {
          await this.clearDBForVersion(tempV);
        }

        await this.createUpdateTempVersion(finalVersion);
      }
    } else {
      if (!tempV && !deployedV) {
        this.logger.info("No version provided to MongoDBConnector, using current timestamp as version");
        finalVersion = Date.now().toString();
        await this.createUpdateTempVersion(finalVersion);
      } else if (!deployedV) {
        finalVersion = tempV as string;
      } else {
        finalVersion = deployedV;
      }
    }

    return finalVersion;
  }

  async finalizeDeployedVersion (version ?: string) {
    const finalV = version || await this.getTempVersion();

    if (!finalV) return;

    const deployedV = await this.getDeployedVersion();
    if (finalV !== deployedV) {
      // archive the current DEPLOYED version
      await this.versions.updateOne(
        {
          type: VERSION_TYPES.deployed,
        },
        {
          $set: {
            type: VERSION_TYPES.archived,
          },
        });

      // create new DEPLOYED version
      await this.versions.insertOne({
        type: VERSION_TYPES.deployed,
        version: finalV,
      });

      // now remove the TEMP version
      await this.versions.deleteOne({
        type: VERSION_TYPES.temp,
        version: finalV,
      });
    }

    // archive the current TEMP version if any
    return this.versions.updateOne(
      {
        type: VERSION_TYPES.temp,
      },
      {
        $set: {
          type: VERSION_TYPES.archived,
        },
      });
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
      name: contractName,
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

  async createUpdateTempVersion (version : string) {
    return this.versions.updateOne({
      type: VERSION_TYPES.temp,
    }, {
      $set: {
        version,
      },
    }, {
      upsert: true,
    });
  }

  async clearDBForVersion (version : string) {
    // TODO dep: add more collections here when added
    await this.contracts.deleteMany({
      version,
    });

    return this.versions.deleteMany({
      version,
    });
  }

  async dropDB () {
    return this.db.dropDatabase();
  }
}

let mongoAdapter : MongoDBAdapter | null = null;

export const getMongoAdapter = async () : Promise<MongoDBAdapter> => {
  const checkParams = {
    dbUri: process.env.MONGO_DB_URI!,
    dbName: process.env.MONGO_DB_NAME!,
  };

  const params = {
    logger: getLogger(),
    clientOpts: !!process.env.MONGO_DB_CLIENT_OPTS
      ? JSON.parse(process.env.MONGO_DB_CLIENT_OPTS)
      : undefined,
    // TODO dep: add better way to set version ENV var is not the best !
    version: process.env.MONGO_DB_VERSION,
  };

  if (!checkParams.dbUri && !checkParams.dbName)
    throw new Error("Not all ENV vars are set to create MongoDBConnector!");

  let createNew = false;
  if (mongoAdapter) {
    Object.values(checkParams).forEach(
      ([ key, value ]) => {
        if (key === "version") key = "curVersion";

        if (JSON.stringify(mongoAdapter?.[key]) !== JSON.stringify(value)) {
          createNew = true;
          return;
        }
      }
    );
  } else {
    createNew = true;
  }

  if (createNew) {
    logger.debug("Creating new MongoDBAdapter instance");
    mongoAdapter = new MongoDBAdapter({
      ...checkParams,
      ...params,
    });
    await mongoAdapter.initialize(params.version);
  }

  logger.debug("Returning existing MongoDBAdapter instance");
  return mongoAdapter as MongoDBAdapter;
};
