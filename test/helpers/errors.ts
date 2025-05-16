// revert messages
// When adding a revert test, check if this message is already present in other tests
//  if it is, add a new constant here and use it in all tests

export const ERC721_INVALID_RECEIVER_ERR = "ERC721InvalidReceiver";
export const ERC721_NOT_APPROVED_ERR = "ERC721InsufficientApproval";
export const ALREADY_FULL_OWNER_ERR = "AlreadyFullOwner";
export const CANNOT_BURN_TOKEN_ERR = "CannotBurnToken";

// AccessControl
export const AC_UNAUTHORIZED_ERR = "AccessControlUnauthorizedAccount";

// ERC20
export const INSUFFICIENT_BALANCE_ERC_ERR = "ERC20InsufficientBalance";
export const INSUFFICIENT_ALLOWANCE_ERC_ERR = "ERC20InsufficientAllowance";

// CommonErrors.sol
export const ZERO_ADDRESS_ERR = "ZeroAddressPassed";
export const DOMAIN_EXISTS_ERR = "DomainAlreadyExists";
export const NOT_AUTHORIZED_ERR = "NotAuthorizedForDomain";
export const NOT_FULL_OWNER_ERR = "NotFullDomainOwner";

// IZNSPricer.sol
export const PARENT_CONFIG_NOT_SET_ERR = "ParentPriceConfigNotSet";
export const FEE_TOO_LARGE_ERR = "FeePercentageValueTooLarge";

// ZNSCurvePricer.sol
export const INVALID_PRECISION_MULTIPLIER_ERR = "InvalidPrecisionMultiplierPassed";
export const INVALID_PRICE_CONFIG_ERR = "InvalidConfigCausingPriceSpikes";
export const INVALID_BASE_OR_MAX_LENGTH_ERR = "MaxLengthSmallerThanBaseLength";
export const DIVISION_BY_ZERO_ERR = "DivisionByZero";

// ZNSRootRegistrar.sol
export const NOT_OWNER_OF_ERR = "NotTheOwnerOf";

// Subdomain Registrar
// eslint-disable-next-line max-len
export const DISTRIBUTION_LOCKED_NOT_EXIST_ERR = "ParentLockedOrDoesntExist";
export const SENDER_NOT_APPROVED_ERR = "SenderNotApprovedForPurchase";

// StringUtils
export const INVALID_LABEL_ERR = "DomainLabelContainsInvalidCharacters";
export const INVALID_LENGTH_ERR = "DomainLabelTooLongOrNonexistent";

// Treasury
export const NO_BENEFICIARY_ERR = "NoBeneficiarySetForParent";

// OpenZeppelin
export const NONEXISTENT_TOKEN_ERC_ERR = "ERC721NonexistentToken";
export const INITIALIZED_ERR = "InvalidInitialization";

// Environment validation
export const INVALID_ENV_ERR = "Invalid environment value. Must set env to one of `dev`, `test`, or `prod`";
export const NO_MOCK_PROD_ERR = "Cannot mock MEOW token in production";
export const STAKING_TOKEN_ERR = "Must use MEOW token in production";
export const INVALID_CURVE_ERR = "Must use a valid price configuration";
export const MONGO_URI_ERR = "Cannot use local mongo URI in production";
export const NO_ZERO_VAULT_ERR = "Must provide ZERO_VAULT_ADDRESS for 'prod' or 'test' environments";
