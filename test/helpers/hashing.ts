/* eslint-disable @typescript-eslint/no-var-requires */
const ensjs = require("@ensdomains/ensjs");
const namehash = require("eth-ens-namehash");


export const normalizeName = (name : string) => namehash.normalize(name);

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
export const hashSubdomainName = (name : string) => {
  // ens namehash lib expects child.parent for hashing algorithm as opposed to our format: parent.child
  const reversedInputName = reverseInputName(name);
  return ensjs.namehash(reversedInputName);
};

/**
 * Hashes last name label only.
 */
export const hashDomainLabel = (label : string) => ensjs.labelhash(label);
