// eslint-disable-next-line @typescript-eslint/no-var-requires
const ensjs = require("@ensdomains/ensjs");
import { ethers } from "ethers";

/**
 * The ens lib takes the inverse of our domain name format to
 * produce the same namehash as the one produced from our
 * registrar contract, so we need to inverse the input here.
 *
 */
export const reverseInputName = (name : string) => {
  const splitName = name.split(".");
  const reversedName = splitName.reverse();
  return reversedName.join(".");
};

/**
 * Hashes full domain path.
 */
export const hashDomainName = (name : string) => {
  // ens namehash lib expects child.parent for hashing algorithm as opposed to our format: parent.child
  const reversedInputName = reverseInputName(name);
  const hashedName = ensjs.namehash(reversedInputName);

  return hashedName;
};

/**
 * Hashes last name label only.
 */
export const hashDomainLabel = (label : string) => ensjs.labelhash(label);

/**
 * Hashes a domain and parent without normalization like ENS above
 */
export const legacyHashWithParent = (label : string, parentId : string) => {
  const labelHash = ethers.utils.solidityKeccak256(["string"], [label]);
  const hash = ethers.utils.solidityKeccak256(["uint256", "uint256"],[parentId,labelHash]);
  return hash;
};