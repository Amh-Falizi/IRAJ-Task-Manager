async function run() {
  const res = await fetch("http://127.0.0.1:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test2", email: "test2@y.com", password: "pwd" })
  });
  console.log("Status:", res.status);
  console.log("Headers:", [...res.headers]);
  console.log("Body:", await res.text());
}
run();
