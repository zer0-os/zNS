// Gnosis Safe Modules
import SafeApiKit, { PendingTransactionsOptions, SafeMultisigTransactionEstimate, SafeMultisigTransactionEstimateResponse, SafeMultisigTransactionListResponse } from "@safe-global/api-kit";
import Safe, { SafeTransactionOptionalProps } from "@safe-global/protocol-kit";
import { MetaTransactionData, OperationType, SafeMultisigTransactionResponse, SafeSignature, SafeTransaction, TransactionResult } from "@safe-global/types-kit";
import { SAFE_SUPPORTED_NETWORKS } from "./constants";
import { ProposeTransactionPropsExtended, SafeKitConfig, SafeRetryOptions, SafeTransactionOptionsExtended } from "./types";
import { Db } from "mongodb";
import { connectToDb } from "./helpers";

import { LogExecution } from "./helpers";
import { TLogger } from "@zero-tech/zdc";
import { getZnsLogger } from "../../deploy/get-logger";

/**
 * Wrapper around the safeApiKit and protocolKit that Safe provides
 *
 * Instantiation is done through `init`
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

    const protocolKit = await Safe.init({
      provider: config.rpcUrl,
      signer: process.env.SAFE_OWNER!, // Must be private key, not address
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
    if (!db) throw Error("No DB connection provided");

    return new SafeKit(apiKit, protocolKit, config, db);
  }

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

    for (const [index, txData] of txDataBatches.entries()) {
      const txNonce = Number(nonce) + index;

      const proposalData = await this.retry(
        this.createSignedTx(to, txData, { nonce: txNonce, execute: false, ...options }),
      );

      // Because we always submit with `execute` as false, we know
      // we will get proposal data back unless something has failed
      if (!proposalData) {
        this.logger.error("Error: Failed to create proposal data for tx", { to, txData: txData.slice(0,10), txNonce });
        throw Error();
      } else {
        this.logger.info("Successfully created proposal data for tx", { safeTxHash: proposalData.safeTxHash });
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

    const manualOptions : SafeTransactionOptionalProps = {
      baseGas: "160000",
      refundReceiver: this.config.safeAddress,
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
      manualOptions.safeTxGas = (BigInt(estimateTx.safeTxGas) * 4n).toString();
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
   * Sign the given transaction
   * @param safeTxHash The transaction hash before signing
   * @returns The signature created after signing
   */
  async signTx (safeTxHash : string) : Promise<SafeSignature> {
    return await this.protocolKit.signHash(safeTxHash);
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
    // await this.apiKit.proposeTransaction(txProposeData);

    // Verify the proposal was successful by comparing the length of pending transactions before and after
    const afterTxs = await this.apiKit.getPendingTransactions(this.config.safeAddress);
    if (afterTxs.count === beforeTxs.count + 1) {
      this.logger.info("Successfully proposed transaction", { safeTxHash: txProposeData.safeTxHash });
    } else {
      this.logger.error("Error: failed to propose tx", { safeTxHash: txProposeData.safeTxHash });
      throw Error();
    }
  }

  // Execute all pending transactions in the Safe queue that have been confirmed
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

    this.logger.info("Pending transactions", { count: txs.count });
    for (const tx of txs.results) {
      await this.execute(tx, tx.safeTxHash);
      await this.delay(this.config.delay * 10);
    }
  }

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

  async delay (ms : number)  {
    new Promise(resolve => setTimeout(resolve, ms));
  }
}
