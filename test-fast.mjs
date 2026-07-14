import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  await page.goto('http://localhost:3000/login');
  await page.click('text=Admin');
  await page.click('text=INITIALIZE SESSION');
  await new Promise(r => setTimeout(r, 2000));
  console.log('Done');
  await browser.close();
})();
