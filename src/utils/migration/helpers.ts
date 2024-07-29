import { znsNames } from "../../deploy/missions/contracts/names.ts";
import { getContract } from "./getters.ts";
import { IZNSContracts } from "../../deploy/campaign/types.ts";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


export const getZNS = async ({
  signer,
  dbVersion,
} : {
  signer ?: SignerWithAddress;
  dbVersion : string;
}) => Object.entries(znsNames).reduce(
  async (acc : Promise<IZNSContracts>, [ key, { contract, instance } ]) => {
    const newAcc = await acc;
    if (key !== "erc1967Proxy") {
      newAcc[instance] = await getContract({
        name: contract,
        version: dbVersion,
        signer,
      });
    }

    return newAcc;
  }, Promise.resolve({} as IZNSContracts)
);

// TODO mig: below is test logic to make sure we pull correct data from DB.
//  REMOVE THIS WHEN DONE !!!
//  Currently the `initialize()` method on DB adapter is called always, creating a new `version` object!
//  So be careful running this with the prod URI! We need a read-only access for this case and ONLY connect that way!
//  Otherwise we can mess up the current Prod Mainnet Database!
const getContracts = async () => {
  const contracts = await getZNS({
    dbVersion: "1703976278937", // current Mainnet DEPLOYED version we need to read from
  });

  console.log(contracts);
};

getContracts()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
