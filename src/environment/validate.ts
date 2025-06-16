const required = [
  "CONFIRMATION_N", "MONGO_DB_URI", "MONGO_DB_NAME", "ARCHIVE_PREVIOUS_DB_VERSION", "LOG_LEVEL",
  "ARCHIVE_PREVIOUS_DB_VERSION",
  "LOG_LEVEL", "ENV_LEVEL", "ROOT_PRICER_TYPE",
  "DOMAIN_TOKEN_NAME", "DOMAIN_TOKEN_SYMBOL", "ROYALTY_FRACTION", "MOCK_MEOW_TOKEN",
];

export const findMissingEnvVars = () => {
  const missing = required.filter(
    key => process.env[key] === undefined || process.env[key] === ""
  );

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
};
