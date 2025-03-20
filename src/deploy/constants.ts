import { IProxyKinds } from "@zero-tech/zdc";
import { ethers } from "ethers";


export const ProxyKinds : IProxyKinds = {
  uups: "uups",
  transparent: "transparent",
  beacon: "beacon",
};

// role names
export const GOVERNOR_ROLE = ethers.solidityPackedKeccak256(
  ["string"],
  ["GOVERNOR_ROLE"],
);
export const ADMIN_ROLE = ethers.solidityPackedKeccak256(
  ["string"],
  ["ADMIN_ROLE"],
);
export const REGISTRAR_ROLE = ethers.solidityPackedKeccak256(
  ["string"],
  ["REGISTRAR_ROLE"],
);
export const EXECUTOR_ROLE = ethers.solidityPackedKeccak256(
  ["string"],
  ["EXECUTOR_ROLE"],
);

export const ResolverTypes = {
  address: "address",
};
