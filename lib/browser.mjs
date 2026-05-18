import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { pickIdentity } from './identity.mjs';

chromium.use(StealthPlugin());

const LAUNCH_ARGS = [
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-sandbox',
];

export async function launchBrowser() {
  return chromium.launch({ headless: true, args: LAUNCH_ARGS });
}

export async function newContextWithIdentity(browser, proxy) {
  const id = pickIdentity();
  const context = await browser.newContext({
    userAgent: id.userAgent,
    viewport: id.viewport,
    locale: id.locale,
    timezoneId: id.timezoneId,
    extraHTTPHeaders: id.extraHTTPHeaders,
    ignoreHTTPSErrors: true,
    ...(proxy ? { proxy } : {}),
  });
  return { context, identity: id };
}
