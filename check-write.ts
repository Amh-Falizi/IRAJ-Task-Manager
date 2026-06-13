import fs from "fs";
try {
  fs.writeFileSync(process.cwd() + "/database.sqlite-journal", "test");
  console.log("Journal creation success");
  fs.unlinkSync(process.cwd() + "/database.sqlite-journal");
} catch(e) {
  console.log("Journal creation failed", e);
}
