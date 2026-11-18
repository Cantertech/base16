export default async function handler(req, res) {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      ok: false,
      error: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.',
    });
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/schools?select=id&limit=1`, {
      method: 'GET',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      return res.status(502).json({
        ok: false,
        status: response.status,
        error: body.slice(0, 300),
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      ok: true,
      status: response.status,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || String(err),
      timestamp: new Date().toISOString(),
    });
  }
}

