const { chromium } = require('playwright');
(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'networkidle' });
  await page.click('#btnSyncStore');
  await page.waitForTimeout(4000);
  const status = await page.textContent('#matchStatus');
  console.log('MATCH_STATUS=' + status);
  console.log('LOGS_START');
  for (const l of logs) console.log(l);
  console.log('LOGS_END');
  await browser.close();
})();
