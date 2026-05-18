import { appendFile } from 'node:fs/promises';

export class Metrics {
  constructor(logPath) {
    this.logPath = logPath;
    this.records = [];
    this.startTime = Date.now();
  }

  classifyError(err) {
    const msg = err?.message || String(err);
    if (msg.includes('ERR_CONNECTION_RESET')) return 'reset';
    if (msg.includes('ERR_CONNECTION_CLOSED')) return 'closed';
    if (msg.includes('ERR_NETWORK_CHANGED')) return 'net_changed';
    if (msg.includes('Timeout')) return 'timeout';
    if (msg.includes('ERR_TOO_MANY_REQUESTS') || msg.includes('429')) return 'http_429';
    if (/ERR_HTTP_RESPONSE_CODE_FAILURE|HTTP\/.+\s5\d\d/.test(msg)) return 'http_5xx';
    return 'other';
  }

  async record(rec) {
    const enriched = { t: Date.now(), ...rec };
    this.records.push(enriched);
    if (this.logPath) {
      try {
        await appendFile(this.logPath, JSON.stringify(enriched) + '\n');
      } catch {}
    }
  }

  windowRecords(windowMs) {
    const cutoff = Date.now() - windowMs;
    return this.records.filter((r) => r.t >= cutoff);
  }

  resetRatio(windowMs = 60_000) {
    const w = this.windowRecords(windowMs);
    if (w.length === 0) return 0;
    const resets = w.filter((r) => r.error_class === 'reset').length;
    return resets / w.length;
  }

  consecutiveResets() {
    let n = 0;
    for (let i = this.records.length - 1; i >= 0; i--) {
      if (this.records[i].error_class === 'reset') n++;
      else if (this.records[i].status === 'ok') break;
    }
    return n;
  }

  percentile(p) {
    const oks = this.records.filter((r) => r.status === 'ok' && typeof r.latency_ms === 'number');
    if (oks.length === 0) return null;
    const sorted = oks.map((r) => r.latency_ms).sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
    return sorted[idx];
  }

  summary() {
    const total = this.records.length;
    const ok = this.records.filter((r) => r.status === 'ok').length;
    const fail = total - ok;
    const errors = {};
    for (const r of this.records) {
      if (r.error_class) errors[r.error_class] = (errors[r.error_class] || 0) + 1;
    }
    const elapsedSec = (Date.now() - this.startTime) / 1000;
    return {
      total,
      ok,
      fail,
      success_rate: total ? ok / total : 0,
      reset_ratio_total: total ? (errors.reset || 0) / total : 0,
      reset_ratio_1m: this.resetRatio(60_000),
      reset_ratio_5m: this.resetRatio(300_000),
      rps_effective: elapsedSec ? ok / elapsedSec : 0,
      p50_ms: this.percentile(0.5),
      p95_ms: this.percentile(0.95),
      p99_ms: this.percentile(0.99),
      errors,
      elapsed_sec: Math.round(elapsedSec),
    };
  }
}
