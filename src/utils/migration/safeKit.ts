// Gnosis Safe Modules
import SafeApiKit, { PendingTransactionsOptions, ProposeTransactionProps, SafeMultisigTransactionEstimate, SafeMultisigTransactionEstimateResponse } from '@safe-global/api-kit'
import Safe, { SafeTransactionOptionalProps } from '@safe-global/protocol-kit'
import { MetaTransactionData, OperationType, SafeSignature, SafeTransaction } from "@safe-global/types-kit";
import { SAFE_SUPPORTED_NETWORKS } from './constants';
import { SafeKitConfig, SafeTransactionExtendedOptions } from './types';

/**
 * Wrapper around the safeApiKit and protocolKit that Safe provides
 * 
 * Instantiation is done through `init`
 */
export class SafeKit {
  apiKit : SafeApiKit;
  protocolKit : Safe;
  config : SafeKitConfig;

  constructor (
    apiKit : SafeApiKit,
    protocolKit : Safe,
    config : SafeKitConfig,
  ) {
    this.apiKit = apiKit;
    this.protocolKit = protocolKit;
    this.config = config;
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
      txServiceUrl: config.txServiceUrl
    });

    const protocolKit = await Safe.init({
      provider: config.rpcUrl,
      signer: process.env.SAFE_OWNER!, // Must be private key, not address
      safeAddress: config.safeAddress
    });

    return new SafeKit(apiKit, protocolKit, config);
  }

  async isOwner(address: string): Promise<boolean> {
    return this.protocolKit!.isOwner(address);
  }

  async createProposeSignedTxs (
    to: string,
    txData : string[],
    options ?: SafeTransactionExtendedOptions
  ) {
    // Get the current nonce from the Safe to begin indexing
    const currentNonce = await this.protocolKit.getNonce();

    for (const [index, data] of txData.entries()) {
      const proposalData = await this.createSignedTx(
        to,
        data,
        {
          nonce: currentNonce + index,
          execute: false,
          ...options
        }
      );
      
      // Because we always submit with `execute` as false, we know
      // we will get proposal data back
      await this.proposeTx(proposalData!);
    }
  }

  /**
   * Create a signed safe transaction ready for proposal
   * 
   * @param to The address to send the transaction to
   * @param txData The data for the batch transaction
   * @returns ProposeTransactionProps object containing formed data
   */
  async createSignedTx (
    to : string,
    txData : string,
    options ?: SafeTransactionExtendedOptions
  ) : Promise<ProposeTransactionProps | void> {
    const [ safeTx, safeTxHash ] = await this.createTx(to, txData, options);
    const signature = await this.signTx(safeTxHash);

    if (options && options.execute) {
      // Immediately execute the transaction instead of proposing it
      const result = await this.protocolKit.executeTransaction(safeTx);
      console.log("Transaction Hash: ", result.hash);
    } else {
      return {
        safeAddress: this.config.safeAddress,
        safeTransactionData: safeTx.data,
        safeTxHash,
        senderAddress: this.config.safeOwnerAddress,
        senderSignature: signature.data
      } as ProposeTransactionProps
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
  async createTx(
    to : string,
    txData : string,
    options ?: SafeTransactionExtendedOptions,
  ) : Promise<[ SafeTransaction, string ]> {
    const safeTransaction : SafeMultisigTransactionEstimate = {
      to: to,
      value: "0",
      data: txData,
      operation: OperationType.Call
    }

    // Estimate gas for transaction
    // This throws an error if the inner transaction will revert
    const estimateTx = await this.apiKit.estimateSafeTransaction( // TODO reimpl
      this.config.safeAddress,
      safeTransaction
    );

    // Provide gas manually instead of relying on defaults which can sometimes
    // not be enough for complex transactions
    const manualOptions : SafeTransactionOptionalProps = {
      safeTxGas: (BigInt(estimateTx.safeTxGas) * 2n).toString(),
      baseGas: "160000",
      refundReceiver: this.config.safeAddress,
      ...options
    };

    // Get the current nonce for the Safe to create multiple transactions
    const safeTx = await this.protocolKit.createTransaction({
      transactions: [safeTransaction as MetaTransactionData],
      options: manualOptions
    });

    const safeTxHash = await this.protocolKit.getTransactionHash(safeTx);

    return [ safeTx, safeTxHash ] as [ SafeTransaction, string ];
  }

  /**
   * Sign the given transaction
   * @param safeTxHash The transaction hash before signing
   * @returns The signature created after signing
   */
  async signTx(safeTxHash : string) : Promise<SafeSignature> {
    return await this.protocolKit.signHash(safeTxHash);
  }

  async proposeTx(
    txProposeData : ProposeTransactionProps
  ) : Promise<void> {
    await this.apiKit.proposeTransaction(txProposeData);
  }

  // Execute all pending transactions in the Safe queue that have been confirmed
  async executeAll(options ?: PendingTransactionsOptions) : Promise<void> { //TODO type for opts
    const txs = await this.apiKit.getPendingTransactions(
      this.config.safeAddress,
      {
        hasConfirmations: true,
        ...options
      }
    );

    for (let tx of txs.results) {
      const result = await this.protocolKit.executeTransaction(tx);
      console.log("Transaction Hash: ", result.hash);
    }
  }
}
