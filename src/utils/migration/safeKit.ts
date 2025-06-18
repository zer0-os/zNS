// Gnosis Safe Modules
import SafeApiKit, { ProposeTransactionProps } from '@safe-global/api-kit'
import Safe from '@safe-global/protocol-kit'
import { MetaTransactionData, OperationType, SafeSignature, SafeTransaction } from "@safe-global/types-kit";
import { ROOT_DOMAIN_BULK_SELECTOR, SAFE_SUPPORTED_NETWORKS } from './constants';
import { IZNSContracts } from '../../deploy/campaign/types';
import { deployZNS, DeployZNSParams, IZNSContractsLocal } from '../../../test/helpers';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { SafeKitConfig } from './types';


/**
 * Wrapper around the API and Protocol kits that Safe provides
 * 
 * Intantiation is done through `init`
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
      signer: process.env.TEST_SAFE_OWNER!, // TODO temp debug
      safeAddress: config.safeAddress
    });

    return new SafeKit(apiKit, protocolKit, config);
  }

  async isOwner(address: string): Promise<boolean> {
    return this.protocolKit!.isOwner(address);
  }

  /**
   * Create a signed safe transaction ready for proposal
   * @param to The address to send the transaction to
   * @param txData The data for the batch transaction
   * @returns ProposeTransactionProps object containing formed data
   */
  async createSignedTx (
    to : string,
    txData : string,
    nonce ?: number
  ) : Promise<ProposeTransactionProps> {
    const [ safeTx, safeTxHash ] = await this.createTx(to, txData, nonce);
    const signature = await this.signTx(safeTxHash);

    return {
      safeAddress: process.env.TEST_SAFE_ADDRESS!,
      safeTransactionData: safeTx.data,
      safeTxHash,
      senderAddress: this.config.safeOwnerAddress,
      senderSignature: signature.data
    } as ProposeTransactionProps
  }

  async createTx(
    to : string,
    txData : string,
    nonce ?: number
  ) : Promise<[ SafeTransaction, string ]> {
    const metaData: MetaTransactionData = {
      to: to,
      value: '0',
      data: txData,
      // operation: OperationType.DelegateCall
    }

    let options = {};
    if (nonce) {
      options = { nonce };
    }


    // Get the current nonce for the Safe to create multiple transactions
    const safeTx = await this.protocolKit.createTransaction({
      transactions: [metaData],
      options
    });

    const safeTxHash = await this.protocolKit.getTransactionHash(safeTx);

    return [ safeTx, safeTxHash ] as [ SafeTransaction, string ];
  }

  async signTx(safeTxHash : string) : Promise<SafeSignature> {
    return await this.protocolKit.signHash(safeTxHash);
  }

  async proposeTx(
    txProposeData : ProposeTransactionProps
  ) : Promise<void> {
    await this.apiKit.proposeTransaction(txProposeData);
  }
}




/**
 * const apiKit = new SafeApiKit({
    chainId: BigInt(process.env.ZCHAIN_ID!),
    txServiceUrl: "https://prod.z-chain.keypersafe.xyz/api"
  });

  const protocolKit = await Safe.init({
    provider: process.env.ZCHAIN_RPC_URL!,
    signer: process.env.TEST_SAFE_OWNER!,
    safeAddress: process.env.TEST_SAFE_ADDRESS!
  });
 */