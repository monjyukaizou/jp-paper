// 使い方: node flyer/tokyo/reedit_render.js → reedit_cover.png / assets/reedit_cover.png を出力
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 800, height: 1130 }, deviceScaleFactor: 2 });
  await p.goto('file://' + path.join(__dirname, 'reedit_cover.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const el = await p.$('.cover');
  await el.screenshot({ path: path.join(__dirname, 'reedit_cover.png') });
  await el.screenshot({ path: path.join(__dirname, 'assets', 'reedit_cover.png') });
  await b.close();
})();
