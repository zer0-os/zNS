// Gnosis Safe Modules
import SafeApiKit, {
  PendingTransactionsOptions,
  SafeMultisigTransactionEstimate,
  SafeMultisigTransactionEstimateResponse,
} from "@safe-global/api-kit";
import Safe, { SafeTransactionOptionalProps } from "@safe-global/protocol-kit";
import {
  MetaTransactionData,
  OperationType,
  SafeMultisigTransactionResponse,
  SafeSignature,
  SafeTransaction,
  TransactionResult,
} from "@safe-global/types-kit";
import { TLogger } from "@zero-tech/zdc";
import { Db } from "mongodb";
import { connectToDb, LogExecution } from "./helpers";
import { SAFE_SUPPORTED_NETWORKS } from "./constants";
import {
  ProposeTransactionPropsExtended,
  SafeKitConfig,
  SafeRetryOptions,
  SafeTransactionOptionsExtended,
  Tx,
} from "./types";
import { getZnsLogger } from "../../deploy/get-logger";

/**
 * Wrapper class around the Safe API Kit and Protocol Kit for Gnosis Safe operations
 *
 * Provides high-level methods for creating, signing, and executing Safe transactions
 * with built-in retry logic, gas estimation, and database logging.
 *
 * @example
 * const safeKit = await SafeKit.init(config);
 * await safeKit.createProposeSignedTxs(contractAddress, txDataArray);
 */
export class SafeKit {
  apiKit : SafeApiKit;
  protocolKit : Safe;
  config : SafeKitConfig;
  db : Db;
  logger : TLogger = getZnsLogger();

  constructor (
    apiKit : SafeApiKit,
    protocolKit : Safe,
    config : SafeKitConfig,
    db : Db
  ) {
    this.apiKit = apiKit;
    this.protocolKit = protocolKit;
    this.config = config;
    this.db = db;
  }

  // Use init as no `await` allowed in constructor
  static async init (config : SafeKitConfig) : Promise<SafeKit> {
    if (!config.chainId) {
      throw new Error("Chain ID is not set");
    }

    if (!config.txServiceUrl && !SAFE_SUPPORTED_NETWORKS.includes(config.network)) {
      throw new Error("Transaction Service URL is not set");
    }

    if (!config.rpcUrl) {
      throw new Error("RPC URL is not set");
    }

    if (!config.safeOwnerAddress) {
      throw new Error("Safe owner address is not set");
    }

    if (!config.safeAddress) {
      throw new Error("Safe address is not set");
    }

    const apiKit = new SafeApiKit({
      chainId: config.chainId,
      txServiceUrl: config.txServiceUrl,
    });

    const safeOwner = process.env.SAFE_OWNER;

    if (!safeOwner) {
      throw new Error("Error: No Safe Owner address found. Did you forget to set `SAFE_OWNER`?");
    }

    const protocolKit = await Safe.init({
      provider: config.rpcUrl,
      signer: safeOwner, // Must be private key, not address
      safeAddress: config.safeAddress,
    });

    // If not given a client for the database connection already,
    // try to create one ourselves
    let db;
    if (config.db) {
      db = config.db;
    } else {
      db = await connectToDb();
    }

    // If still not connected, error
    if (!db) throw new Error("No database connection could be established");

    return new SafeKit(apiKit, protocolKit, config, db);
  }

  /**
   * Check if the given address is an owner of the Safe
   *
   * @param address The address to check
   * @returns Promise resolving to true if the address is an owner
   */
  async isOwner (address : string) : Promise<boolean> {
    return this.protocolKit.isOwner(address);
  }

  /**
   * Create, sign, and propose multiple transactions to the Safe
   *
   * @param to The address to send the transaction to
   * @param txDataBatches The data for the batch transaction, an array of strings
   * @param options Optional options for the transaction, such as nonce and execute flag
   */
  @LogExecution
  async createProposeSignedTxs (
    to : string,
    txDataBatches : Array<string>,
    options ?: SafeTransactionOptionsExtended
  ) {
    // Get the current nonce from the Safe to begin indexing
    // This value is inclusive of any pending transactions in the queue
    const nonce = await this.apiKit.getNextNonce(this.config.safeAddress);
    // Use the below value for *real* nonce value NOT inclusive of pending transaction list
    // const nonce = await this.protocolKit.getNonce();

    for (const [index, txData] of txDataBatches.entries()) {
      const txNonce = Number(nonce) + index;

      const proposalData = await this.retry(
        this.createSignedTx(to, txData, { nonce: txNonce, execute: false, ...options }),
      );

      // Because we always submit with `execute` as false, we know
      // we will get proposal data back unless something has failed
      if (!proposalData) {
        const message = "Error: Failed to create proposal data for tx";
        const data = { to, txData: txData.slice(0,10), txNonce };
        this.logger.error(message, data);
        await this.db.collection("execution-logs").insertOne({
          message,
          data: {
            index,
            ...data,
          },
        });
        throw Error(`${message}: ${data}`);
      } else {
        const message = "Successfully created proposal data for tx";
        const data = { safeTxHash: proposalData.safeTxHash };

        this.logger.info(message, data);
        await this.db.collection("execution-logs").insertOne({
          message: "Successfully created proposal data for tx",
          data: {
            index,
            ...data,
          },
        });
      }

      await this.retry(
        this.proposeTx(proposalData),
      );
    }
  }

