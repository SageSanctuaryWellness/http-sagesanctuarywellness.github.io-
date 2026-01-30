const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

// Simple in-memory rate limiting (resets on cold start)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per minute per IP

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

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rate limiting
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  if (isRateLimited(ip)) {
    console.log(`[RATE_LIMITED] IP: ${ip}`);
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Validate API key exists server-side
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[CONFIG_ERROR] GEMINI_API_KEY not configured');
    return new Response(
      JSON.stringify({ error: 'Service configuration error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const body = await req.json();

    // Audit log
    const timestamp = new Date().toISOString();
    const hasAudio = body?.generationConfig?.responseModalities?.includes('AUDIO');
    console.log(
      `[GEMINI_REQUEST] ${timestamp} | IP: ${ip} | Type: ${hasAudio ? 'audio' : 'text'}`
    );

    // Proxy to Gemini
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[GEMINI_ERROR] ${timestamp} | Status: ${response.status} | ${errorText}`);
      return new Response(
        JSON.stringify({ error: 'Upstream API error', status: response.status }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();

    // Log success
    console.log(`[GEMINI_SUCCESS] ${timestamp} | IP: ${ip}`);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(`[PROXY_ERROR] ${err.message}`);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
