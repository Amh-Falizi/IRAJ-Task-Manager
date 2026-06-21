import fs from "fs";
try {
  console.log("CWD:", fs.readlinkSync("/proc/2248/cwd"));
}catch(e){}
