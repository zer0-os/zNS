
const required = [
  "MONGO_DB_URI", "MONGO_DB_NAME", "ARCHIVE_PREVIOUS_DB_VERSION", "LOG_LEVEL", "ARCHIVE_PREVIOUS_DB_VERSION",
  "LOG_LEVEL", "ENV_LEVEL", "MAX_PRICE", "CURVE_MULTIPLIER", "MAX_LENGTH", "BASE_LENGTH", "PROTOCOL_FEE_PERC",
  "DECIMALS", "PRECISION", "DOMAIN_TOKEN_NAME", "DOMAIN_TOKEN_SYMBOL", "ROYALTY_FRACTION", "MOCK_MEOW_TOKEN",
  "SRC_CHAIN_NAME", "MOCK_ZKEVM_BRIDGE",
];

// TODO multi: is there a way to evaluate a type of the full ENV and run the below function
//  only on non-optional parameters?
export const findMissingEnvVars = () => {
  const missing = required.filter(
    key =>
      process.env[key] === undefined || process.env[key] === ""
  );

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
};
