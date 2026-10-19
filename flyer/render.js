// 使い方: node flyer/render.js  → flyer/flyer.pdf と preview-*.png を出力
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1610, height: 1145 } });
  await page.goto('file://' + path.join(__dirname, 'index.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(__dirname, 'flyer.pdf'), width: '426mm', height: '303mm', printBackground: true, preferCSSPageSize: true });
  const sheets = await page.$$('.sheet');
  for (let i = 0; i < sheets.length; i++) {
    await sheets[i].screenshot({ path: path.join(__dirname, `preview-${i + 1}.png`) });
  }
  await browser.close();
})();
