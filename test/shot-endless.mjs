import puppeteer from 'puppeteer-core';
import { ensureServer, URL } from './server.mjs';
const EXE = '/usr/bin/chromium';
const b = await puppeteer.launch({ executablePath: EXE, headless: 'new', args: ['--no-sandbox'] });
const page = await b.newPage();
await page.setViewport({ width: 320, height: 240, deviceScaleFactor: 3 });
await ensureServer();
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.evaluate(() => {
  const meta = { gold: 120, unlocked: ['crouton','survive5','survive10','kills500','boss3','minekill','goldrun','lintking','compostwin','flushkill','toastwin','boss6','endless'], achievements: [], bestTime: 1800, bestKills: 3200, upgrades: {} };
  localStorage.setItem('poop-survivors-meta', JSON.stringify(meta));
});
await page.reload({ waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 600));
const st = await page.evaluate(() => window.__cap.selectStage('endless'));
console.log('select:', JSON.stringify(st && st.err ? st.err : 'ok'));
await b.close();
