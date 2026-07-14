import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const pagesToVisit = [
    { name: 'Dashboard', url: 'http://localhost:3000/' },
    { name: 'Projects', url: 'http://localhost:3000/projects' },
    { name: 'Board', url: 'http://localhost:3000/board' },
    { name: 'Graph', url: 'http://localhost:3000/graph' },
    { name: 'Calendar', url: 'http://localhost:3000/calendar' },
    { name: 'Teams', url: 'http://localhost:3000/teams' },
    { name: 'Documents', url: 'http://localhost:3000/documents' },
    { name: 'Planning', url: 'http://localhost:3000/planning' },
    { name: 'Profile', url: 'http://localhost:3000/profile' }
  ];

  await page.goto('http://localhost:3000/login');
  await page.click('text=Admin');
  await page.click('text=INITIALIZE SESSION');
  await new Promise(r => setTimeout(r, 2000));
  
  for (const p of pagesToVisit) {
    try {
      await page.goto(p.url, { timeout: 5000 });
      await new Promise(r => setTimeout(r, 1000));
      const text = await page.locator('body').innerText();
      if (!text || text.trim().length === 0) {
        console.log(`ERROR: Page ${p.name} is BLANK!`);
      } else if (text.includes('Something went wrong')) {
        console.log(`ERROR: Page ${p.name} threw ErrorBoundary!`);
      } else {
        console.log(`SUCCESS: Page ${p.name} loaded fine (length: ${text.length})`);
      }
    } catch (e) {
      console.log(`ERROR: Could not load ${p.name}: ${e.message}`);
    }
  }
  
  await browser.close();
})();
