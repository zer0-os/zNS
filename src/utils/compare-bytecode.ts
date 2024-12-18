
const replacePattern = /a165627a7a72305820.{64}0029.*/g;

export const compareBytecodeStrict = (bytecodeA : string, bytecodeB : string) => {
  const bytecodeAWithoutMetadata = bytecodeA.replace(replacePattern, ".{86}");
  const bytecodeBWithoutMetadata = bytecodeB.replace(replacePattern, ".{86}");

  return bytecodeAWithoutMetadata === bytecodeBWithoutMetadata;
};
