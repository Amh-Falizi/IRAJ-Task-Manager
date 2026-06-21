fetch("http://127.0.0.1:3000/api/users")
  .then(res => res.text())
  .then(text => console.log("Response:", text))
  .catch(err => console.error("Error:", err));
