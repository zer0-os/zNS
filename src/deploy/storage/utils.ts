import fs from "fs";
import { fileStoragePath } from "./file-storage";


export const wipeFileStorage = () => {
  if (fs.existsSync(fileStoragePath)) {
    fs.rmSync(fileStoragePath, { recursive: true, force: true });
  }
};
