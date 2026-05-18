import { appendFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, newContextWithIdentity } from './lib/browser.mjs';
import { Metrics } from './lib/metrics.mjs';

const TITLE_NOTE = process.env.TITLE_NOTE || '';
const TARGET_URL_TEMPLATE = process.env.TARGET_URL_TEMPLATE || '';
const DATE = process.env.DATE || '';

if (!TARGET_URL_TEMPLATE) {
  console.error('Falta TARGET_URL_TEMPLATE en el entorno (es un secret).');
  process.exit(1);
}
if (!TITLE_NOTE) {
  console.error('Falta TITLE_NOTE en el entorno.');
  process.exit(1);
}

const TOTAL_FAKE_VISIT = Number(process.env.TOTAL_FAKE_VISIT || 1000);
const MIN_DELAY_MS = Number(process.env.MIN_DELAY_MS || 2500);
const MAX_DELAY_MS = Number(process.env.MAX_DELAY_MS || 6000);
const MIN_DWELL_MS = Number(process.env.MIN_DWELL_MS || 8000);
const MAX_DWELL_MS = Number(process.env.MAX_DWELL_MS || 18000);
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 3);
const CONTEXT_RECYCLE_EVERY = Number(process.env.CONTEXT_RECYCLE_EVERY || 50);
const BROWSER_RECYCLE_EVERY = Number(process.env.BROWSER_RECYCLE_EVERY || 200);
const METRICS_PATH = process.env.METRICS_PATH || 'metrics.jsonl';
const PROXY_URL = process.env.PROXY_URL;

const proxy = PROXY_URL
  ? (() => {
      const u = new URL(PROXY_URL);
      return {
        server: `${u.protocol}//${u.host}`,
        ...(u.username ? { username: decodeURIComponent(u.username) } : {}),
        ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
      };
    })()
  : undefined;

function setOutput(name, value) {
  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    try { appendFileSync(out, `${name}=${value}\n`); } catch {}
  } else {
    console.log(value);
  }
}

function generateUrl() {
  return TARGET_URL_TEMPLATE.replaceAll('{DATE}', DATE);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

async function findNoteId(page, needle) {
  return page.evaluate((n) => {
    const containers = document.querySelectorAll('#contenedor_nota_ranking');
    for (const c of containers) {
      for (const a of c.querySelectorAll('a')) {
        const text = (a.textContent || '').trim();
        if (text.includes(n)) return a.id;
      }
    }
    return null;
  }, needle);
}

async function gotoWithRetry(page, url, metrics) {
  let attempt = 0;
  while (true) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return { retry_count: attempt };
    } catch (err) {
      attempt++;
      const cls = metrics.classifyError(err);
      const transient = ['reset', 'closed', 'net_changed', 'timeout', 'http_5xx'].includes(cls);
      if (!transient || attempt > MAX_RETRIES) throw err;
      const backoff = 2 ** attempt * 1000 + Math.random() * 500;
      console.warn(`goto retry ${attempt}/${MAX_RETRIES} after ${Math.round(backoff)}ms — ${cls}`);
      await sleep(backoff);
    }
  }
}

async function fakeVisit(page, iter, metrics) {
  const url = generateUrl();
  const tStart = Date.now();
  try {
    const { retry_count } = await gotoWithRetry(page, url, metrics);

    const id = await findNoteId(page, TITLE_NOTE);

    if (!id) {
      const rec = { iter, latency_ms: Date.now() - tStart, status: 'no_match', retry_count };
      await metrics.record(rec);
      setOutput('error', `Ups! No encontramos la nota, pero esta es la url: ${url}`);
      return;
    }

    await page.evaluate((elementId) => {
      document.getElementById(elementId)?.click();
    }, id);

    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    const dwell = randomBetween(MIN_DWELL_MS, MAX_DWELL_MS);
    await sleep(dwell);

    await metrics.record({
      iter,
      latency_ms: Date.now() - tStart,
      dwell_ms: Math.round(dwell),
      status: 'ok',
      note_id: id,
      retry_count,
    });
  } catch (err) {
    const cls = metrics.classifyError(err);
    await metrics.record({
      iter,
      latency_ms: Date.now() - tStart,
      status: 'fail',
      error_class: cls,
      error_msg: (err?.message || String(err)).split('\n')[0].slice(0, 240),
    });
    throw err;
  }
}

