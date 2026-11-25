export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const upstreamUrl = (process.env.AI_AGENT_UPSTREAM_URL || 'http://155.248.239.188/base16-api/api/chat').trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Supabase environment variables are not configured.' });
  }

  // 1. Require authenticated Supabase user JWT
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token.' });
  }

  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!userRes.ok) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }
    const user = await userRes.json();

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { school_id } = body;
    if (!school_id) {
      return res.status(400).json({ error: 'school_id is required.' });
    }

    // 2. Verify caller belongs to this school (or is super_admin) using caller's own JWT (respects RLS)
    const profRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=school_id,role&limit=1`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const profiles = profRes.ok ? await profRes.json() : [];
    const caller = profiles?.[0];
    if (!caller || (caller.role !== 'super_admin' && caller.school_id !== school_id)) {
      return res.status(403).json({ error: 'Unauthorized for this school.' });
    }

    // 3. Forward verified request server-to-server to Oracle AI Agent
    const aiRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const rawText = await aiRes.text();
    let payload;
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = { detail: rawText.slice(0, 300) };
    }

    return res.status(aiRes.status).json(payload);
  } catch (err) {
    return res.status(502).json({ error: err?.message || 'Failed to reach AI backend.' });
  }
}
