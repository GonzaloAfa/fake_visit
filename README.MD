# Fake Visit
[![Selenium Test](https://github.com/GonzaloAfa/fake_visit/actions/workflows/selenium.yml/badge.svg)](https://github.com/GonzaloAfa/fake_visit/actions/workflows/selenium.yml)

Literalmente con este script podemos simular visitas a sitios web.


## Instalación de las dependencias
```
python3 -m venv env
source env/bin/activate
pip3 install -r requeriments.txt
```

Para instalar el driver
```
brew install chromedriver
```

Al ejecutarlo por primera vez, solicitará permisos porque el driver de chrome se instaló por fuera de la `AppStore`

## Ejecución en Node.js (opcional, en evaluación)
```
npm install
npm start
```
`npm install` descarga Chromium vía `playwright install` (postinstall). El workflow de CI sigue corriendo la versión Python por ahora.

### Configuración por env vars

| Variable | Default | Descripción |
|---|---|---|
| `TITLE_NOTE` | `Plataforma reúne` | Texto a buscar dentro del ranking |
| `DATE` | `18-05-2026 0:00:00` | Fecha de la portada de LUN |
| `TOTAL_FAKE_VISIT` | `1000` | Total de iteraciones |
| `MIN_DELAY_MS` / `MAX_DELAY_MS` | `2500` / `6000` | Throttle entre iteraciones (con jitter) |
| `MIN_DWELL_MS` / `MAX_DWELL_MS` | `8000` / `18000` | Tiempo "leyendo" la nota tras click |
| `MAX_RETRIES` | `3` | Reintentos en `goto` ante errores transitorios |
| `CONTEXT_RECYCLE_EVERY` | `50` | Cada cuántas iter rotar identidad y context |
| `BROWSER_RECYCLE_EVERY` | `200` | Cada cuántas iter relanzar el browser |
| `METRICS_PATH` | `metrics.jsonl` | JSONL de métricas por iteración |
| `PROXY_URL` | _(none)_ | Proxy opcional `http://user:pass@host:port` (Fase 2) |

### Descubrir el rate-limit real (ramp-up)
```
node ramp_up.mjs
```
Sube progresivamente la frecuencia (30s → 1s entre reqs) y emite una tabla con `reset_ratio` y `p95` por nivel. Sugiere un `MIN/MAX_DELAY_MS` razonable. Budget por defecto: 200 requests.

### Fase 2: rotación de IP (cuando el throttle no basta)

**Recomendado: proxies residenciales** (Smartproxy / Bright Data ~$5-15 por 1000 visitas).
```
PROXY_URL='http://user:pass@gate.smartproxy.com:7000' npm start
```

**Plan B gratis: GitHub Actions matrix.** Pendiente de implementar — paraleliza N jobs × M visitas con diversidad de IPs del pool de runners.