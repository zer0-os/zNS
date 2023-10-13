import { WithId } from "mongodb";


export interface IContractDbData {
  name : string;
  address : string;
  abi : string;
  bytecode : string;
  args : string;
  implementation : string | null;
  version : string;
}

export type TContractDBDoc = WithId<IContractDbData> & IContractDbData;
