import { deleteFork, forkNetwork } from "./fork";

// Arguments for direct execution:
// no argument or "new" - to create a new fork
// "del" + "forkURL" - to delete the fork
const operation = process.argv[2];

if (operation === "new" || !operation) {
  forkNetwork()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
} else if (operation === "del") {
  const forkURL = process.argv[3];
  if (!forkURL) {
    console.error("Fork URL is required to delete a fork");
    process.exit(1);
  }

  deleteFork(forkURL)
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
} else {
  console.error("Invalid operation. Make sure you pass the correct arguments.");
  process.exit(1);
}