  /**
   * Create a signed safe transaction ready for proposal
   *
   * @param to The address to send the transaction to
   * @param txData The data for the batch transaction
   * @returns ProposeTransactionPropsExtend object containing formed data
   */
  @LogExecution
  async createSignedTx (
    to : string,
    txData : string,
    options ?: SafeTransactionOptionsExtended
  ) : Promise<ProposeTransactionPropsExtended | void> {
    const [ safeTx, safeTxHash ] = await this.createTx(to, txData, options);
    const signature = await this.signTx(safeTxHash);

    if (options && options.execute) {
      // Immediately execute the transaction instead of proposing it
      await this.execute(safeTx, safeTxHash);
    } else {
      return {
        safeAddress: this.config.safeAddress,
        safeTransactionData: safeTx.data,
        safeTx,
        safeTxHash,
        senderAddress: this.config.safeOwnerAddress,
        senderSignature: signature.data,
      } as ProposeTransactionPropsExtended;
    }
  }

  /**
   * Create a transaction with the estimated gas necessary
   *
   * @param to The address to send the transaction to
   * @param txData The data for the batch transaction
   * @param options Optional
   * @returns The SafeTransaction and its hash
   */
  async createTx (
    to : string,
    txData : string,
    options ?: SafeTransactionOptionsExtended,
  ) : Promise<[ SafeTransaction, string ]> {
    const safeTransaction : SafeMultisigTransactionEstimate = {
      to,
      value: "0",
      data: txData,
      operation: OperationType.Call,
    };

    const safeInfo = await this.apiKit.getSafeInfo(this.config.safeAddress);

    const manualOptions : SafeTransactionOptionalProps = {
      baseGas: "160000",
      refundReceiver: this.config.safeAddress,
      nonce: Number(safeInfo.nonce),
      ...options,
    };

    // Estimate gas for transaction
    // This throws an error if the inner transaction will revert
    let estimateTx : SafeMultisigTransactionEstimateResponse;
    try {
      estimateTx = await this.apiKit.estimateSafeTransaction(
        this.config.safeAddress,
        safeTransaction
      );

      // Provide gas manually instead of relying on defaults which can sometimes
      // not be enough for complex transactions
      manualOptions.safeTxGas = (BigInt(estimateTx.safeTxGas) * 2n).toString();
    } catch (e) {
      this.logger.error("Error: Failed to estimate gas for tx", { to, txData: txData.slice(0,10), options });
      throw e;
    }

    const safeTx = await this.protocolKit.createTransaction({
      transactions: [safeTransaction as MetaTransactionData],
      options: manualOptions,
    });

    const safeTxHash = await this.protocolKit.getTransactionHash(safeTx);

    return [ safeTx, safeTxHash ] as [ SafeTransaction, string ];
  }

  /**
   * Create and propose transaction batches with automatic gas estimation
   *
   * @param txData Array of transaction data to batch
   * @param batchSize Number of transactions per batch
   */
  async createProposeBatches (
    txData : Array<Tx>,
    batchSize : number,
  ) {
    let transactions : Array<MetaTransactionData> = [];

    let nonceCount = 0;
    for (const [index, tx] of txData.entries()) {
      this.logger.debug(`Processing transaction batch index: ${index}`);

      try {
        // Estimate individual tx to be sure the batch will pass.
        // If one fails during execution of the batch, they will all fail.
        await this.apiKit.estimateSafeTransaction(
          this.config.safeAddress,
          tx
        );
      } catch (e) {
        // Proceed without adding failing tx to batch
        // this.logger.error("Error: Failed to estimate gas for tx", { index, to: tx.to, txData: tx.data });
        continue;
      }

      transactions.push(tx);

      if ((index + 1) % batchSize === 0 || index + 1 === txData.length) {
        // Nonce value that is NOT inclusive of the pending tx queue
        // Use `this.apiKit.getNextNonce(this.config.safeAddress)` to include
        // the number of pending transactions
        const realNonce = await this.protocolKit.getNonce();
        const safeTx = await this.protocolKit.createTransaction({
          transactions,
          options: {
            nonce: realNonce + nonceCount,
          },
        });

        const safeTxHash = await this.protocolKit.getTransactionHash(safeTx);
        const signature = await this.signTx(safeTxHash);

        const proposalData = {
          safeAddress: this.config.safeAddress,
          safeTransactionData: safeTx.data,
          safeTx,
          safeTxHash,
          senderAddress: this.config.safeOwnerAddress,
          senderSignature: signature.data,
        };

        await this.retry(
          this.proposeTx(proposalData),
        );

        transactions = [];
        nonceCount++;
      }
    }
  }

