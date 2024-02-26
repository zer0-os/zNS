import { Defender } from "@openzeppelin/defender-sdk";
import { DefenderRelaySignerOptions } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";


export const getDefenderRelayer = ({
  defenderCreds,
  signerOpts,
} : {
  defenderCreds ?: {
    apiKey ?: string;
    apiSecret ?: string;
    relayerApiKey ?: string;
    relayerApiSecret ?: string;
  };
  signerOpts : DefenderRelaySignerOptions;
} = {
  signerOpts: { speed: "fast" },
}) => {
  let credentials;
  if (!defenderCreds) {
    credentials = {
      apiKey: process.env.DEFENDER_KEY,
      apiSecret: process.env.DEFENDER_SECRET,
      relayerApiKey: process.env.RELAYER_KEY,
      relayerApiSecret: process.env.RELAYER_SECRET,
    };
  } else {
    credentials = defenderCreds;
  }

  const client = new Defender(credentials);

  const provider = client.relaySigner.getProvider();
  const signer = client.relaySigner.getSigner(provider, signerOpts);

  return {
    client,
    provider,
    signer,
  };
};
