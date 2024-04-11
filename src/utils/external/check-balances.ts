import fs from "fs";
import { ethers } from "ethers";
import { ERC20__factory } from "../../../typechain";

const notValidStr = "NOT A VALID ETHEREUM ADDRESS";
const accountsJsonPath = "./src/utils/check-balances/DATA/accounts.json";
const fullJsonOutputPath = "./src/utils/check-balances/DATA/balances.json";

interface AccountIn {
  name : string;
  address : string;
}

interface Balances {
  ETH : bigint | string;
  WETH : bigint | string;
  WBTC : bigint | string;
  USDC : bigint | string;
  WILD : bigint | string;
  MEOW : bigint | string;
}

type TokenSymbol = keyof Balances;

interface AccountOut extends AccountIn {
  balances : Balances | "NOT A VALID ETHEREUM ADDRESS";
}

const tokenAddresses = {
  ETH: "no-address",
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  WILD: "0x2a3bFF78B79A009976EeA096a51A948a3dC00e34",
  MEOW: "0x0eC78ED49C2D27b315D462d43B5BAB94d2C79bf8",
};


const provider = new ethers
  .JsonRpcProvider(`https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`);


const getBalances = async () => {
  const accountsJson = JSON.parse(
    fs.readFileSync(accountsJsonPath, "utf8")
  );

  return accountsJson.reduce(
    async (
      acc : Promise<Array<AccountOut>>,
      { name: accountName, address: accountAddress } : AccountIn
    ) => {
      const newAccOuter = await acc;
      let balances;

      if (accountAddress.slice(0, 2) !== "0x") {
        console.log(`Account ${accountName} has an invalid address: ${accountAddress}`);
        return [...newAccOuter, { name: accountName, address: accountAddress, balances: notValidStr }];

        // TODO: remove the "else" block below if this proves to be a pointless "if" here
      } else if (accountAddress !== "") {
        balances = await Object.entries(tokenAddresses).reduce(
          async (innerAcc : Promise<Balances>, [symbol, tokenAddress]) : Promise<Balances> => {
            const balancesAcc = await innerAcc;

            let balance;
            if (symbol === "ETH") {
              try {
                balance = await provider.getBalance(accountAddress);
                balancesAcc[symbol] = balance.toString();
              } catch (e) {
                balancesAcc[symbol] = (e as Error).message;
              }

              return balancesAcc;
            }

            const tokenContract = ERC20__factory.connect(tokenAddress, provider);

            try {
              balance = await tokenContract.balanceOf(accountAddress);
              balancesAcc[symbol as TokenSymbol] = balance.toString();
            } catch (e) {
              balancesAcc[symbol as TokenSymbol] = (e as Error).message;
            }

            return balancesAcc;
          }, Promise.resolve({} as Balances)
        );
      } else {
        throw new Error(`Unknown case for name: ${accountName} and address: ${accountAddress}`);
      }

      console.log(`Added balances for Account ${accountName} and address ${accountAddress}.`);
      return [
        ...newAccOuter,
        {
          name: accountName,
          address: accountAddress,
          balances,
        },
      ];
    }, Promise.resolve([])
  );
};

const balancesToJson = async () => {
  const balances = await getBalances();

  console.log("GOT ALL BALANCES! Writing balances to file...");

  fs.writeFileSync(fullJsonOutputPath, JSON.stringify(balances, null, 2));
};

balancesToJson()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
