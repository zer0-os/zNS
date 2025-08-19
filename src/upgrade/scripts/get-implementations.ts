import { getContractDataForUpgrade, getContractNamesToUpgrade } from "../upgrade";
import { getMongoAdapter } from "../../deploy/db/mongo-adapter/get-adapter";
import * as hre from "hardhat";


export const getProxyImplementations = async () => {
  const dbAdapter = await getMongoAdapter();
  const contractData = await getContractDataForUpgrade(dbAdapter, getContractNamesToUpgrade());

  await Object.values(contractData).reduce(
    async (acc, { contractName, address }) => {
      await acc;

      const implAddress = await hre.upgrades.erc1967.getImplementationAddress(
        address as string
      );

      console.log(`Implementation for ${contractName} is at: ${implAddress}`);
    }, Promise.resolve()
  );
};

getProxyImplementations()
  .then(() => {
    process.exit(0);
  })
  .catch(e => {
    console.error(`Error getting proxy implementations: ${e.message}`);
    process.exit(1);
  });
