const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

// --- RETRY POLICY (Governance-Aligned) ---
// Retries are a governance decision, not a convenience feature.
// Different modes = different risk + cost profiles.
const RETRY_POLICY = {
  analysis: { retries: 2, baseDelay: 500 },   // text, low cost, safe to retry
  foresight: { retries: 1, baseDelay: 750 },  // advisory, retry once only
  audio: { retries: 0, baseDelay: 0 },        // expensive, stateful, never retry
};

function isRetryableStatus(status) {
  return [502, 503, 504].includes(status);
}

function detectMode(body) {
  if (body?.generationConfig?.responseModalities?.includes('AUDIO')) {
    return 'audio';
  }
  const text = body?.contents?.[0]?.parts?.[0]?.text?.toLowerCase() || '';
  if (text.includes('foresight')) {
    return 'foresight';
  }
  return 'analysis';
}

async function fetchGeminiWithPolicy(url, options, mode) {
  const policy = RETRY_POLICY[mode];
  let attempt = 0;

  while (true) {
    const res = await fetch(url, options);

    if (res.ok) return res;

    // Fail fast: no masking errors
    if (attempt >= policy.retries || !isRetryableStatus(res.status)) {
      return res;
    }

    const delay = policy.baseDelay * Math.pow(2, attempt);
    await new Promise((r) => setTimeout(r, delay));
    attempt++;
  }
}

// --- RATE LIMITING ---
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 20;

function isRateLimited(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return false;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  record.count++;
  return false;
}

// --- EDGE FUNCTION ---
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  if (isRateLimited(ip)) {
    console.log(`[RATE_LIMITED] IP: ${ip}`);
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[CONFIG_ERROR] GEMINI_API_KEY not configured');
    return new Response(
      JSON.stringify({ error: 'Service configuration error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const timestamp = new Date().toISOString();
    const mode = detectMode(body);

    console.log(
      `[GEMINI_REQUEST] ${timestamp} | IP: ${ip} | Mode: ${mode} | Retries: ${RETRY_POLICY[mode].retries}`
    );

    const response = await fetchGeminiWithPolicy(
      `${GEMINI_ENDPOINT}?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      mode
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[GEMINI_ERROR] ${timestamp} | Mode: ${mode} | Status: ${response.status} | ${errorText}`
      );
      return new Response(
        JSON.stringify({ error: 'Upstream API error', status: response.status }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`[GEMINI_SUCCESS] ${timestamp} | IP: ${ip} | Mode: ${mode}`);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(`[PROXY_ERROR] ${err.message}`);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
