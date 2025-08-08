import { createEncodeCurvePriceConfig, DEFAULT_PRECISION_MULTIPLIER } from "../../test/helpers";


void (async () => {
  const priceConfigEncoded = createEncodeCurvePriceConfig({
    maxPrice: 0n,
    maxLength: 50n,
    baseLength: 4n,
    curveMultiplier: 1000n,
    precisionMultiplier: DEFAULT_PRECISION_MULTIPLIER,
    feePercentage: 222n,
  });

  console.log(`Encoded Price Config: ${priceConfigEncoded}`);
})();
