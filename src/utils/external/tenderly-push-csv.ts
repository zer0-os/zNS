/* eslint-disable camelcase */
import axios from "axios";
import fs from "fs";
import { HardhatDeployer } from "@zero-tech/zdc";


const accountId = "zer0-os";
const projectSlug = "all-legacy-contracts";
const jsonPath = "./src/utils/sec-sweep/DATA/all-contracts.json";


const csvToTenderly = async () => {
  // {
  //   "network_id": "42",
  //   "address": "0x404469525f6Ab4023Ce829D8F627d424D3986675",
  //   "display_name": "My new contract name"
  // }
  const json = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const contracts = json.reduce(
    (
      acc : Array<Array<{ network_id : string; address : string; display_name : string; }>>,
      { name, address } : {
        name : string;
        address : string;
      },
      idx : number
    ) => {
      const obj = {
        network_id: "1",
        address,
        display_name: name,
      };

      const chunk = 40;

      if (idx < chunk) {
        acc[0].push(obj);
      } else if (idx < chunk * 2) {
        acc[1].push(obj);
      } else if (idx < chunk * 3) {
        acc[2].push(obj);
      } else {
        acc[3].push(obj);
      }

      if (!address.includes("0x")) throw new Error(`Invalid address: ${address} for name ${name}.`);

      return acc;
    }, [
      [],
      [],
      [],
      [],
    ]
  );

  const inst = axios.create({
    baseURL: "https://api.tenderly.co/",
    headers: {
      "Content-Type": "application/json",
      "X-Access-Key": process.env.TENDERLY_ACCESS_KEY,
    },
  });

  for (const inner of contracts) {
    const res = await inst.post(
      `api/v2/accounts/${accountId}/projects/${projectSlug}/contracts`,
      { contracts: inner }
    );

    console.log(res.statusText);
  }
};

csvToTenderly()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
