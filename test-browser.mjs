import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  const response = await page.goto('http://localhost:3000');
  console.log('Status:', response.status());
  
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
