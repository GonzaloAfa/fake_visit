const IDENTITIES = [
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    secChUa: '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    secChUaMobile: '?0',
    secChUaPlatform: '"macOS"',
    viewport: { width: 1440, height: 900 },
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    secChUa: '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    secChUaMobile: '?0',
    secChUaPlatform: '"Windows"',
    viewport: { width: 1920, height: 1080 },
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    secChUa: '"Google Chrome";v="130", "Chromium";v="130", "Not_A Brand";v="24"',
    secChUaMobile: '?0',
    secChUaPlatform: '"Windows"',
    viewport: { width: 1366, height: 768 },
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    secChUa: '"Google Chrome";v="130", "Chromium";v="130", "Not_A Brand";v="24"',
    secChUaMobile: '?0',
    secChUaPlatform: '"macOS"',
    viewport: { width: 1680, height: 1050 },
  },
  {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    secChUa: '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    secChUaMobile: '?0',
    secChUaPlatform: '"Linux"',
    viewport: { width: 1920, height: 1080 },
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    secChUa: '"Google Chrome";v="129", "Chromium";v="129", "Not_A Brand";v="24"',
    secChUaMobile: '?0',
    secChUaPlatform: '"Windows"',
    viewport: { width: 1280, height: 720 },
  },
];

const REFERERS = [
  'https://www.google.com/',
  'https://www.google.cl/',
  'https://t.co/',
  'https://www.facebook.com/',
  null,
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickIdentity() {
  const id = pickRandom(IDENTITIES);
  const referer = pickRandom(REFERERS);
  return {
    userAgent: id.userAgent,
    viewport: id.viewport,
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    extraHTTPHeaders: {
      'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
      'sec-ch-ua': id.secChUa,
      'sec-ch-ua-mobile': id.secChUaMobile,
      'sec-ch-ua-platform': id.secChUaPlatform,
      ...(referer ? { Referer: referer } : {}),
    },
  };
}
