const required = [
  "ARCHIVE_PREVIOUS_DB_VERSION",
  "BASE_LENGTH",
  "CONFIRMATION_N",
  "CURVE_MULTIPLIER",
  "DECIMALS",
  "DOMAIN_TOKEN_NAME",
  "DOMAIN_TOKEN_SYMBOL",
  "ENV_LEVEL",
  "LOG_LEVEL",
  "MAX_PRICE",
  "MAX_LENGTH",
  "MOCK_MEOW_TOKEN",
  "MONGO_DB_URI",
  "MONGO_DB_NAME",
  "PRECISION",
  "PROTOCOL_FEE_PERC",
  "ROYALTY_FRACTION",
];

export const findMissingEnvVars = () => {
  const missing = required.filter(
    key => process.env[key] === undefined || process.env[key] === ""
  );

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
};