async function cooldownIfNeeded(metrics) {
  const consec = metrics.consecutiveResets();
  const window5m = metrics.windowRecords(300_000);
  const ratio5m = metrics.resetRatio(300_000);
  if (consec >= 10 || (window5m.length >= 20 && ratio5m > 0.5)) {
    console.error(`circuit breaker tripped — consec=${consec}, reset_ratio_5m=${ratio5m.toFixed(2)} (n=${window5m.length}). aborting.`);
    return 'abort';
  }
  if (consec >= 6) {
    console.warn(`6 resets seguidos — cooldown 5min y rotación de identidad`);
    await sleep(300_000);
    return 'recycle_context';
  }
  if (consec >= 3) {
    console.warn(`3 resets seguidos — cooldown 60s`);
    await sleep(60_000);
  }
  return null;
}

function adaptiveThrottle(metrics, base) {
  const ratio = metrics.resetRatio(60_000);
  if (ratio > 0.1) return base * 2;
  return base;
}

async function main() {
  const url = generateUrl();
  console.log(`Keywords: ${TITLE_NOTE}`);
  try {
    console.log(`Target host: ${new URL(url).host}`);
  } catch {
    console.log('Target host: (invalid url)');
  }
  console.log(`Total: ${TOTAL_FAKE_VISIT}, throttle=${MIN_DELAY_MS}-${MAX_DELAY_MS}ms, dwell=${MIN_DWELL_MS}-${MAX_DWELL_MS}ms`);
  if (proxy) console.log(`Proxy: ${proxy.server}`);

  const metrics = new Metrics(METRICS_PATH);

  let browser = await launchBrowser();
  let { context, identity } = await newContextWithIdentity(browser, proxy);
  let page = await context.newPage();
  console.log(`identity #0: ${identity.userAgent.split(') ')[1] || identity.userAgent}`);

  const memTimer = setInterval(() => {
    const m = process.memoryUsage();
    console.log(`mem rss=${Math.round(m.rss / 1024 / 1024)}MB heap=${Math.round(m.heapUsed / 1024 / 1024)}MB`);
  }, 30_000);
  memTimer.unref?.();

  let aborted = false;

  try {
    for (let i = 0; i < TOTAL_FAKE_VISIT; i++) {
      try {
        await fakeVisit(page, i, metrics);
        if (i % 10 === 0) setOutput('items', String(i));
      } catch (err) {
        console.error(`[iter ${i}]`, (err?.message || String(err)).split('\n')[0]);
        setOutput('error', 'Tuvimos un error en una de las peticiones');
      }

      const action = await cooldownIfNeeded(metrics);
      if (action === 'abort') {
        aborted = true;
        break;
      }
      if (action === 'recycle_context' || (i + 1) % CONTEXT_RECYCLE_EVERY === 0) {
        await context.close().catch(() => {});
        ({ context, identity } = await newContextWithIdentity(browser, proxy));
        page = await context.newPage();
        console.log(`identity #${i + 1}: ${identity.userAgent.split(') ')[1] || identity.userAgent}`);
      }
      if ((i + 1) % BROWSER_RECYCLE_EVERY === 0) {
        await browser.close().catch(() => {});
        browser = await launchBrowser();
        ({ context, identity } = await newContextWithIdentity(browser, proxy));
        page = await context.newPage();
        console.log(`browser reciclado en iter ${i + 1}`);
      }

      if (i < TOTAL_FAKE_VISIT - 1) {
        const throttle = adaptiveThrottle(metrics, randomBetween(MIN_DELAY_MS, MAX_DELAY_MS));
        await sleep(throttle);
      }
    }
  } finally {
    clearInterval(memTimer);
    await browser.close().catch(() => {});
  }

  const summary = metrics.summary();
  console.log('\n=== summary ===');
  console.log(JSON.stringify(summary, null, 2));
  setOutput('summary', JSON.stringify(summary));
  if (aborted) process.exit(2);
}

setOutput('start', 'welcome to fake visit');
await main();
