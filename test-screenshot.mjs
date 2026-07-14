import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000');
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'screenshot1.png' });
  
  await page.click('text=Admin');
  await page.click('text=INITIALIZE SESSION');
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'screenshot2.png' });
  
  await browser.close();
})();
