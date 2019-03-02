const fs = require("fs");

const INPUT_JSON = "./responses/ba-thesis-data-export.json";
const INPUT_CSV = "./data/finalDatasets/attractions-processed-final.csv";
const OUTPUT_JSON = "./output/json/attractions.json";

const output = { attractions: [] };

const parseRow = row => {
  const parsed = {};
  const parts = row.split(/","/);
  const firstParts = parts[0].split(/,"/);
  parsed.attractionId = parseInt(firstParts[0]);
  parsed.name = firstParts[1];
  parsed.address = parts[1];
  parsed.category = parts[2];
  parsed.description = parts[3];
  const secondParts = parts[4].split(/",/);
  parsed.county = secondParts[0];
  const thirdParts = secondParts[1].split(/,/);
  parsed.latitude = parseFloat(thirdParts[0]);
  parsed.longitude = parseFloat(thirdParts[1]);
  parsed.rating = parseFloat(thirdParts[2]);
  return parsed;
};

fs.readFile(INPUT_JSON, "utf-8", (err, data) => {
  const csv = fs.readFileSync(INPUT_CSV, "utf-8");
  const rows = csv.split("\n");
  if (err) {
    console.error(err);
  } else {
    const json = JSON.parse(data);
    const responses = json.responses;
    const locations = new Set();
    for (let responseId in responses) {
      const response = responses[responseId];
      for (let score of response.scores) {
        const i = parseInt(score.attractionId);
        locations.add(i);
        const row = rows[i];
        output.attractions.push(parseRow(row));
      }
    }
  }
  console.log(output);
  fs.writeFile(OUTPUT_JSON, JSON.stringify(output), err => {
    if (err) {
      console.error(err);
    }
  });
});
