import { withdrawStakedByGovernor } from "../utils/withdraw-staked";


void (async () => {
  try {
    const token = process.env.WITHDRAW_TOKEN_ADDRESS;
    const to = process.env.TREASURY_WITHDRAW_RECIPIENT;

    if (!token || !to) {
      throw new Error("TOKEN_ADDRESS environment variable is not set");
    }

    const tx = await withdrawStakedByGovernor({
      token,
      to,
    });

    console.log(`Withdrawal transaction successful: ${tx.hash}`);
    process.exit(0);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
  } catch (error : Error) {
    console.error(
      `Error withdrawing staked tokens: ${error.message}
      ${error.stack}`
    );
    process.exit(1);
  }
})();
