const http = require('http');

const request = (path, data) => new Promise((resolve, reject) => {
  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
  });
  req.on('error', reject);
  req.write(JSON.stringify(data));
  req.end();
});

(async () => {
  const email = `test-${Date.now()}@test.com`;
  const pass = 'password123';
  
  const reg = await request('/api/auth/register', { name: 'Test', email, password: pass, role: 'developer' });
  console.log('Register:', reg);
  
  const log = await request('/api/auth/login', { email, password: pass });
  console.log('Login:', log);
})();
