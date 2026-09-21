import puppeteer from 'puppeteer-core';
import { ensureServer, URL } from './server.mjs';
const EXE = '/usr/bin/chromium';
const b = await puppeteer.launch({ executablePath: EXE, headless: 'new', args: ['--no-sandbox'] });
const page = await b.newPage();
page.on('console', (m) => console.log('PAGE:', m.text()));
page.on('pageerror', (e) => console.log('PAGEERR:', String(e)));
await page.setViewport({ width: 320, height: 240, deviceScaleFactor: 3 });
await ensureServer();
await page.goto(URL, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 600));
// send a real key event sequence and check
await page.keyboard.down('a');
await new Promise((r) => setTimeout(r, 100));
await page.keyboard.up('a');
await new Promise((r) => setTimeout(r, 400));
const has = await page.evaluate(() => document.title);
console.log('title:', has);
// check whether the served JS contains our ach marker
const html = await page.evaluate(() => [...document.scripts].map(s=>s.src).join(','));
console.log('scripts:', html);
await page.screenshot({ path: '/tmp/m26-ach3.png' });
await b.close();
