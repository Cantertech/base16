import fs from 'node:fs';
import path from 'node:path';

// Load local .env if env vars aren't already set in the environment
function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadLocalEnv();

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('[keepalive] Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  process.exit(1);
}

async function ping() {
  const endpoint = `${supabaseUrl}/rest/v1/schools?select=id&limit=1`;
  const start = Date.now();
  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  const elapsed = Date.now() - start;
  if (!res.ok) {
    const text = await res.text();
    console.error(`[keepalive] FAILED (${res.status}) in ${elapsed}ms: ${text.slice(0, 300)}`);
    process.exit(1);
  }

  console.log(`[keepalive] OK (${res.status}) ${supabaseUrl} in ${elapsed}ms at ${new Date().toISOString()}`);
}

ping().catch((err) => {
  console.error('[keepalive] ERROR:', err?.message || err);
  process.exit(1);
});

