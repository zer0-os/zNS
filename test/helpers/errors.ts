export const getAccessRevertMsg = (addr : string, role : string) : string =>
  `AccessControl: account ${addr.toLowerCase()} is missing role ${role}`;

// revert messages
// When adding a revert test, check if this message is already present in other tests
//  if it is, add a new constant here and use it in all tests

// ZNSCurvePricer.sol
export const MULTIPLIER_BELOW_MIN_ERR = "ZNSCurvePricer: Multiplier must be >= baseLength + 1";
export const NO_ZERO_MULTIPLIER_ERR = "ZNSCurvePricer: Multiplier cannot be 0";
export const MULTIPLIER_OUT_OF_RANGE_ORA_ERR = "ZNSCurvePricer: Multiplier out of range";
export const CURVE_NO_ZERO_PRECISION_MULTIPLIER_ERR = "ZNSCurvePricer: precisionMultiplier cannot be 0";
export const CURVE_PRICE_CONFIG_ERR = "ZNSCurvePricer: incorrect value set causes the price spike at maxLength.";

// ZNSRegistry
export const ONLY_NAME_OWNER_REG_ERR = "ZNSRegistry: Not the Name Owner";
export const ONLY_OWNER_REGISTRAR_REG_ERR = "ZNSRegistry: Only Name Owner or Registrar allowed to call";
export const NOT_AUTHORIZED_REG_WIRED_ERR = "ARegistryWired: Not authorized. Only Owner or Operator allowed";
export const NOT_AUTHORIZED_REG_ERR = "ZNSRegistry: Not authorized";
export const OWNER_NOT_ZERO_REG_ERR = "ZNSRegistry: Owner cannot be zero address";

// ZNSRootRegistrar.sol
export const NOT_NAME_OWNER_RAR_ERR = "ZNSRootRegistrar: Not the owner of the Name";
export const NOT_TOKEN_OWNER_RAR_ERR = "ZNSRootRegistrar: Not the owner of the Token";
export const NOT_BOTH_OWNER_RAR_ERR = "ZNSRootRegistrar: Not the owner of both Name and Token";

// Subdomain Registrar
// eslint-disable-next-line max-len
export const DISTRIBUTION_LOCKED_NOT_EXIST_ERR = "ZNSSubRegistrar: Parent domain's distribution is locked or parent does not exist";

// StringUtils
export const INVALID_NAME_ERR = "StringUtils: Invalid domain label";
export const INVALID_LENGTH_ERR = "StringUtils: Domain label too long or nonexistent";

// Treasury
export const NO_BENEFICIARY_ERR = "ZNSTreasury: parent domain has no beneficiary set";

// OpenZeppelin
export const INVALID_TOKENID_ERC_ERR = "ERC721: invalid token ID";
export const INITIALIZED_ERR = "Initializable: contract is already initialized";

// Environment validation
export const INVALID_ENV_ERR = "Invalid environment value. Must set env to one of `dev`, `test`, or `prod`";
export const NO_MOCK_PROD_ERR = "Cannot mock MEOW token in production";
export const STAKING_TOKEN_ERR = "Must use MEOW token in production";
export const INVALID_CURVE_ERR = "Must use a valid price configuration";
export const MONGO_URI_ERR = "Cannot use local mongo URI in production";