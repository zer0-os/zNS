

export const getConfirmationsAmount = () : number => {
  let curConfNum : string | number | undefined = process.env.CONFIRMATION_N;

  if (!curConfNum) {
    const curEnv = process.env.ENV_LEVEL;

    switch (curEnv) {
      case 'dev':
        curConfNum = 0;
        break;
      case 'test':
        curConfNum = 2;
        break;
      default:
        throw new Error("Invalid environment. Failure to determine confifmations amount for transaction!");
    }
  } else {
    curConfNum = Number(curConfNum);
  }

  return curConfNum;
};
