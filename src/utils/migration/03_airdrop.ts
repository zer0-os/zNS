import { ethers } from "ethers";
import { getDomains } from "./subgraph";
import { Domain } from "./types";
import * as fs from "fs";
import { getLogger } from "../../deploy/logger/create-logger";

const logger = getLogger();

/**
 * Required .env vars
 * - SUBGRAPH_URL_DEV - The URL to read from `zns-mainnet-dev` subgraph
 * - DEFAULT_PAYMENT_TOKEN - The symbol of the default payment token used
 */
const main = async () => {
  // Keeping as separate collections from the start will help downstream registration
  const roots = await getDomains(true) as Array<Domain>;
  const subs = await getDomains(false) as Array<Domain>;

  // Track totals owed to users for payments from domain registration
  const userAmounts = new Map<string, Map<string, bigint>>();

  // Track the total amount to be sent for double checking the contract balance later
  const totals = new Map<string, bigint>();

  // If payment token resolution fails for a domain we hold onto it for debugging
  const errorDomains = [];

  // Keep track of tokens as we iterate for later use
  const tokensMap : Map<string, string> = new Map();

  logger.info("Processing...");
  for (const [i,d] of [...roots, ...subs].entries()) {
    // Will be null if the domain was free (registered by parent owner)
    // In this case user isn't owed any refund, so we skip
    if (d.amountPaidStake && !d.isRevoked) {
      // Because of how the contracts are structured, it isn't possible
      // to get the contract address of the payment token at registration
      // so we must specify a default here instead
      let paymentToken = process.env.DEFAULT_PAYMENT_TOKEN;

      if (!paymentToken) {
        throw new Error("Error: No default payment token specified.");
      }

      if (!d.isWorld) {
        // Subdomains may use other tokens, resolve here
        if (d.parent && d.parent.treasury && d.parent.treasury.paymentToken) {
          // Override the default name if it is specified
          paymentToken = d.parent.treasury.paymentToken.symbol;

          if (!tokensMap.has(paymentToken)) {
            tokensMap.set(paymentToken, d.parent.treasury.paymentToken.id);
          }
        } else {
          errorDomains.push(d);
          continue;
        }
      }

      const tokenAmounts = userAmounts.get(d.owner.id);

      if (tokenAmounts) {
        // Get the amount of `parentPaymentToken` they have paid
        const amount = tokenAmounts.get(paymentToken);
        const total = totals.get(paymentToken);

        // They may be paying with `parentPaymentToken` for the first time, get amount
        const realAmount = !amount ? 0n : amount;
        const realTotal = !total ? 0n : total;

        totals.set(paymentToken, realTotal + realAmount);

        tokenAmounts.set(paymentToken, realAmount + BigInt(d.amountPaidStake));
        userAmounts.set(d.owner.id, tokenAmounts);
      } else {
        const tokenAmount = new Map<string, bigint>();

        totals.set(paymentToken, BigInt(d.amountPaidStake));

        tokenAmount.set(paymentToken, BigInt(d.amountPaidStake));
        userAmounts.set(d.owner.id, tokenAmount);
      }
    }

    // Track our progress
    if (i % 50 === 0) {
      logger.info(i);
    }
  }

  for (const token of totals.entries()) {
    logger.info(`Total for token ${token[0]}: ${token[1]}`);
  }

  logger.info(`userAmounts.size: ${userAmounts.size}`);
  logger.info(`errorDomains.length: ${errorDomains.length}`);

  // Now transform collected data into csv or needed transaction data per row
  const rows = [];
  const headers = ["token_type","token_address","receiver","amount"];

  for (const userAmount of userAmounts.entries()) {
    const user : string = userAmount[0];
    const amountsMap : Map<string, bigint> = userAmount[1];

    // Row to build up as we read the specific token values
    const row = ["erc20"];

    for(const token of tokensMap) {
      // 0 is token symbol
      const amount = amountsMap.get(token[0]);

      // Amount may be null for one or both
      if (amount) {
        // 1 is token contract address
        row.push(token[1], user, ethers.formatEther(amount).toString());
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
