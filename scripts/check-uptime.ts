import fs from "fs";
try {
  console.log(fs.statSync("/proc/2248").mtime);
} catch(e){}
