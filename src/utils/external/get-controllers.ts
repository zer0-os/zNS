import axios from "axios";
import { Registrar__factory } from "../typechain"; // legacy Registrar
import { ethers } from "ethers";


interface IEtherscanTx {
  methodId : string;
  functionName : string;
  input : string;
}

const addresses = [
  "0x0",
];


const getTransactionsForAddress = async (address : string) : Promise<Array<IEtherscanTx>> => {
  const inst = axios.create();

  const { data } = await inst.get(
    `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999999999&page=1&offset=10&sort=asc&apikey=${process.env.ETHERSCAN_API_KEY}`
  );

  return data.result;
};

const getControllersForAddress = async (address : string) => {
  const txes = await getTransactionsForAddress(address);

  const methodIdToCheck = "0xa7fc7a07";
  const functionNameToCheck = "addController(address newController)";

  const historicControllers = txes.reduce(
    (acc : Array<string>, tx : IEtherscanTx) => {
      if (tx.functionName === functionNameToCheck) {
        acc.push(`0x${tx.input.slice(-40)}`);
      }
      return acc;
    },
    []
  );

  const signer = new ethers.providers.JsonRpcProvider(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`);
  const contract = Registrar__factory.connect(address, signer);

  const existingControllers : Array<string> = await historicControllers.reduce(
    async (acc : Promise<Array<string>>, input) => {
      const newAcc = await acc;

      const isController = await contract.controllers(input);

      if (isController) {
        return [...newAcc, input];
      } else {
        return newAcc;
      }
    },
    Promise.resolve([])
  );

  return existingControllers;
};


getControllersForAddress(addresses[0])
  .then(data => {
    console.log(data);
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
