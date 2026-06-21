import fs from "fs";
fetch("http://localhost:3000/api/tasks").then(r => {
  console.log("Status:", r.status, r.ok);
  return r.text();
}).then(text => console.log(text.substring(0, 100))).catch(console.error);
