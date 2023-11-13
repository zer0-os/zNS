import { ethers } from "ethers";
import { IProxyKinds } from "./missions/types";

// Mainnet MEOW token address
export const MEOW_TOKEN = "0x0ec78ed49c2d27b315d462d43b5bab94d2c79bf8";

export const ProxyKinds : IProxyKinds = {
  uups: "uups",
  transparent: "transparent",
  beacon: "beacon",
};

// role names
export const GOVERNOR_ROLE = ethers.utils.solidityKeccak256(
  ["string"],
  ["GOVERNOR_ROLE"],
);
export const ADMIN_ROLE = ethers.utils.solidityKeccak256(
  ["string"],
  ["ADMIN_ROLE"],
);
export const REGISTRAR_ROLE = ethers.utils.solidityKeccak256(
  ["string"],
  ["REGISTRAR_ROLE"],
);
export const EXECUTOR_ROLE = ethers.utils.solidityKeccak256(
  ["string"],
  ["EXECUTOR_ROLE"],
);

export const ResolverTypes = {
  address: "address",
};
