// TODO multi: create a proper big ENV file with all default values here
//  and make it be the default for all the tests and so it's easier to fill, clear
//  and override it when needed.

export const resetEnvVars = () => {
  delete process.env.SRC_CHAIN_NAME;
  delete process.env.MOCK_ZKEVM_BRIDGE;
  delete process.env.NETWORK_ID;
  delete process.env.DEST_NETWORK_ID;
  delete process.env.DEST_CHAIN_NAME;
  delete process.env.DEST_CHAIN_ID;
  delete process.env.SRC_ZNS_PORTAL;
};

