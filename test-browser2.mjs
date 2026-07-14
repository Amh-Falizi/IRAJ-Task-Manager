import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000');
  await new Promise(r => setTimeout(r, 2000));
  
  const content = await page.content();
  console.log(content);
  
  await browser.close();
})();
