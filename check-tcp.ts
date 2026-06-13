import fs from "fs";
const tcp = fs.readFileSync("/proc/net/tcp", "utf8");
console.log(tcp.split("\n").filter(l => l.includes("0BB8"))); // 3000 in hex is 0BB8
