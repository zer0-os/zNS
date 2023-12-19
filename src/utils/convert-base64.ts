

const toBase64 = (str : string) => btoa(str);

const fromBase64 = (str : string) => atob(str);

const [
  toOrFrom,
  str,
] = process.argv.slice(2);


if (toOrFrom === "to") {
  console.log(toBase64(str));
} else if (toOrFrom === "from") {
  console.log(fromBase64(str));
} else {
  console.log("Invalid arguments");
}
