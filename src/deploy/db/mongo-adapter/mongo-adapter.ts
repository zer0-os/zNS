/* eslint-disable @typescript-eslint/no-non-null-assertion */
import fs from "fs";
import { TLogger } from "../../campaign/types";
import { Collection, Db, MongoClient, MongoClientOptions } from "mongodb";
import { IDBVersion, IMongoDBAdapterArgs } from "./types";
import { COLL_NAMES, VERSION_TYPES } from "./constants";
import { IContractDbData } from "../types";
import { tagFilePath } from "../../../utils/git-tag/save-tag";
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
  }

  // call this to actually start the adapter
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

  // Contract methods
  async getContract (contractName : string, version ?: string) {
    if (!version) {
      ({ dbVersion: version } = await this.getCheckLatestVersion());
    }

    return this.contracts.findOne({
      name: contractName,
      version,
    });
  }

  async writeContract (contractName : string, data : IContractDbData, version ?: string) {
    if (!version) {
      ({ dbVersion: version } = await this.getCheckLatestVersion());
    }

    await this.contracts.insertOne({
      ...data,
      version,
    });

    this.logger.debug(`Successfully wrote ${contractName} to DB.`);
  }

  async dropDB () {
    await this.db.dropDatabase();
    this.logger.info("Database dropped successfully.");
  }

  // Versioning methods
  // TODO dep: add logging to all versioning stages and methods !!
  async configureVersioning (version ?: string) {
    // TODO dep: add archiving logic once determined on how to handle it
    const tempV = await this.getTempVersion();
    const deployedV = await this.getDeployedVersion();

    let finalVersion : string;
    if (version) {
      finalVersion = version;

      if (version !== deployedV?.dbVersion || !deployedV) {
        // we should only have a single TEMP version at any given time
        if (version !== tempV?.dbVersion && tempV) {
          await this.clearDBForVersion(tempV.dbVersion);
        }

        await this.createUpdateTempVersion(finalVersion);
      }
    } else {
      if (!tempV && !deployedV) {
        finalVersion = Date.now().toString();
        // eslint-disable-next-line max-len
        this.logger.info(`No version provided to MongoDBAdapter, using current timestamp as new TEMP version: ${finalVersion}`);
        await this.createUpdateTempVersion(finalVersion);
      } else if (!deployedV) {
        finalVersion = tempV?.dbVersion as string;
        this.logger.info(`Using existing MongoDB TEMP version: ${finalVersion}`);
      } else {
        finalVersion = deployedV.dbVersion;
        this.logger.info(`Using existing MongoDB DEPLOYED version: ${finalVersion}`);
      }
    }

    return finalVersion;
  }

  async finalizeDeployedVersion (version ?: string) {
    const finalV = version || (await this.getTempVersion())?.dbVersion;

    if (!finalV) return;

    const deployedV = (await this.getDeployedVersion())?.dbVersion;
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
        dbVersion: finalV,
        contractsVersion: this.getContractsVersionFromFile(),
      });

      // now remove the TEMP version
      await this.versions.deleteOne({
        type: VERSION_TYPES.temp,
        version: finalV,
      });
    }

    // archive the current TEMP version if any
    await this.versions.updateOne(
      {
        type: VERSION_TYPES.temp,
      },
      {
        $set: {
          type: VERSION_TYPES.archived,
        },
      });

    this.logger.info(`Successfully finalized DB version ${finalV} from TEMP to DEPLOYED.`);
  }

  async getCheckLatestVersion () {
    const v = await this.getLatestVersion();

    if (!v) throw new Error("No version found in DB!");

    return v;
  }

  async getTempVersion () : Promise<IDBVersion | null> {
    const v = await this.versions.findOne({
      type: VERSION_TYPES.temp,
    });

    if (!v) return null;

    return v;
  }

  async getDeployedVersion () : Promise<IDBVersion | null> {
    const v = await this.versions.findOne({
      type: VERSION_TYPES.deployed,
    });

    if (!v) return null;

    return v;
  }

  async getLatestVersion () : Promise<IDBVersion | null> {
    const v = await this.getTempVersion();

    if (v) return v;

    return this.getDeployedVersion();
  }

  getContractsVersionFromFile () {
    if (!fs.existsSync(tagFilePath)) {
      throw Error(`No git tag found at ${tagFilePath}`);
    }

    const tag = fs.readFileSync(tagFilePath, "utf8").trim();
    this.logger.info(`Git tag found at ${tagFilePath}: ${tag}`);

    return tag;
  }

  async createUpdateTempVersion (version : string) {
    const contractsVersion = this.getContractsVersionFromFile();

    return this.versions.updateOne({
      type: VERSION_TYPES.temp,
    }, {
      $set: {
        dbVersion: version,
        contractsVersion,
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
}
