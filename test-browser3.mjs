import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  await page.goto('http://localhost:3000/login');
  await page.click('text=Admin');
  await page.click('text=INITIALIZE SESSION');
  
  await new Promise(r => setTimeout(r, 2000));
  console.log('Current URL:', page.url());
  
  const content = await page.content();
  if (content.includes('Dashboard') || content.includes('System Access')) {
     console.log("Found text indicating successful render");
  } else {
     console.log("Content:", content.substring(0, 1000));
  }
  
  await browser.close();
})();
