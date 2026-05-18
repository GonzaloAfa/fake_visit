import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, newContextWithIdentity } from './lib/browser.mjs';
import { Metrics } from './lib/metrics.mjs';

const BASE_URL = 'https://www.lun.com';
const PAGES_ENDPOINT = 'pages/LUNHomepage.aspx';
const DATE = process.env.DATE || '18-05-2026 0:00:00';
const URL = `${BASE_URL}/${PAGES_ENDPOINT}?xp=${DATE}&BodyID=0&xp=${DATE}`;

const LEVELS_SEC = (process.env.LEVELS_SEC || '30,15,10,6,4,3,2,1.5,1').split(',').map(Number);
const LEVEL_MINUTES = Number(process.env.LEVEL_MINUTES || 3);
const MIN_REQS_PER_LEVEL = Number(process.env.MIN_REQS_PER_LEVEL || 10);
const ABORT_RESET_RATIO = Number(process.env.ABORT_RESET_RATIO || 0.05);
const ABORT_CONSECUTIVE_RESETS = Number(process.env.ABORT_CONSECUTIVE_RESETS || 3);
const TOTAL_BUDGET = Number(process.env.TOTAL_BUDGET || 200);
const METRICS_PATH = process.env.METRICS_PATH || 'ramp_up.jsonl';

function p95(arr) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

async function probeOnce(page, metrics, iter) {
  const tStart = Date.now();
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await metrics.record({ iter, latency_ms: Date.now() - tStart, status: 'ok' });
    return 'ok';
  } catch (err) {
    const cls = metrics.classifyError(err);
    await metrics.record({
      iter,
      latency_ms: Date.now() - tStart,
      status: 'fail',
      error_class: cls,
      error_msg: (err?.message || String(err)).split('\n')[0].slice(0, 240),
    });
    return cls;
  }
}

async function runLevel(page, metrics, intervalSec, baselineP95, totalSoFar) {
  const intervalMs = Math.round(intervalSec * 1000);
  console.log(`\n--- nivel: 1 req cada ${intervalSec}s — duración ${LEVEL_MINUTES}min, mínimo ${MIN_REQS_PER_LEVEL} reqs ---`);
  const startTs = Date.now();
  const latenciesOk = [];
  let consecResets = 0;
  let resetCount = 0;
  let okCount = 0;
  let totalCount = 0;
  let aborted = false;
  let abortReason = null;

  while (true) {
    if (totalSoFar + totalCount >= TOTAL_BUDGET) {
      abortReason = `total budget ${TOTAL_BUDGET} reached`;
      aborted = true;
      break;
    }
    const elapsedMin = (Date.now() - startTs) / 60_000;
    if (elapsedMin >= LEVEL_MINUTES && totalCount >= MIN_REQS_PER_LEVEL) break;

    const iter = totalSoFar + totalCount;
    const result = await probeOnce(page, metrics, iter);
    totalCount++;

    if (result === 'ok') {
      okCount++;
      consecResets = 0;
      const last = metrics.records[metrics.records.length - 1];
      if (typeof last?.latency_ms === 'number') latenciesOk.push(last.latency_ms);
    } else {
      if (result === 'reset') {
        resetCount++;
        consecResets++;
      }
    }

    const resetRatio = totalCount ? resetCount / totalCount : 0;
    if (totalCount >= 5 && resetRatio > ABORT_RESET_RATIO) {
      abortReason = `reset_ratio ${resetRatio.toFixed(2)} > ${ABORT_RESET_RATIO}`;
      aborted = true;
      break;
    }
    if (consecResets >= ABORT_CONSECUTIVE_RESETS) {
      abortReason = `${consecResets} resets consecutivos`;
      aborted = true;
      break;
    }
    const levelP95 = p95(latenciesOk);
    if (baselineP95 && levelP95 && levelP95 > baselineP95 * 3 && latenciesOk.length >= 5) {
      abortReason = `p95 ${levelP95}ms > 3× baseline ${baselineP95}ms`;
      aborted = true;
      break;
    }

    await sleep(intervalMs);
  }

  const levelP95 = p95(latenciesOk);
  const resetRatio = totalCount ? resetCount / totalCount : 0;
  const result = {
    interval_sec: intervalSec,
    total: totalCount,
    ok: okCount,
    resets: resetCount,
    reset_ratio: Number(resetRatio.toFixed(3)),
    p95_ms: levelP95,
    aborted,
    abort_reason: abortReason,
  };
  console.log(`  → ok=${okCount}/${totalCount} resets=${resetCount} reset_ratio=${result.reset_ratio} p95=${levelP95}ms${aborted ? ` ABORTED: ${abortReason}` : ''}`);
  return result;
}

async function main() {
  console.log(`Ramp-up test contra ${URL}`);
  console.log(`Niveles (segundos): ${LEVELS_SEC.join(', ')}`);
  console.log(`Budget total: ${TOTAL_BUDGET} reqs`);

  const metrics = new Metrics(METRICS_PATH);
  const browser = await launchBrowser();
  const { context } = await newContextWithIdentity(browser);
  const page = await context.newPage();

  const tableRows = [];
  let baselineP95 = null;
  let totalSoFar = 0;

  try {
    for (const intervalSec of LEVELS_SEC) {
      const row = await runLevel(page, metrics, intervalSec, baselineP95, totalSoFar);
      tableRows.push(row);
      totalSoFar += row.total;
      if (intervalSec === LEVELS_SEC[0] && row.p95_ms) baselineP95 = row.p95_ms;

      if (row.aborted && row.abort_reason !== `total budget ${TOTAL_BUDGET} reached`) {
        console.log(`\n>>> rate-limit detectado en ${intervalSec}s. Cooldown 10min antes del siguiente.`);
        await sleep(600_000);
      }
      if (totalSoFar >= TOTAL_BUDGET) {
        console.log('\nBudget agotado, fin del ramp-up.');
        break;
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  console.log('\n=== ramp-up summary ===');
  console.table(tableRows);

  const safeRow = [...tableRows].reverse().find((r) => !r.aborted && r.reset_ratio === 0);
  if (safeRow) {
    const safeMs = Math.round(safeRow.interval_sec * 1000 / 0.7);
    console.log(`\nSafe rate sugerido: ~${safeMs}ms entre requests (= 70% del primer nivel sano).`);
    console.log(`Setear: MIN_DELAY_MS=${Math.round(safeMs * 0.8)} MAX_DELAY_MS=${Math.round(safeMs * 1.4)}`);
  } else {
    console.log('\nNo se encontró un nivel completamente sano. Probar con intervalos mayores o usar proxy.');
  }
}

await main();
