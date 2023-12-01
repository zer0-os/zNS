
export const ethMultiplier = BigInt(10) ** 18n;

export const calcGasCostInCurrency = (
  gas : string,
  gasPriceInGwei : string,
  ethPriceInUSD : string,
) => {
  let cost;
  let currency = "WEI";
  cost = BigInt(gas) * BigInt(gasPriceInGwei) * ethMultiplier / (BigInt(10) ** 9n);

  if (!!ethPriceInUSD) {
    currency = "USD WEI";
    cost = cost * BigInt(ethPriceInUSD);
  }

  return { cost, currency };
};


// Execute
const [
  gasArg,
  gasPriceArg,
  ethPriceArg,
] = process.argv.slice(2);

const {
  cost: totalCost,
  currency: costCurrency,
} = calcGasCostInCurrency(gasArg, gasPriceArg, ethPriceArg);

console.log(`Total cost: ${totalCost.toString()} ${costCurrency}`);

// register (14 gwei, $1856) = $8.84 (ENS = $8.49)
// reclaim (14 gwei, $1856) = $1.71
// revoke (14 gwei, $1856) = $3.03
