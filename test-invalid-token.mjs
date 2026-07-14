import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Set invalid token in localStorage for the domain
  await page.goto('http://localhost:3000');
  await page.evaluate(() => {
    localStorage.setItem('token', 'invalid_token_123');
  });
  
  // Reload the page
  await page.goto('http://localhost:3000');
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  await new Promise(r => setTimeout(r, 2000));
  console.log('Current URL:', page.url());
  
  const content = await page.content();
  if (content.includes('System Access')) {
     console.log("Successfully redirected to Login");
  } else {
     console.log("Content:", content.substring(0, 500));
  }
  
  await browser.close();
})();
