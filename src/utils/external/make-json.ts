import csvParser from "convert-csv-to-json";


const csvPath = "./src/utils/sec-sweep/DATA/all-contracts.csv";
const jsonPath = "./src/utils/sec-sweep/DATA/all-contracts.json";
const delimiter = ",";

csvParser.fieldDelimiter(delimiter).generateJsonFileFromCsv(csvPath, jsonPath);
