import fs from "fs";
try {
  fs.chmodSync("/tmp/database.sqlite", 0o666);
  console.log("chmod successful");
} catch(e) {
  console.log("chmod failed:", e);
}
