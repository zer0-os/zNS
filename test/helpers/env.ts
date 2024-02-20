
interface EnvConfig {
  [key : string] : string;
}

let defaults : EnvConfig | null = null;

export const clearEnvDefaults = () => {
  if (defaults) {
    Object.keys(defaults).forEach(key => {
      delete defaults?.[key];
    });
  }
};

export const setEnvVars = (config : EnvConfig) => {
  Object.keys(config).forEach(key => {
    if (!defaults) defaults = {};

    defaults[key] = process.env[key]?.toString() || "";
  });

  Object.keys(config).forEach(key => {
    process.env[key] = config[key];
  });
};

export const setDefaultEnv = () => {
  if (defaults) {
    Object.keys(defaults).forEach(key => {
      process.env[key] = defaults?.[key];
    });
  }
};
