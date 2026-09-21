import puppeteer from 'puppeteer-core';
import { ensureServer, URL } from './server.mjs';
const EXE = '/usr/bin/chromium';
const b = await puppeteer.launch({ executablePath: EXE, headless: 'new', args: ['--no-sandbox'] });
const page = await b.newPage();
await ensureServer();
await page.goto(URL, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 800));
await page.mouse.click(160, 120); // give the document focus
await new Promise((r) => setTimeout(r, 200));
console.log('before:', JSON.stringify(await page.evaluate(() => window.__cap.achOpen())));
await page.keyboard.down('a');
await new Promise((r) => setTimeout(r, 120));
await page.keyboard.up('a');
await new Promise((r) => setTimeout(r, 500));
console.log('after :', JSON.stringify(await page.evaluate(() => window.__cap.achOpen())));
await b.close();
