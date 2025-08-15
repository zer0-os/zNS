import { ethers } from "ethers";
import { getDomains } from "./subgraph";
import { Domain } from "./types";
import * as fs from "fs";
import { getLogger } from "../../deploy/logger/create-logger";

const logger = getLogger();

/**
 * Reqiuired .env vars
 * - SUBGRAPH_URL_DEV - The URL to read from `zns-mainnet-dev` subgraph
 * - DEFAULT_PAYMENT_TOKEN - The symbol of the default payment token used
 */
const main = async () => {
  // Keeping as separate collections from the start will help downstream registration
  const rootDomainObjects = await getDomains(true);
  const subdomainObjects = await getDomains(false);

  // Track totals owed to users for payments from domain registration
  const userAmounts = new Map<string, Map<string, bigint>>();

  // If payment token resolution fails for a domain we hold onto it for debugging
  const errorDomains = [];

  // Doing this creates strong typing and extensibility that allows
  // the below `insertMany` calls to add properties to the object for `_id` properly
  const roots = rootDomainObjects.map(d => d as Domain);
  logger.info(`Found ${roots.length} root domains`);

  const subs = subdomainObjects.map(d => d as Domain);
  logger.info(`Found ${subs.length} subdomains`);

  // Keep tack of tokens as we iterate for later use
  const tokenPairs : Map<string, string> = new Map();

  logger.info("Processing...");
  for (const [i,d] of [...roots, ...subs].entries()) {
    // Both will be null if the domain was free (register by parent owner)
    // In this case user isn't owed any refund, so we skip
    if (!d.amountPaidDirect && !d.amountPaidStake) {
      continue;
    } else if (!d.isRevoked) {
      // Because of how the contracts are structured, it isn't possible
      // to get the contract address of the payment token at registration
      // so we must specify a default here instead
      let paymentToken = process.env.DEFAULT_PAYMENT_TOKEN;

      if (!paymentToken) {
        throw new Error("Error: No default payment token specified.");
      }

      if (!d.isWorld) {
        // Subdomains may use other tokens, so resolve
        if (d.parent && d.parent.treasury && d.parent.treasury.paymentToken) {
          // Override the default name if it is specified
          paymentToken = d.parent.treasury.paymentToken.symbol;

          if (!tokenPairs.has(paymentToken)) {
            tokenPairs.set(paymentToken, d.parent.treasury.paymentToken.id);
          }
        } else {
          errorDomains.push(d);
          continue;
        }
      }

      const amountPaid = !d.amountPaidDirect ? d.amountPaidStake : d.amountPaidDirect;
      const tokenAmounts = userAmounts.get(d.owner.id);

      if (tokenAmounts) {
        // Get the amount of `parentPaymentToken` they have paid
        const amount = tokenAmounts.get(paymentToken);

        // They may be paying with `parentPaymentToken` for the first time, get amount
        const realAmount = !amount ? 0n : amount;

        tokenAmounts.set(paymentToken, realAmount + BigInt(amountPaid));
        userAmounts.set(d.owner.id, tokenAmounts);
      } else {
        const tokenAmount = new Map();
        tokenAmount.set(paymentToken, BigInt(amountPaid));
        userAmounts.set(d.owner.id, tokenAmount);
      }
    }

    // Track our progress
    if (i % 50 === 0) {
      logger.info(i);
    }
  }

  logger.info(`userAmounts.size: ${userAmounts.size}`);
  logger.info(`errorDomains.length: ${errorDomains.length}`);

  // Now transform collected data into csv or needed transaction data per row
  const rows = [];
  const headers = ["token_type","token_address","receiver","amount"];

  for (const userAmount of userAmounts.entries()) {
    const user : string = userAmount[0];
    const amountsMap : Map<string, bigint> = userAmount[1];

    // If the user has more payment tokens than there are specified by the TOKEN_PAIRS .env var,
    // then fail, we cannot calculate their refund and their is likely a mistake somewhere
    if (amountsMap.size > tokenPairs.size) {
      throw new Error("Error: User has used more tokens in payment than found in domain iteration");
    }

    // Row to build up as we read the specific token values
    const row = ["erc20"];

    for(const pair of tokenPairs) {
      // 0 is token symbol
      const amount = amountsMap.get(pair[0]);

      // Amount may be null for one or both
      if (amount) {
        // 1 is token contract address
        row.push(pair[1], user, ethers.formatEther(amount).toString());
      }
    }

    // It's possible that no payment tokens were setup and the domain was free. Reading the data above
    // when this is true would cause an invalid row to get pushed to the array. So we check the length here
    // to only push complete rows to the array instead
    if(row.length === 4) {
      rows.push(row);
    }
  }

  logger.info(`rows.length: ${rows.length}`);


  fs.writeFileSync("03_errorDomains.json", JSON.stringify(errorDomains, null, 2));
  fs.writeFileSync("03_userAmounts.csv", `${headers}\n${rows.join("\n")}`);
};

main().catch(error => {
  logger.error(error.message);
  process.exit(1);
}).finally(() => {
  process.exit(0);
});
