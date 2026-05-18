import { chromium } from 'playwright';
import { appendFileSync } from 'node:fs';

const TITLE_NOTE = 'Plataforma reúne';
const BASE_URL = 'https://www.lun.com';
const PAGES_ENDPOINT = 'pages/LUNHomepage.aspx';
const DATE = '18-05-2026 0:00:00';
const TOTAL_FAKE_VISIT = 1000;

const COOKIES = [
  'LUNUniqueVisitor_New',
  'LUNNewsUniqueVisitor',
  '__auc',
  '_gid',
  '__asc',
  '_ga',
];

function setOutput(name, value) {
  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    appendFileSync(out, `${name}=${value}\n`);
  } else {
    console.log(value);
  }
}

function generateUrl() {
  return `${BASE_URL}/${PAGES_ENDPOINT}?xp=${DATE}&BodyID=0&xp=${DATE}`;
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

async function fakeVisit(page) {
  const url = generateUrl();
  await page.goto(url);

  const id = await findNoteId(page, TITLE_NOTE);

  if (!id) {
    setOutput('error', `Ups! No encontramos la nota, pero esta es la url: ${url}`);
    return;
  }

  await page.evaluate((elementId) => {
    document.getElementById(elementId)?.click();
  }, id);
}

async function clearCookies(context) {
  const cookies = await context.cookies();
  const keep = cookies.filter((c) => !COOKIES.includes(c.name));
  await context.clearCookies();
  if (keep.length > 0) {
    await context.addCookies(keep);
  }
}

async function main() {
  console.log(`Keywords: ${TITLE_NOTE}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  for (let i = 0; i < TOTAL_FAKE_VISIT; i++) {
    try {
      await fakeVisit(page);
      await clearCookies(context);

      if (i % 10 === 0) {
        setOutput('items', String(i));
      }
    } catch (err) {
      setOutput('error', 'Tuvimos un error en una de las peticiones');
    }
  }

  await browser.close();
}

setOutput('start', 'welcome to fake visit');
await main();
