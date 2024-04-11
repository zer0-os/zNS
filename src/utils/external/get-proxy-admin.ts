import { ethers } from "ethers";
import hre from "hardhat";


const _ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

const main = async () => {
  const contracts = [
    "0x0",
  ];

  await contracts.reduce(
    async (acc, contract) => {
      await acc;

      const provider = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${process.env.API_KEY}`);
      const slot = await provider.getStorageAt(
        contract,
        _ADMIN_SLOT
      );
      // method to remove zeros and return ethereum address
      const proxyAdminAddr = `0x${slot.slice(26)}`;

      console.log(`Contract ${contract} PROXYADMIN: ${proxyAdminAddr}`);

      if (proxyAdminAddr !== ethers.constants.AddressZero) {
        const prAdFact = await hre.ethers.getContractFactory("ProxyAdmin");
        const proxyAdmim = prAdFact.attach(proxyAdminAddr);
        // const owner = await proxyAdmim.owner();
        const owner = await provider.getStorageAt(proxyAdminAddr, 0);
        console.log(`Contract ${contract} OWNER OF PROXY ADMIN: ${`0x${owner.slice(26)}`}`);
      }
    }, Promise.resolve()
  );
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
