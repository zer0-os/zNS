
export interface INetworkData {
  [env : string] : {
    name : string;
    id : string;
  };
}

export const NetworkData : INetworkData = {
  test: {
    name: "sepolia",
    id: "11155111",
  },
  prod: {
    name: "mainnet",
    id: "1",
  },
};