  /**
   * Sign the given transaction
   * @param safeTxHash The transaction hash before signing
   * @returns The signature created after signing
   */
  async signTx (safeTxHash : string) : Promise<SafeSignature> {
    return this.protocolKit.signHash(safeTxHash);
  }

  /**
   * Propose a signed transaction to the Safe
   *
   * @param txProposeData The proposal data returned from
   */
  @LogExecution
  async proposeTx (
    txProposeData : ProposeTransactionPropsExtended
  ) : Promise<void> {
    const beforeTxs = await this.apiKit.getPendingTransactions(this.config.safeAddress);

    await this.retry(
      this.apiKit.proposeTransaction(txProposeData)
    );

    // Verify the proposal was successful by comparing the length of pending transactions before and after
    const afterTxs = await this.apiKit.getPendingTransactions(this.config.safeAddress);
    if (afterTxs.count === beforeTxs.count + 1) {
      this.logger.info("Successfully proposed transaction", { safeTxHash: txProposeData.safeTxHash });
    } else {
      const message = "Error: failed to propose tx";
      const data = { safeTxHash: txProposeData.safeTxHash };
      this.logger.error(message, data);
      throw Error(`${message}: ${data}`);
    }
  }

  /**
   * Execute all pending transactions in the Safe queue that have been confirmed
   *
   * @param options Optional parameters for filtering pending transactions
   */
  @LogExecution
  async executeAll (options ?: PendingTransactionsOptions) : Promise<void> {
    const txs = await this.apiKit.getPendingTransactions(
      this.config.safeAddress,
      {
        hasConfirmations: true,
        ordering: "nonce",
        ...options,
      }
    );

    for (const tx of txs.results) {
      const result = await this.execute(tx, tx.safeTxHash);
      // Unknown type declared internally but runtime has `wait` func
      await (result.transactionResponse as { wait : () => Promise<void>; }).wait();
      this.logger.info(`Executed transaction: ${result.hash} with nonce ${tx.nonce}`);
      break;
    }
  }

  /**
   * Execute a Safe transaction
   *
   * @param tx The transaction to execute
   * @param txHash The transaction hash
   * @returns Promise resolving to the transaction result
   */
  async execute (
    tx : SafeTransaction | SafeMultisigTransactionResponse,
    txHash : string
  ) : Promise<TransactionResult> {
    this.logger.info(
      "Executing transaction",
      {
        nonce: (tx as SafeMultisigTransactionResponse).nonce,
        txHash,
      }
    );

    // Recreate signature
    await this.protocolKit.signTransaction(tx);

    // Estimate gas again as it may have changed since initial gas estimation
    const estimateTx = await this.apiKit.estimateSafeTransaction(
      this.config.safeAddress,
      tx as SafeMultisigTransactionEstimate
    );

    this.logger.debug((tx as SafeMultisigTransactionResponse).nonce);
    this.logger.debug((tx as SafeMultisigTransactionResponse).safeTxHash);

    // Give new gas estimate as gas limit when executing tx
    const result = await this.protocolKit.executeTransaction(tx, { gasLimit: Number(estimateTx.safeTxGas) * 2 });
    return result;
  }

  /**
   * Retry a function with exponential backoff
   *
   * @param func The promise-returning function to retry
   * @param options Retry configuration options
   * @returns Promise resolving to the function result
   */
  async retry <T> (
    func : Promise<T>,
    options : SafeRetryOptions = { attempts: this.config.retryAttempts, delayMs: this.config.delay, exponential: true }
  ) : Promise<T> {
    const {
      attempts,
      delayMs,
      exponential,
    } = options;

    let lastError : Error | undefined;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        // Execute the function and return the result if successful
        return await func;
      } catch (error) {
        // Store the error to throw later if all attempts fail
        lastError = error as Error;

        // Call the optional onRetry callback
        this.logger.debug(`Retry attempt ${attempt} for ${func} failed: ${error}`);

        // If this was the last attempt, don't delay, just throw
        if (attempt === attempts) {
          break;
        }

        // Calculate delay with exponential backoff if enabled
        const waitTime = exponential ? delayMs * Math.pow(2, attempt - 1) : delayMs;

        // Wait before the next attempt
        await this.delay(waitTime);
      }
    }

    // If we've reached here, all attempts failed
    throw lastError;
  }

  /**
   * Utility method to delay execution for a specified number of milliseconds
   *
   * @param ms Number of milliseconds to delay
   */
  async delay (ms : number) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}
