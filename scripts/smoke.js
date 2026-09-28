const DEFAULT_API_URL = 'https://charly-tawk-bootcamp-project-production.up.railway.app';
const DEFAULT_WEB_URL = 'https://celebrated-medovik-966052.netlify.app';
const REQUEST_TIMEOUT_MS = 15000;

const apiBaseUrl = (process.env.SMOKE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
const webBaseUrl = (process.env.SMOKE_WEB_URL || DEFAULT_WEB_URL).replace(/\/+$/, '');

let accessToken = null;
let healthVersion = 'unavailable';
let healthCommit = 'unavailable';
let failed = false;

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    // A non-JSON body is represented as null and fails the relevant check.
  }
  return { response, body };
}

async function check(name, run) {
  let passed = false;
  try {
    passed = await run();
  } catch {
    passed = false;
  }

  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  if (!passed) failed = true;
}

async function main() {
  await check('GET /api/health is healthy', async () => {
    const { response, body } = await fetchJson(`${apiBaseUrl}/api/health`);
    healthVersion = typeof body?.version === 'string' ? body.version : 'unavailable';
    healthCommit = typeof body?.commit === 'string' ? body.commit : 'unavailable';
    return response.status === 200 && body?.status === 'ok' && body?.database === 'up';
  });

  await check('Alice login returns an access token', async () => {
    const { response, body } = await fetchJson(`${apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'password123' }),
    });
    if (response.status !== 200 || typeof body?.access_token !== 'string' || !body.access_token) return false;
    accessToken = body.access_token;
    return true;
  });

  await check('GET /api/tickets/mine with Alice token returns an array', async () => {
    if (!accessToken) return false;
    const { response, body } = await fetchJson(`${apiBaseUrl}/api/tickets/mine`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.status === 200 && Array.isArray(body);
  });

  await check('Alice is denied GET /api/admin/users', async () => {
    if (!accessToken) return false;
    const { response } = await fetchJson(`${apiBaseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.status === 403;
  });

  await check('GET /api/tickets/mine without a token returns 401', async () => {
    const { response } = await fetchJson(`${apiBaseUrl}/api/tickets/mine`);
    return response.status === 401;
  });

  await check('GET web root returns 200', async () => {
    const { response } = await fetchJson(webBaseUrl);
    return response.status === 200;
  });

  await check('GET /employee deep link returns 200', async () => {
    const { response } = await fetchJson(`${webBaseUrl}/employee`);
    return response.status === 200;
  });

  console.log(`Health version: ${healthVersion}`);
  console.log(`Health commit: ${healthCommit}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`SMOKE: ${failed ? 'NO-GO' : 'GO'}`);
  process.exitCode = failed ? 1 : 0;
}

main().catch(() => {
  console.log('SMOKE: NO-GO');
  process.exitCode = 1;
});