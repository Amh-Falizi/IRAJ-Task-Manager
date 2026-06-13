import { execSync } from "child_process";
try {
  console.log(execSync("netstat -tulpn | grep 3000").toString());
} catch (e) {
  console.log("No netstat");
}
