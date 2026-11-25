import crypto from 'node:crypto';

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function encodeRfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function createR2PresignedPutUrl({ accountId, accessKeyId, secretAccessKey, bucket, key, expiresSeconds = 300 }) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const encodedPath = `/${encodeRfc3986(bucket)}/${key.split('/').map(encodeRfc3986).join('/')}`;

  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': 'host',
  });
  queryParams.sort();

  const canonicalRequest = [
    'PUT',
    encodedPath,
    queryParams.toString(),
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return `https://${host}${encodedPath}?${queryParams.toString()}&X-Amz-Signature=${signature}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = (process.env.R2_BUCKET_NAME || 'base16-media').trim();
  const publicBaseUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');

  if (!accountId || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    return res.status(503).json({ error: 'Cloudflare R2 is not configured on the server.' });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }
    const user = await userRes.json();

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const safeName = String(body.filename || `upload_${Date.now()}.jpg`)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(-80);
    const folder = String(body.folder || 'uploads').replace(/[^a-zA-Z0-9_-]/g, '');
    const key = `${folder}/${user.id}/${Date.now()}_${safeName}`;

    const uploadUrl = createR2PresignedPutUrl({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      key,
    });

    return res.status(200).json({
      uploadUrl,
      publicUrl: `${publicBaseUrl}/${key}`,
      key,
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Failed to generate upload URL.' });
  }
}
