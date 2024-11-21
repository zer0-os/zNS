import * as hre from "hardhat";
import { MeowTokenMock, MeowTokenMock__factory } from "../../typechain";


const sendTxes = async () => {
  const amounts = Array.from({ length: 50 }, (_, i) => BigInt(i + 1) * BigInt(1e18));

  const [caller, caller2, caller3] = await hre.ethers.getSigners();
  const fact = new MeowTokenMock__factory();
  const meowToken = fact.attach("0x50e6DFFf992747775C9c49717CFC4970b40594Dc") as MeowTokenMock;

  const resArr = await amounts.reduce(
    async (acc, amt, idx) => {
      const res = await acc;

      const txCaller = idx % 3 === 0 ? caller : idx % 3 === 1 ? caller2 : caller3;
      console.log(`Minting tx #${idx} from ${txCaller.address}`);

      const tx = await meowToken.connect(txCaller).mint(txCaller.address, amt);
      const rec = await tx.wait(1);
      res.push(rec);
      return res;
    }, Promise.resolve([]),
  );

  console.log("Minted tokens:", JSON.stringify(resArr, null, "\t"));
};

// sendTxes().catch(error => {
//   console.error(error);
//   process.exit(1);
// });
