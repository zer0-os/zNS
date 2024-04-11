import axios from "axios";

const getCreatorFromEtherscan = async () => {
  const contractAddresses : Array<string> = [
    "0x0",
  ];

  const inst = axios.create();

  const addressesStr = contractAddresses.join(",");

  const { data } = await inst.get(
    `https://api.etherscan.io/api?module=contract&action=getcontractcreation&contractaddresses=${addressesStr}&apikey=${process.env.API_KEY}`
  );

  data.result.map((item : any) => {
    console.log(`Contract: ${item.contractAddress} DEPLOYER: ${item.contractCreator}`);
  });
};

getCreatorFromEtherscan()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
