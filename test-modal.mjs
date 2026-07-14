import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://localhost:3000/login');
  await page.click('text=Admin');
  await page.click('text=INITIALIZE SESSION');
  await new Promise(r => setTimeout(r, 2000));
  const content = await page.content();
  console.log("Includes 'Welcome to the Workspace':", content.includes('Welcome to the Workspace!'));
  await browser.close();
})();
