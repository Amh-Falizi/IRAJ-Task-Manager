import fs from "fs";
try {
  let DB_FILE = process.cwd() + "/database.sqlite";
  console.log("File exists:", fs.existsSync(DB_FILE));
  if (fs.existsSync(DB_FILE)) {
    const stats = fs.statSync(DB_FILE);
    console.log("Stats mode:", stats.mode.toString(8));
  }
} catch(e) {
  console.log("Error:", e);
}
