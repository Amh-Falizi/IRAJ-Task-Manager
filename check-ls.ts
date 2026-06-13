import fs from "fs";
const files = fs.readdirSync(process.cwd());
files.forEach(f => {
  if (f.includes("sqlite")) {
    console.log(f, fs.statSync(f).mode.toString(8));
  }
});
