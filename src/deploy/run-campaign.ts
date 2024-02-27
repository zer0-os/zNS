import { getConfig } from "./campaign/environments";
import { runZnsCampaign } from "./zns-campaign";
import { getLogger } from "@zero-tech/zdc";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getDefenderRelayer } from "../utils/oz-defender/relayer";


const logger = getLogger();

const runCampaign = async () => {
  const {
    provider,
    signer: deployer,
  } = getDefenderRelayer();

  const config = await getConfig({
    deployer: deployer as unknown as SignerWithAddress,
  });

  await runZnsCampaign({
    config,
    provider,
  });
};

runCampaign().catch(error => {
  logger.error(error.stack);
  process.exit(1);
}).finally(() => {
  process.exit(0);
});
