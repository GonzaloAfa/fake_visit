# Fake Visit

Simula visitas a un sitio web público. El sitio objetivo se configura por env var (`TARGET_URL_TEMPLATE`) — el script no contiene el dominio hardcoded.

## Uso local

```
npm install
TARGET_URL_TEMPLATE='https://example.com/path?d={DATE}' \
TITLE_NOTE='texto a buscar' \
DATE='18-05-2026 0:00:00' \
TOTAL_FAKE_VISIT=3 \
npm start
```

`npm install` descarga Chromium vía `playwright install` (postinstall).

### Configuración por env vars

| Variable | Default | Descripción |
|---|---|---|
| `TARGET_URL_TEMPLATE` | _(requerido)_ | URL con placeholder `{DATE}`. Se mantiene fuera del repo. |
| `TITLE_NOTE` | _(requerido)_ | Texto a buscar en el ranking |
| `DATE` | _(empty)_ | Valor que reemplaza `{DATE}` en el template |
| `TOTAL_FAKE_VISIT` | `1000` | Total de iteraciones |
| `MIN_DELAY_MS` / `MAX_DELAY_MS` | `2500` / `6000` | Throttle entre iteraciones (con jitter) |
| `MIN_DWELL_MS` / `MAX_DWELL_MS` | `8000` / `18000` | Tiempo "leyendo" tras click |
| `MAX_RETRIES` | `3` | Reintentos en `goto` ante errores transitorios |
| `CONTEXT_RECYCLE_EVERY` | `50` | Cada cuántas iter rotar identidad y context |
| `BROWSER_RECYCLE_EVERY` | `200` | Cada cuántas iter relanzar el browser |
| `METRICS_PATH` | `metrics.jsonl` | JSONL de métricas por iteración |
| `PROXY_URL` | _(none)_ | Proxy opcional `http://user:pass@host:port` |

### Descubrir el rate-limit real (ramp-up)
```
TARGET_URL_TEMPLATE='...' DATE='...' node ramp_up.mjs
```
Sube progresivamente la frecuencia (30s → 1s entre reqs) y emite una tabla con `reset_ratio` y `p95` por nivel. Sugiere un `MIN/MAX_DELAY_MS` razonable. Budget por defecto: 200 requests.

## Ejecución en GitHub Actions

Workflow `playwright_fake_visit.yml` corre 20 jobs paralelos × N visitas cada uno, con IPs distintas del pool de runners. Triggereable manualmente:

```
gh workflow run "Playwright Fake Visit (matrix)" \
  -f visits_per_job=50 \
  -f title_note='Plataforma reúne' \
  -f date='18-05-2026 0:00:00'
```

Requiere el secret de repo `TARGET_URL_TEMPLATE`.

### Rotación de IP local (cuando una sola IP no basta)

Proxies residenciales (Smartproxy / Bright Data ~$5-15 por 1000 visitas):
```
PROXY_URL='http://user:pass@gate.smartproxy.com:7000' npm start
```
