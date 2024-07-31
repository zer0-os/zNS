import { znsNames } from "../../deploy/missions/contracts/names.ts";
import { IZNSContracts } from "../../deploy/campaign/types.ts";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getContractFromDB } from "./database.ts";


let znsCache : IZNSContracts | null = null;

export const getZNSMeowChain = async (
  signer : SignerWithAddress,
  dbVersion : string,
) => {

}

export const getZNS = async ({
  signer,
  action = "read" // Must be "read" or "write"
} : {
  signer ?: SignerWithAddress;
  action : string;
}) => {
  if (!znsCache || Object.values(znsCache).length < 10) {
    znsCache = await Object.entries(znsNames).reduce(
      async (acc : Promise<IZNSContracts>, [key, { contract, instance }]) => {
        const newAcc = await acc;

        // TODO ignore meow token for now, not in DB if not mainnet
        // && !== "meowToken" or "meowTokenMock"
        if (key !== "erc1967Proxy") {
          newAcc[instance] = await getContractFromDB({
            name: contract,
            signer,
            action
          });
        }

        return newAcc;
      }, Promise.resolve({} as IZNSContracts)
    );
  }

  return znsCache;
};

// TODO mig: below is test logic to make sure we pull correct data from DB.
//  REMOVE THIS WHEN DONE !!!
//  Currently the `initialize()` method on DB adapter is called always, creating a new `version` object!
//  So be careful running this with the prod URI! We need a read-only access for this case and ONLY connect that way!
//  Otherwise we can mess up the current Prod Mainnet Database!
// const getContracts = async () => {
//   const contracts = await getZNS({
//     dbVersion: process.env.MONGO_DB_VERSION ?? "1703976278937", // current Mainnet DEPLOYED version we need to read from
//   });

//   console.log(contracts);
// };

// getContracts()
//   .then(() => process.exit(0))
//   .catch(err => {
//     console.error(err);
//     process.exit(1);
//   });
