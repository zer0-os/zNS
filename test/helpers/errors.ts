export const getAccessRevertMsg = (addr : string, role : string) : string =>
  `AccessControl: account ${addr.toLowerCase()} is missing role ${role}`;

// revert messages
// When adding a revert test, check if this message is already present in other tests
//  if it is, add a new constant here and use it in all tests

// ZNSRegistry
export const ONLY_NAME_OWNER_REG_ERR = "ZNSRegistry: Not the Name Owner";
export const ONLY_OWNER_REGISTRAR_REG_ERR = "ZNSRegistry: Only Name Owner or Registrar allowed to call";
export const NOT_AUTHORIZED_REG_ERR = "ZNSRegistry: Not authorized";
export const OWNER_NOT_ZERO_REG_ERR = "ZNSRegistry: Owner cannot be zero address";

// ZNSRegistrar
export const NOT_NAME_OWNER_RAR_ERR = "ZNSRegistrar: Not the owner of the Name";
export const NOT_TOKEN_OWNER_RAR_ERR = "ZNSRegistrar: Not the owner of the Token";
export const MULTIPLIER_OUT_OF_RANGE_ORA_ERR = "ZNSPriceOracle: Multiplier out of range";
export const INVALID_TOKENID_ERC_ERR = "ERC721: invalid token ID";
export const INITIALIZED_ERR = "Initializable: contract is already initialized";
