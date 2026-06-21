import fetch from "node-fetch";

async function run() {
  try {
    const res = await fetch("http://127.0.0.1:3000/api/auth/me");
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
  } catch (e) {
    console.error(e);
  }
}
run();
