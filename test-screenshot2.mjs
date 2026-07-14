import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://localhost:3000/login');
  await page.click('text=Admin');
  await page.click('text=INITIALIZE SESSION');
  
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'screenshot-login-after.png' });
  console.log("Screenshot taken.");
  await browser.close();
})();
